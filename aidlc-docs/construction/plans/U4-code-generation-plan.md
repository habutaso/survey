# U4 コード生成プラン（画像管理 / Code Generation Part 1）

**ステージ**: CONSTRUCTION → U4 Code Generation（Part 1: Planning）
**作成日時**: 2026-06-15T09:21+09:00
**担当ストーリー**: US-304 / US-305（FR-12, FR-13, FR-14 / SECURITY-01）
**設計**: `construction/U4/functional-design/*`、`construction/U4/infrastructure-design/infrastructure-design.md`
**設計判断**: Q-U4-1=A（presigned PUT）/ Q-U4-2=A（非公開・presigned のみ）/ Q-U4-3=C（survey+part+step）/ Q-U4-4=B（確認方式 pending→uploaded）/ Q-U4-5=A（キー=`surveys/{surveyId}/{photoId}`、GET 24h / PUT 15分）

## ゴール
`photoPort` を no-op スタブから presigned PUT URL 方式の本実装へ。写真メタの永続化（Prisma Photo）、アップロード確認 API、認可付き閲覧 URL 取得 API を追加し、提出フローに統合する。

## 実装ステップ（チェックボックス）

### A. 型・定数・branded id
- [x] 1. `common/constants/index.ts`: `ID_NAME_LIST` に `'photo'` を追加（`['user','auditLog','survey','photo']`）。`PHOTO_STATUS` 定数（`pending`/`uploaded`）を追加。
- [x] 2. `common/types/photo.ts`（新規）: `PhotoStatus` / `PhotoMeta`（fileName/contentType/part/step）/ `PhotoBase` / `PhotoDto` / `PhotoUploadTicket` / `PhotoView` を定義（domain-entities.md §2）。
- [x] 3. `common/types/survey.ts`: 旧 `PhotoMeta`（fileName/contentType）を削除し `common/types/photo.ts` から re-export または参照差替。`SubmissionPayload.photos?` を新 `PhotoMeta[]` 参照に更新。`SurveyDetailDto`（or 提出応答型）に `photoUploadTickets?: PhotoUploadTicket[]` を加法的に追加。
- [x] 4. `common/validators/survey.ts` / 新 `common/validators/photo.ts`: photo メタの zod（`contentType` は `image/*`、`fileName` 境界付き、`part`/`step` は nullable 文字列）。confirm body（`photoIds: DtoId['photo'][]`）validator。

### B. Prisma
- [x] 5. `prisma/schema.prisma`: `Photo` モデル追加（domain-entities.md §3）＋ `Survey.photos Photo[]` リレーション（加法的）。`@@index([surveyId])`。
- [x] 6. マイグレーション作成・適用（`prisma migrate dev --name add_photo`）。加法的であることを確認。

### C. S3 サービス
- [x] 7. `service/s3Client.ts`: `putSignedUrl(key, contentType, expiresIn=900): Promise<string>` を追加（`PutObjectCommand` + `getSignedUrl`）。既存 `getSignedUrl`（GET 24h）は閲覧に流用。

### D. domain/photo（新規モジュール）
- [x] 8. `domain/photo/model/photoType.ts`: `PhotoEntity` 型。`photoMethod.ts`: 採番・キー構成（`buildKey`）・`createFromMeta`（status=pending）・`markUploaded`（冪等, INV-P1）・`assertBelongsTo`（所属検証, BR-P10）。純粋関数。
- [x] 9. `domain/photo/store/photoCommand.ts`（`create` / `markUploaded`）・`photoQuery.ts`（`listBySurvey` / `findByIds`）・`toPhotoDto.ts`（DateTime→epoch ms、status ナローイング）。
- [x] 10. `domain/photo/ports/`（任意）or `domain/survey/ports/photoPort.ts` を本実装へ更新:
  - `persist(tx, surveyId, metas, actor)`: Photo(pending) 作成 + PUT presigned（15分）発行 → `PhotoUploadTicket[]`。依存 `depend({ genId, now, signPut })`。
  - `signViewUrls(photos)`: `uploaded` のみ GET presigned（24h）→ `PhotoView[]`（INV-P3）。依存 `depend({ signGet })`。
