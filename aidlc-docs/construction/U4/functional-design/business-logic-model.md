# U4 ビジネスロジックモデル（画像管理）

**ステージ**: CONSTRUCTION → U4 Functional Design

## 1. アーキテクチャ概観（既存 catapult データフロー準拠）

```
[Next.js] --submission(meta)--> [POST api/private/surveys/submission]
                                      | photoPort.persist(tx, surveyId, metas, actor)
                                      v
                              Photo レコード作成(status=pending) + s3Key 採番
                                      | s3.putSignedUrl(key, contentType, 15min)
                                      v
        <--- PhotoUploadTicket[] (photoId + putUrl) を提出応答に含めて返却
[Next.js] --PUT binary--> [S3/MinIO]（presigned PUT, クライアント直アップロード）
[Next.js] --confirm(photoId[])--> [POST api/private/surveys/:id/photos/confirm]
                                      | photoUseCase.confirmUploaded → status=uploaded
[Next.js] --GET list--> [GET api/private/surveys/:id/photos]
                                      | 認可確認 → uploaded のみ presigned GET(24h) を発行
```

## 2. ポート（DI 境界）

### photoPort（既存スタブを本実装へ）
- `persist(tx, surveyId, metas: PhotoMeta[], actor): PhotoUploadTicket[]`
  - 各メタに `photoId` 採番、`s3Key=surveys/{surveyId}/{photoId}` を構成、`Photo(status='pending')` を作成。
  - 依存（velona `depend`）: `genId`（ULID）, `now`, `signPut`（= `s3.putSignedUrl`）。テストでスタブ注入可能。
  - 戻り: `PhotoUploadTicket[]`（photoId + presigned PUT URL, 15分）。
- `signViewUrls(photos: PhotoDto[]): Promise<PhotoView[]>`
  - `status='uploaded'` のみ `s3.getSignedUrl`（24h）で GET URL を発行（INV-P3）。

### s3 サービス拡張（service/s3Client.ts）
- `putSignedUrl(key, contentType, expiresIn=900): Promise<string>`（新規。`PutObjectCommand` + `getSignedUrl`）。既存 `getSignedUrl`（GET, 24h）はそのまま閲覧に流用。

## 3. ユースケース（photoUseCase / 既存 surveyUseCase 連携）

### 3.1 提出時の写真登録（surveyUseCase.ingestSubmission に統合）
- 既存の `ports.photoPort.persist(tx, saved.id, payload.photos ?? [])` を新シグネチャ（`actor` 追加, 戻り `PhotoUploadTicket[]`）へ更新。
- 提出応答 DTO（`SurveyDetailDto`）に `photoUploadTickets: PhotoUploadTicket[]` を加法的に同梱（クライアントが PUT 先 URL を取得）。
- 監査: 写真登録は調査提出イベントに包含（U-Cross 監査規約）。件数を summary に記録。

### 3.2 アップロード確認（photoUseCase.confirmUploaded）
- 入力: `actor`, `surveyId`, `photoIds: DtoId['photo'][]`。
- 認可: `surveyPolicy.assertSubmitter(actor)` かつ対象 Photo が当該 survey 所属（BR）。
- 処理: `pending` の対象を `status='uploaded'` / `uploadedAt=now` へ遷移（冪等: 既に uploaded は no-op）。
- 監査: `photo.uploadConfirmed`（対象件数）。

### 3.3 閲覧 URL 取得（photoUseCase.listForSurvey）
- 入力: `actor`, `surveyId`。
- 認可: 調査の閲覧権限（viewer 全read / surveyor・admin のロール規約, U1 準拠）。
- 処理: 当該 survey の `uploaded` 写真を取得 → `signViewUrls` で presigned GET（24h）を発行して返す。`pending` は除外（INV-P3）。

## 4. API エンドポイント（api/private/surveys 配下、加法的）
| メソッド/パス | 用途 | 認可 |
|---|---|---|
| （既存）`POST submission` | 提出。応答に `photoUploadTickets` を追加 | submitter |
| `POST :surveyId/photos/confirm` | アップロード確認（pending→uploaded） | submitter & 所属一致 |
| `GET :surveyId/photos` | 閲覧 URL 一覧（uploaded のみ presigned GET） | 閲覧権限 |

## 5. store（純粋・Prisma 境界）
- `photoCommand.create(tx, entity)` / `photoCommand.markUploaded(tx, ids, uploadedAt)`
- `photoQuery.listBySurvey(tx, surveyId)` / `photoQuery.findByIds(tx, surveyId, ids)`
- `toPhotoDto(record): PhotoDto`（DateTime→epoch ms、status 文字列の zod ナローイング）。

## 6. テスト戦略
- 単体: `photoPort.persist`（キー採番・件数・チケット生成、依存スタブ）、`photoUseCase.confirmUploaded`（冪等・pending のみ遷移・所属検証）、`signViewUrls`（pending 除外 = INV-P3）、`toPhotoDto`。
- API 統合: 提出→チケット取得→confirm→一覧 GET URL 取得の一連。未確認写真が一覧に出ないこと。所属外 photoId の confirm 拒否。認可失敗（権限なし）が 403。
- PBT: 写真集合に対する INV-P1/P3（uploaded ⇔ uploadedAt、pending は URL 非発行）の不変条件。
