# Build and Test Summary（CATAPULT / 住家被害認定調査アプリ）

全ユニット（U0〜U6u）の Code Generation 完了後の総括。

## Build Status
- **ビルドツール**: npm（Node v24+）モノレポ（root / client / server）。`Dockerfile` 単一コンテナデプロイ。
- **生成系**: Prisma + frourio(`$server`) + aspida(`$api`) + pathpida(`$path`) + hcm。
- **マイグレーション**: `add_user_roles` / `add_audit_log` / `add_survey` / `add_photo` / `add_survey_search_indexes`（すべて加法的・適用済み）。
- **状態**: 各ユニットのコード生成時に tsc/build を確認済み。フルビルドはローカル Docker Compose 前提（手順: `build-instructions.md`）。

## Test Execution Summary

### Unit Tests（自動・実行済み）
| 対象 | テスト | カバレッジ | 状態 |
|---|---|---|---|
| server（U0〜U5） | 24 ファイル / 201+ tests | All files **100%**（domain/common/api） | PASS |
| client（U6f） | localFirst（crypto/model/store/service） | **100%** | PASS |
| client（U6u） | survey/model（wizardSteps/display） | **100%** | PASS |
| **client 合計** | **8 ファイル / 61 tests** | 対象 **100%** | PASS |
- PBT（Full enforcement）: 計算不変条件（U3c INV-1〜8）、認可マトリクス（U1）、状態遷移/往復（U2）、写真（U4 INV-P1/P3）、CSV/スコープ（U5）、暗号往復・IV 一意・バックオフ（U6f INV-U6f-1/2/6/8）、ウィザード（U6u INV-U6u-1〜4）。
- typecheck（client/server）・lint（eslint/stylelint/prettier/prisma format）: エラー 0。

### Integration Tests
- サーバ結合（U2×U1×U-Cross×U3×U4×U5）は API テストで自動網羅（実 PostgreSQL/Cognito エミュレータ/MinIO）。
- クライアント⇔サーバ契約は aspida 共有型で **コンパイル時保証**（`npm run generate && npm run typecheck`）。
- 手動 E2E シナリオ 5 本（提出→承認→確定 / オフライン同期 / 第2次・正式判定・出力 / 認可 / ログアウトクリア）を `integration-test-instructions.md` に定義。
- **状態**: 自動結合 PASS。手動 E2E はローカル環境（`npm run notios`）で実施。

### Performance Tests
- 対象: 一覧/検索の応答性（NFR-03・検索インデックス済）、計算の決定論性（NFR-04・PBT）、オフライン同期（NFR-02）。
- **状態**: 指針定義（`performance-test-instructions.md`）。本番スケール SLA は OPERATIONS。

### Security Tests（Security Baseline 有効）
- 認証/認可（401/403/IDOR）、入力検証/インジェクション、暗号化（ローカル AES-GCM・S3 SSE/presigned・TLS）、監査ログ（追記専用・PII マスク）、セキュアな既定（helmet・fail closed・デモ削除）。
- **状態**: 自動テストで PASS、手動確認項目を `security-test-instructions.md` に定義。`npm audit` で依存確認。

### Additional Tests
- Contract: aspida 型契約（実質コンパイル時）— Pass。
- E2E（UI 自動）: 未導入（手動シナリオで代替・@testing-library 等は後続/OPERATIONS）。

## Overall Status
- **Build**: Success（手順整備済み・各ユニットで検証済み）。
- **All Tests**: Pass（自動: server 201+ / client 61、カバレッジ対象 100%）。
- **Ready for Operations**: Yes（残: 本番インフラ設定 — S3 CORS/SSE、Cognito、DATABASE_URL、TLS、継続監視は OPERATIONS）。

## 生成された指示書
- `build-instructions.md` / `unit-test-instructions.md` / `integration-test-instructions.md` / `performance-test-instructions.md` / `security-test-instructions.md` / `build-and-test-summary.md`

## Next Steps
全自動テスト PASS・カバレッジ対象 100%。OPERATIONS フェーズ（デプロイ計画・監視・本番インフラ設定）へ進行可能。
未コミットの変更（U4/U5/U6f/U6u）は、ユーザー要求時にコミット。