- [x] 11. `domain/photo/photoUseCase.ts`: `confirmUploaded(actor, surveyId, photoIds)`（submitter 認可＋所属検証＋pending→uploaded 冪等＋監査 `photo.uploadConfirmed`）、`listForSurvey(actor, surveyId)`（閲覧権限＋uploaded の presigned GET）。トランザクション・監査は U-Cross 規約準拠。

### E. surveyUseCase 統合
- [x] 12. `domain/survey/surveyUseCase.ts`: `ingestSubmission` の `photoPort.persist` 呼出を新シグネチャ（actor 追加・戻り tickets）へ更新。提出応答に `photoUploadTickets` を同梱。監査 summary に写真件数を加味。

### F. API エンドポイント（frourio, api/private/surveys/_surveyId@string 配下）
- [x] 13. `photos/index.ts` + `photos/controller.ts`: `GET`（`photoUseCase.listForSurvey`、閲覧権限）。
- [x] 14. `photos/confirm/index.ts` + `controller.ts` + validators: `POST`（body=photoIds、submitter ロール L1 強制＋`photoUseCase.confirmUploaded`）。
- [x] 15. `npm run generate`（prisma + frourio `$server` + aspida `$api`）で型・ルート再生成。

### G. テスト（カバレッジ100%・PBT 維持）
- [x] 16. 単体: `photoMethod`（buildKey/createFromMeta/markUploaded 冪等/assertBelongsTo）、`toPhotoDto`、`photoPort.persist`（件数・キー・チケット, 依存スタブ）、`signViewUrls`（pending 除外=INV-P3）。
- [x] 17. 単体 PBT: 写真集合に対する INV-P1（uploaded⇔uploadedAt）・INV-P3（pending は URL 非発行）の不変条件（fast-check）。
- [x] 18. API 統合 `tests/api/private/surveys.test.ts`（or 新 `photos.test.ts`）: 提出→tickets 取得→confirm→GET 一覧（uploaded のみ）→未確認除外→所属外 confirm 拒否→権限なし 403。S3 は既存テスト基盤（minio/setup.ts）を利用、presigned は依存スタブ or 実 MinIO。
- [x] 19. テストフィクスチャ更新（`PhotoMeta` に part/step 追加に伴う既存 `secondBody`/`firstBody` の photos 修正）。

### H. 検証
- [x] 20. `npx tsc --noEmit` PASS（client 側 aspida 連動も型崩れなしを確認）。
- [x] 21. `npm test` 全 PASS、coverage All files 100% 維持。
- [x] 22. `npx eslint`（変更ファイル）クリーン。`npm run lint`（prisma format）後、schema の意図しない差分がないこと。

### I. ドキュメント
- [x] 23. `construction/U4/code/u4-summary.md` 作成。`aidlc-state.md` / `audit.md` 更新。

## Security Baseline コンプライアンス
- presigned URL 発行前のサーバ認可（BR-P2, fail-closed）を controller(L1) + useCase(L2) の多層で強制。
- 非公開バケット・presigned 経由のみ（BR-P1）。`pending` 写真の URL 非発行・一覧除外（BR-P9 / INV-P3）。
- 入力検証（`image/*`・境界付き文字列, BR-P15）。所属外 photoId 拒否（BR-P10）。監査記録（BR-P14）。
- at-rest 暗号化・CORS・バケットポリシーはインフラ層（Infra Design）。コードは `putSignedUrl` 追加のみ。

## PBT コンプライアンス（Full enforcement）
- 写真ライフサイクル不変条件 INV-P1 / INV-P3 を fast-check で検証（ステップ 17）。

## リスク・留意
- **既存 `PhotoMeta` 変更の波及**: `common/types/survey.ts` の旧 `PhotoMeta` を使う箇所（テストフィクスチャ・surveyUseCase・photoPort）を網羅修正。client 側 aspida 連動の型崩れに注意（ステップ20で確認）。
- **CORS（インフラ）**: クライアント直アップロードはバケット CORS 必須。コード範囲外だが Build and Test / デプロイ手順に明記。
- **マイグレーションは加法的**（既存データ非破壊）。
