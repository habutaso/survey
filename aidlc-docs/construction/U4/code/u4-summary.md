# U4 コード生成サマリ（画像管理 / 写真の S3 保存）

**ステージ**: CONSTRUCTION → U4 Code Generation（Part 2: Generation 完了）
**完了日時**: 2026-06-15T10:05+09:00
**担当ストーリー**: US-304 / US-305（FR-12・FR-13・FR-14 / SECURITY-01）
**設計**: `construction/U4/functional-design/*`、`construction/U4/infrastructure-design/infrastructure-design.md`
**計画**: `construction/plans/U4-code-generation-plan.md`
**設計判断**: Q-U4-1=A（presigned PUT）/ Q-U4-2=A（非公開・presigned のみ・サーバ認可）/ Q-U4-3=C（survey+part+step）/ Q-U4-4=B（pending→uploaded 確認方式）/ Q-U4-5=A（キー=`surveys/{surveyId}/{photoId}`、GET 24h / PUT 15分）

## ゴール（達成）
`photoPort` を no-op スタブから **presigned PUT URL 方式の本実装**へ置換。写真メタの永続化（Prisma `Photo`）、アップロード確認 API、認可付き閲覧 URL 取得 API を追加し、提出フローへ統合した。バイナリ本体は DB に持たず S3 に保持し、クライアントが presigned URL で直接 PUT する。

## 実装ファイル

### A. 型・定数・branded id
- `common/constants/index.ts`: `ID_NAME_LIST` に `'photo'` 追加（branded id 駆動）。`PHOTO_STATUS_LIST = ['pending','uploaded']` + `PHOTO_STATUS_NAMES`。
- `common/types/photo.ts`（新規）: `PhotoStatus` / `PhotoMeta`（fileName/contentType/part/step）/ `PhotoBase` / `PhotoDto` / `PhotoUploadTicket`（photoId+putUrl）/ `PhotoView`（photoId+getUrl+メタ）。
- `common/types/survey.ts`: 旧 `PhotoMeta` を `common/types/photo` 参照へ差替。`SubmissionPayload.photos?: PhotoMeta[]`。提出応答 `SubmissionResultDto = SurveyDetailDto & { photoUploadTickets: PhotoUploadTicket[] }`。
- `common/validators/photo.ts`（新規）: `photoMeta`（contentType=`image/*` 限定 BR-P15、fileName/part/step は境界付き文字列・null 許容）、`photoValidator.confirmBody`（`photoIds: brandedId.photo.dto[]` min(1)）。

### B. Prisma
- `prisma/schema.prisma`: `Photo` モデル追加（id/surveyId/part?/step?/fileName/contentType/s3Key/status/createdBy/createdAt/uploadedAt?、`@@index([surveyId])`、`onDelete: Cascade`）。`Survey.photos Photo[]` 加法的リレーション。enum は String カラム＋アプリ層 zod 検証（既存方針踏襲）。
- マイグレーション `20260615002626_add_photo`（加法的・既存データ非破壊）。

### C. S3 サービス
- `service/s3Client.ts`: `putSignedUrl(key, contentType, expiresIn=15分)` 追加（`PutObjectCommand` + presigner）。既存 `getSignedUrl`（GET 24h）を閲覧に流用。新規ランタイム依存なし。

### D. domain/photo（新規モジュール）
- `model/photoType.ts`: `PhotoEntity = PhotoBase & { id: EntityId['photo'] }`。
- `model/photoMethod.ts`（純粋）: `buildKey`（INV-P2）/ `create`（status=pending, BR-P7）/ `markUploaded`（冪等 INV-P1）/ `selectViewable`（uploaded のみ INV-P3）/ `assertAllFound`（所属検証 BR-P10）。
- `store/photoCommand.ts`: `create`（pending 作成・`uploadedAt: null` 固定＝BR-P7 不変条件）/ `markUploaded`（`updateMany where status=pending` で冪等、空配列 no-op）。
- `store/photoQuery.ts`: `listBySurvey` / `findByIds`（surveyId スコープ＝所属検証）。
- `store/toPhotoDto.ts`: Prisma 行 → `PhotoDto`（DateTime→epoch ms、status ナローイング）。
- `photoUseCase.ts`: `confirmUploaded`（L2 認可＋所属検証＋pending→uploaded 冪等＋監査 `photo.uploadConfirmed`、RepeatableRead Tx）/ `listForSurvey`（閲覧ロール認可＋uploaded のみ presigned GET 発行）。

