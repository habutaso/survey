# U-Cross コード生成サマリ（横断: 監査ログ・入力検証・暗号化・セキュア既定）

- **ユニット**: U-Cross — 横断基盤
- **担当ストーリー**: US-801（入力検証）, US-803（監査ログ）, US-804（暗号化）, US-806（セキュア既定動作）
- **実行日時**: 2026-06-13T23:30+09:00
- **計画**: `aidlc-docs/construction/plans/U-Cross-code-generation-plan.md`（Steps 1–13）
- **設計**: `construction/U-Cross/functional-design/` ＋ `construction/U-Cross/infrastructure-design/`（軽量）
- **確定判断**: Q1〜Q15 = すべて A

## 実装概要
監査ログ基盤（PostgreSQL `auditLog`・追記専用・PII マスク）、グローバルエラーハンドラの型別 HTTP マッピング精緻化（401/403/404/400/500・fail closed）、認証/認可失敗の監査記録、共通入力検証プリミティブ、セキュリティヘッダ強化を実装。暗号化はサーバ at-rest をインフラ層に委譲、クライアントは標準（Web Crypto AES-GCM 256）を定義（実装は U6f）。

## 新規ファイル
| ファイル | 内容 |
|---|---|
| `server/common/types/audit.ts` | `AuditAction`/`AuditOutcome`/`FieldChange`/`AuditLogBase`/`AuditLogDto` |
| `server/common/validators/common.ts` | `percentage`/`boundedString`/`numberInRange`/`epochMs` |
| `server/common/validators/audit.ts` | `auditActionValidator`/`auditOutcomeValidator` |
| `server/domain/audit/model/auditType.ts` | `AuditLogEntity` |
| `server/domain/audit/model/auditMethod.ts` | `maskValue`/`toFieldChanges`（entries 方式）/`create` |
| `server/domain/audit/store/toAuditLogDto.ts` | prisma `AuditLog`→`AuditLogDto` |
| `server/domain/audit/store/auditCommand.ts` | `save`（INSERT のみ, `Prisma.JsonNull`） |
| `server/domain/audit/auditUseCase.ts` | `record(client, event)`（tx 参加） |
| `server/service/errorHandler.ts` | `resolveHttpStatus`/`resolveBody`/`GENERIC_ERROR_MESSAGE` |
| `server/prisma/migrations/20260613142321_add_audit_log/migration.sql` | `AuditLog` テーブル追加（加法的） |
| `server/tests/unit/auditMethod.test.ts` | 単体＋PBT（INV-A） |
| `server/tests/unit/validators.test.ts` | 共通/監査バリデータ境界 |
| `server/tests/unit/errorHandler.test.ts` | INV-B/INV-C（マッピング・秘匿） |
| `server/tests/api/private/audit.test.ts` | 監査記録の統合検証（success/authz.failure/auth.failure） |

## 変更ファイル
| ファイル | 変更点 |
|---|---|
| `server/common/constants/index.ts` | `ID_NAME_LIST += 'auditLog'`、`AUDIT_ACTION_LIST`/`AUDIT_OUTCOME_LIST`/`DEFAULT_STRING_MAX` 追加 |
| `server/service/customAssert.ts` | `ValidationError`/`UnauthorizedError` 追加（型体系の確立） |
| `server/service/app.ts` | `setErrorHandler` を型ベースへ置換（403 で `authz.failure` 監査・500 で詳細秘匿）、`helmet` 強化（CSP は Next 側、HSTS/noSniff/frameguard 明示） |
| `server/api/private/hooks.ts` | 認証失敗時に `auth.failure` を監査記録してから 401 |
| `server/domain/user/userUseCase.ts` | `assignRoles` の保存後に同一 tx で `user.roles.change` を監査記録（U1 呼出点の実体化） |
| `server/prisma/schema.prisma` | `model AuditLog` 追加 |

> 生成物（`.gitignore` 済）: `$server.ts`/`$relay.ts`/`$api.ts` は frourio＋aspida で再生成。

