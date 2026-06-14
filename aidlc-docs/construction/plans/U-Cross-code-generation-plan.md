# U-Cross — コード生成計画（Code Generation Plan: 横断基盤）

本計画は U-Cross のコード生成の**単一の真実の源**です。Brownfield のため「生成」は既存ファイルの**修正**を含みます。下部の承認後に Part 2（実行）を行います。

## ユニット・コンテキスト
- **ユニット**: U-Cross — 横断（監査ログ・入力検証・暗号化標準・セキュアな既定動作）
- **ワークスペースルート**: `/root/environment/survey`（Brownfield モノレポ）
- **責務**: 監査ログ基盤、共通入力検証、グローバルエラーハンドラ精緻化＋セキュリティヘッダ、暗号化標準（サーバ at-rest はインフラ／クライアントは Web Crypto 標準[実装 U6f]）。
- **依存**: U0, U1 完了。後続 U2/U4/U5/U6f が本基盤を利用。
- **担当ストーリー**: US-801, US-803, US-804, US-806（既定動作）
- **設計入力**: `aidlc-docs/construction/U-Cross/functional-design/`（domain-entities / business-logic-model / business-rules）＋ `infrastructure-design/`（軽量）
- **確定判断**: Q1〜Q15 = すべて A

## ステージ評価（U-Cross）
| ステージ | 判定 |
|---|---|
| Functional Design | DONE（承認済み） |
| NFR Requirements / NFR Design | SKIP（Q15=A） |
| Infrastructure Design | DONE（軽量, 文書のみ） |
| Code Generation | EXECUTE（本計画） |

## 重要な制約（既存コードベース由来）
- **カバレッジ 100% 必須**（`vite.config.ts`: `domain/**`, `common/**`, `api/**/{controller,hooks,validators}.ts`）。`service/**`（`app.ts` 等）は対象外だが API テストで挙動を検証する。
- **エラーハンドラ**: 現状 `service/app.ts` `setErrorHandler` は「非GET→403 / GET→404」。本ユニットで**型ベース**（401/403/404/400/500）へ置換（BR-7）。`service/**` はカバレッジ対象外のため、純粋判定は service 配下に置きつつ API テストで全ステータスを検証する。
- **監査の追記専用**（BR-1）: アプリ経路は INSERT のみ。UPDATE/DELETE を実装しない。
- **PII 非保存**（BR-4）: `changes.before/after` はマスク値のみ。`summary`/アプリログに PII・トークンを出さない。
- **enum の扱い**: `action`/`outcome` は **DB は String カラム**で保持し、アプリ層で `AUDIT_ACTION_LIST`/`AUDIT_OUTCOME_LIST`（TS union＋zod）により検証（ユニット追加時の enum マイグレーション churn を回避）。
- **Prisma migrate**: `AuditLog` テーブル追加は**加法的（非破壊）**。`prisma migrate dev` を実行（U1 と同様、開発/テスト DB に対して）。
- **brandedId**: `ID_NAME_LIST` に `'auditLog'` を追加（ULID 採番、型/バリデータ自動駆動）。

---

## 生成ステップ（Part 2 で実行）

### Step 1: 共通定数・型（common）
- [ ] `server/common/constants/index.ts`: `ID_NAME_LIST` に `'auditLog'` を追加。`AUDIT_ACTION_LIST`（`auth.login`/`auth.failure`/`authz.failure`/`user.roles.change`/`survey.submit`/`survey.approve`/`survey.confirm`/`survey.reject`/`survey.officialJudgment`/`pii.change`）＋ `AUDIT_OUTCOME_LIST = ['success','failure']`、`DEFAULT_STRING_MAX`（既定文字列最大長, 例 1000）を追加。
- [ ] `server/common/types/audit.ts`（新規）: `AuditAction`/`AuditOutcome` 型、`FieldChange = { field; before; after }`、`AuditLogBase`（occurredAt/actorUserId|null/action/targetType/targetId|null/outcome/summary/changes|null）、`AuditLogDto = AuditLogBase & { id: DtoId['auditLog'] }`。