### E. surveyUseCase 統合
- `domain/survey/ports/photoPort.ts`: 本実装。`persist(tx, surveyId, metas, actor)` が Photo(pending) 作成＋presigned PUT URL（15分）発行 → `PhotoUploadTicket[]`。依存 `depend({ genId(ULID), now, signPut })`。
- `domain/survey/surveyUseCase.ts`: `ingestSubmission` で `photoPort.persist(tx, saved.id, payload.photos ?? [], actor)` を呼び、応答に `photoUploadTickets` を同梱。写真登録は提出イベントに包含。

### F. API（frourio, `api/private/surveys/_surveyId@string/photos/`）
- `GET photos`（`controller.ts` + `index.ts`）: `photoUseCase.listForSurvey`。uploaded のみ presigned GET を返す（INV-P3）。
- `POST photos/confirm`（`controller.ts` + `index.ts`）: body=`photoIds`。L1 で submitter ロール強制（多層防御 BR-P2）→ `photoUseCase.confirmUploaded`。
- `npm run generate`（prisma + frourio `$server` + aspida `$api`）で型・ルート再生成済み（server/client 双方）。

### G. テスト
- `tests/unit/photoMethod.test.ts`（新規, 10 tests）: buildKey/create/markUploaded 冪等/selectViewable/assertAllFound + **PBT**（fast-check）INV-P1・INV-P3・冪等。
- `tests/api/private/surveys.test.ts`: 写真フロー結合 4 件追加 — 提出で PUT チケット発行→confirm→閲覧一覧（uploaded のみ）/ 再 confirm 冪等＋監査 2 件 / 所属外 photoId は 404（BR-P10）/ 権限なしは 403・viewer 閲覧可（BR-P2）/ 非画像 contentType は 400（BR-P15）。
- `tests/unit/surveyFixtures.ts`: `firstPayload` の `photos` を新 `PhotoMeta`（part/step 付き）へ更新。
- domain/photo の store/useCase/port は API 結合テスト経由でカバー。

## 検証結果
- `npx tsc --noEmit`: **PASS**。
- `npm test`（vitest run --coverage）: **21 ファイル / 171 テスト PASS**、coverage **All files 100%**（statements/branches/functions/lines）。domain/photo・common/photo・api photos すべて 100/100/100/100。
- `npx eslint`（全変更ファイル）: **クリーン**。
- `prisma format` 後の schema 差分 = **Photo モデル + Survey.photos リレーションのみ**（FirstSurvey/SecondSurvey の付随的整形は revert）。

## 適用した修正（前セッション生成物の検証で発見）
- `photoCommand.create` の `uploadedAt` を `e.uploadedAt === null ? null : new Date(...)` から `uploadedAt: null` へ（create は常に pending = BR-P7 不変条件、到達不能分岐を除去し branch 100%）。
- `vite.config.ts` `testTimeout` 15000→30000（U4 で結合テスト +4 によりスイートが成長し、magnito Cognito エミュレータの累積レイテンシで稀に 15s 超過。タイムアウトのみでロジック不具合は決定論的に失敗するため隠蔽されない）。
- `photoMethod.test.ts`: 未使用 `EntityId` import 削除、不要な型アサーション削除、`allUploaded` ヘルパー抽出で `max-nested-callbacks`(4→3) 解消。

## Security Baseline コンプライアンス
- **BR-P1/P2**: 非公開バケット・presigned のみ。発行前にサーバ認可（GET=L2 ロール、PUT confirm=L1+L2 submitter）を多層・fail-closed で強制。
- **BR-P3**: PUT 15分 / GET 24h。
- **BR-P9 / INV-P3**: pending は URL 非発行・一覧除外。
- **BR-P10**: 所属外 photoId は 404。**BR-P15**: `image/*`・境界付き文字列で入力検証。**BR-P14**: `photo.uploadConfirmed` 監査記録。
- at-rest 暗号化・CORS・パブリックアクセスブロックはインフラ層（Infra Design）。

## PBT コンプライアンス（Full enforcement）
- INV-P1（uploaded ⇔ uploadedAt）・INV-P3（pending は viewable に非含有）・markUploaded 冪等を fast-check で検証。

## 申し送り
- **CORS（インフラ）**: クライアント直 PUT のためバケット CORS（AllowedMethods PUT/GET、AllowedOrigins=フロントオリジン）が本番 IaC/コンソール・ローカル MinIO で必須。Build and Test / デプロイ手順に明記。
- **孤立 pending の TTL クリーンアップ**・S3 オブジェクト削除は OPERATIONS で具体化（本ユニット範囲外、`s3.delete` 利用可）。
- 次ユニット: **U5**（検索/一覧）→ U6f / U6u（クライアント同期・写真アップロード UI）。