## 設計判断の反映
- **監査保存先・改ざん耐性（Q1=A）**: PostgreSQL `auditLog`、アプリは INSERT のみ（UPDATE/DELETE 経路なし）。ハッシュチェーンは MVP 非導入。
- **記録連携（Q2=A）**: 汎用 `auditUseCase.record(client, event)`。失敗は U-Cross（hooks/エラーハンドラ）、状態遷移等は各ユニットが呼出。
- **スキーマ（Q3=A）/ PII（Q4=A）**: actor/action/target/outcome/summary ＋ マスク済 `changes`。IP/UA は不記録。`before/after` に PII 実体を保存しない（マスク値のみ）。
- **失敗記録（Q5=A）/ 保持（Q6=A）**: 失敗は記録のみ（アラートは OPERATIONS）、恒久保持。
- **エラー→HTTP（Q7=A, Q8=A）**: 型別マッピング。`NotFoundError` は U1 の 403 から **404** に是正。500 は一般メッセージのみ（詳細秘匿, fail closed）。
- **ヘッダ（Q9=A）**: API は helmet 強化、HTML CSP は Next.js（U6u）。prod proxy の CSP 除去と整合。
- **検証（Q10=A, Q11=A）**: 共通プリミティブを集約、ドメイン固有は U2/U3。インジェクション対策は Prisma パラメタライズドのみ（明文化）。
- **暗号化（Q12=A, Q13=A, Q14=A）**: サーバ at-rest/TLS はインフラ層（コード追加なし）。クライアントは AES-GCM 256 標準（実装 U6f）、セッション一時鍵・同期後消去。

## 検証結果
- **型チェック**: `npx tsc --noEmit` = **PASS（0 errors）**。
- **テスト**: `npm test`（vitest + coverage）= **53 tests passed / 9 files**。
- **カバレッジ**: 対象（`api/**/{controller,hooks,validators}.ts`, `common/**`, `domain/**`）で **statements/branches/functions/lines = 100%**。
- **マイグレーション**: `20260613142321_add_audit_log` を適用済み（加法的）。
- **エミュレータ**: docker compose（postgres/magnito/minio/inbucket）で実行。

## 不変条件（テスト済）
- **INV-A**（マスク不可逆）: `toFieldChanges` の PII 出力に実体を含めない（PBT, `auditMethod.test.ts`）。
- **INV-B**（マッピング網羅）: 例外型 → 一意な HTTP（`errorHandler.test.ts`）。
- **INV-C**（fail closed）: 500 は一般メッセージのみ・詳細秘匿（`errorHandler.test.ts`）。
- **INV-D**（追記専用）: 監査は INSERT のみ（`auditCommand` に UPDATE/DELETE 経路なし、API テストで記録存在を確認）。

## 後続ユニットへの公開インターフェイス
- `auditUseCase.record(client, event)` / `AuditAction` / `AuditOutcome` / `FieldChange` / `auditMethod.{toFieldChanges, maskValue}`
- 共通バリデータ（`percentage`/`boundedString`/`numberInRange`/`epochMs`）
- `ValidationError` / `UnauthorizedError`（＋既存 `ForbiddenError`/`NotFoundError`）と統一エラーハンドラ
- 暗号化標準（クライアント, 実装は U6f）

## 残作業 / 申し送り
- **監査の呼出接続**: 状態遷移（提出/承認/確定/差戻し）・正式判定・PII 変更の `record` 呼出は **U2** で接続（`survey.*`/`pii.change`）。PII 変更は `auditMethod.toFieldChanges(entries, pii=true)` でマスク。
- **auth.login（成功）**: 本ユニットでは未記録（session POST が user を解決しないため）。必要なら U1/セッション側で後続対応。
- **クライアント暗号化の実装**: `LocalCryptoStandard` に従い **U6f** で実装。
- **at-rest 暗号化・TLS・監査 DB 権限分離・アラート**: インフラ/運用（OPERATIONS）で適用（`infrastructure-design.md` 参照）。
- **ローカル環境**: API テストは docker compose スタック必須。`client/.env`/`server/.env`（gitignore 済）を使用。