### Step 2: 共通バリデータ（common/validators）
- [ ] `server/common/validators/common.ts`（新規）: `percentage = z.number().min(0).max(100)`、`boundedString = (max=DEFAULT_STRING_MAX) => z.string().max(max)`、`numberInRange = (min,max) => z.number().min(min).max(max)`、`epochMs = z.number().int().nonnegative()`。
- [ ] `server/common/validators/audit.ts`（新規）: `auditActionValidator = z.enum(AUDIT_ACTION_LIST)`、`auditOutcomeValidator = z.enum(AUDIT_OUTCOME_LIST)`（境界検証・後続利用）。

### Step 3: ドメイン例外（service）
- [ ] `server/service/customAssert.ts`: `ValidationError extends CustomError`、`UnauthorizedError extends CustomError` を追加（既存 `ForbiddenError`/`NotFoundError` と合わせて型体系を確立）。

### Step 4: 監査モデル（audit model, 純粋・L2）
- [ ] `server/domain/audit/model/auditType.ts`（新規）: `AuditLogEntity = AuditLogBase & { id: EntityId['auditLog'] }`。
- [ ] `server/domain/audit/model/auditMethod.ts`（新規）:
  - `maskValue(value): string`（PII マスク, 例 email→`***@***`, それ以外→`***`）。
  - `toFieldChanges(before, after, fieldSpecs): FieldChange[]`（変更フィールドのみ抽出、`fieldSpecs[field].pii` が真ならマスク, BR-4）。
  - `create(event): AuditLogEntity`（id 採番＝`brandedId.auditLog.entity.parse(ulid())`、`occurredAt=Date.now()`、`outcome` 既定 `success`、`changes` 既定 `null`）。

### Step 5: 監査ストア（audit store）
- [ ] `server/domain/audit/store/toAuditLogDto.ts`（新規）: prisma `AuditLog` → `AuditLogDto`（`occurredAt` は `DateTime`→epoch ms、`changes` は `Json`→`FieldChange[]|null`、`action`/`outcome` は String→union キャスト）。
- [ ] `server/domain/audit/store/auditCommand.ts`（新規）: `save(tx, entity): Promise<AuditLogDto>` = `tx.auditLog.create({...}).then(toAuditLogDto)`（**INSERT のみ**, BR-1）。

### Step 6: 監査ユースケース（audit usecase）
- [ ] `server/domain/audit/auditUseCase.ts`（新規）: `record(client, event): Promise<AuditLogDto>`（`client: Prisma.TransactionClient`。呼出元 tx に参加。失敗記録など tx 文脈の無い場合は `prismaClient` を渡す）。内部で `auditMethod.create(event)` → `auditCommand.save(client, entity)`。

### Step 7: グローバルエラーハンドラ精緻化＋ヘッダ（service）
- [ ] `server/service/errorHandler.ts`（新規, 純粋判定）: `resolveHttpStatus(err): number`（`UnauthorizedError`→401 / `ForbiddenError`→403 / `NotFoundError`→404 / `err.validation` または `ValidationError`→400 / それ以外→500）、`resolveBody(err, status)`（`CustomError`→message / それ以外→一般メッセージのみ・詳細秘匿）。
- [ ] `server/service/app.ts`: `setErrorHandler` を型ベースへ置換。403/500 時は `auditUseCase.record(prismaClient, { action: 'authz.failure'(403) , outcome:'failure', actorUserId: req.user?.id ?? null, ... })` を best-effort 記録（記録失敗は本処理を妨げない）。`helmet` 設定を強化（HSTS/noSniff/frameguard 等を明示）。CSP は Next.js 側付与の方針コメントを残す（prod proxy の CSP 除去と整合）。

### Step 8: 認証 hooks の失敗記録（api/private）
- [ ] `server/api/private/hooks.ts`: `jwtVerify` 失敗の catch で `auditUseCase.record(prismaClient, { action:'auth.failure', outcome:'failure', actorUserId:null, targetType:'auth', summary:'認証失敗' })` を best-effort 記録してから 401 応答（既存挙動維持）。

### Step 9: U1 監査呼出点の接続（domain/user）
- [ ] `server/domain/user/userUseCase.ts`: `assignRoles` の保存後に同一 `tx` で `auditUseCase.record(tx, { action:'user.roles.change', actorUserId:actor.id, targetType:'user', targetId:payload.userId, outcome:'success', changes:[{ field:'roles', before: target.roles.join(','), after: <saved>.roles.join(',') }] })` を記録（roles は非 PII のためマスク不要）。U1 のコメント呼出点を実体化。
- [ ] （任意）`server/api/session/controller.ts`: ログイン成功時に `auth.login` を best-effort 記録（実装が軽微な場合のみ。困難なら後続へ）。

### Step 10: Prisma スキーマ＋マイグレーション
- [ ] `server/prisma/schema.prisma`: `model AuditLog { id String @id; occurredAt DateTime; actorUserId String?; action String; targetType String; targetId String?; outcome String; summary String; changes Json? }`（加法的）。
- [ ] `prisma migrate dev --name add_audit_log` を実行（非破壊・加法的）。`prisma generate` で型反映。

### Step 11: テスト（カバレッジ 100% ＋ PBT）
- [ ] `server/tests/unit/auditMethod.test.ts`（新規）: `maskValue`、`toFieldChanges`（PII/非PII・変更/未変更）、`create`（既定値/ID）。PBT: **INV-A**（出力に PII 実体を含めない）。
- [ ] `server/tests/unit/validators.test.ts`（新規）: `percentage`/`boundedString`/`numberInRange`/`epochMs` の境界、`auditActionValidator`/`auditOutcomeValidator`。
- [ ] `server/tests/unit/errorHandler.test.ts`（新規, service 配下ロジックの単体）: `resolveHttpStatus`/`resolveBody` の網羅（**INV-B/INV-C**、401/403/404/400/500 と秘匿）。
- [ ] `server/tests/api/private/audit.test.ts`（新規, 実サーバ＋DB）: ロール変更で `user.roles.change`（success）が記録される／認可失敗で `authz.failure`（failure）が記録される／`NotFoundError` が **404** になる（U-Cross 精緻化）／認証失敗で `auth.failure` が記録される。`prismaClient.auditLog` を直接参照して検証。**INV-D**（記録後に該当行が存在し、アプリに UPDATE/DELETE 経路が無い）。
- [ ] 既存テスト（U1 `users.test.ts`、`index.test.ts`）の期待値整合を確認（NotFound は 404 へ変化する可能性に留意し更新）。

### Step 12: ドキュメント生成（サマリ）
- [ ] `aidlc-docs/construction/U-Cross/code/u-cross-summary.md`: 変更/新規ファイル一覧、検証結果（typecheck/coverage/test）、残作業・申し送り。

### Step 13: 型・健全性確認
- [ ] `server`: `npm run generate`（prisma/frourio）＋ `npx aspida`（必要時）＋ `tsc --noEmit` = PASS。
- [ ] `npm test`（vitest + coverage）= 全 PASS・カバレッジ 100%（docker compose スタックで実行）。

---

## ストーリー・トレーサビリティ
| ストーリー | 内容 | ステップ |
|---|---|---|
| US-801 | 入力検証 | Step 2, 11 |
| US-803 | 監査ログ | Step 1,4,5,6,7,8,9,11 |
| US-804 | 暗号化（標準/posture） | Infra 設計＋（クライアント実装は U6f） |
| US-806 | セキュア既定動作 | Step 3,7,11 |

## 依存・インターフェイス（後続ユニット向け）
- 公開: `auditUseCase.record(client, event)`、`AuditAction`/`AuditOutcome`/`FieldChange`、`auditMethod.{toFieldChanges, maskValue}`、共通バリデータ（`percentage` 等）、`ValidationError`/`UnauthorizedError`＋統一エラーハンドラ、`LocalCryptoStandard`（U6f 実装向け仕様; 本コードでは型/定数のみ）。
- U2: 状態遷移・PII・正式判定で `auditUseCase.record` を呼ぶ。
- U6f: `LocalCryptoStandard` に従い IndexedDB を暗号化。

## 安全性・備考
- `prisma migrate dev` は加法的（`AuditLog` 追加）。テスト DB は `migrate reset` 前提。
- 監査記録は best-effort（記録失敗が業務処理を巻き込まない）かつ、状態遷移系は同一 tx で原子的に記録（U2 以降）。U1 ロール変更は同一 tx で記録。
- 暗号化はサーバ at-rest をインフラ層に委譲（コード追加なし）。クライアントは標準のみ（実装 U6f）。
- Brownfield 規約: 既存ファイルは in-place 修正。`fast-check` は U1 で導入済み。
