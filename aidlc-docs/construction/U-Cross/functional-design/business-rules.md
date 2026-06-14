# U-Cross ビジネスルール（Functional Design: 横断基盤）

確定回答（Q1〜Q15＝すべて A）に基づく横断基盤のルール群。SECURITY-01/04/05/09/13/14/15・NFR-08/05 に準拠。

## BR-1. 監査ログは追記専用（Append-Only / Q1=A, NFR-08, SECURITY-13）
- 監査記録はアプリ経路で **INSERT のみ**。UPDATE/DELETE を行うコードを設けない。
- 保存先は PostgreSQL `auditLog` テーブル。MVP ではハッシュチェーン等の暗号学的改ざん検知は導入しない（追記専用運用＋DB アクセス制御で担保）。

## BR-2. 監査の記録対象（NFR-08 / SECURITY-13）
以下を監査対象とする（`AuditAction`）:
- 認証成功/失敗、認可失敗
- ロール変更（実施者・対象・前後 roles）
- 状態遷移（提出・承認・確定・差戻し）、正式判定の選択
- 被災者 PII の変更
> 各レコードは実施者（`actorUserId`）・発生時刻（`occurredAt`）・対象（`targetType`/`targetId`）・結果（`outcome`）を含む。変更系は `changes`（マスク済 before/after）を含む。

## BR-3. 記録の連携方式（Q2=A）
- U-Cross は汎用 `auditUseCase.record(tx, event)` を提供する。
- **U-Cross が直接記録**: 認証失敗（`auth.failure`）・認可失敗（`authz.failure`）。認証 hooks／グローバルエラーハンドラと連携。
- **各ユニットが記録呼出**: 状態遷移・正式判定・PII 変更・ロール変更。記録は原則として当該操作と**同一トランザクション**（`tx`）で行い、操作と監査の原子性を担保する。

## BR-4. 監査における PII 非保存・マスク（Q4=A / SECURITY-14）
- `changes.before/after` には **PII 実体を保存しない**。PII フィールドはマスク値のみ（例: `email: '***@***'`、住所/氏名: `'***'`）。非 PII フィールドは実値可。
- `summary` その他のテキストに PII を含めない。
- 構造化アプリログ（stdout）にも PII・認証トークンを出力しない（SECURITY-03/14）。
- 「変更があった事実とフィールド名」は残し、追跡性とプライバシー保護を両立する。

## BR-5. 認証/認可失敗の扱い（Q5=A）
- 失敗は `outcome=failure` で `auditLog` に**記録のみ**。外部アラート連携（メール/SNS 等）は OPERATIONS フェーズへ保留。
- 認可失敗は ForbiddenError 由来（403）、認証失敗は hooks 由来（401）として記録（BR-7 と整合）。

## BR-6. 監査ログの保持（Q6=A / SECURITY-14）
- MVP は**恒久保持**（自動削除しない）。保持期間ポリシー・アーカイブは運用で別途定義（OPERATIONS）。

## BR-7. エラー→HTTP マッピングと秘匿（Q7=A, Q8=A / SECURITY-15）
- 例外型に応じて HTTP ステータスを決定する（fail closed）:

| 区分 | 例外/契機 | HTTP | ボディ |
|---|---|---|---|
| 認証失敗 | hooks の `jwtVerify` 失敗 / `UnauthorizedError` | 401 | 安全なメッセージ |
| 認可失敗 | `ForbiddenError` | 403 | 安全なメッセージ（＋`authz.failure` 記録） |
| 対象不在 | `NotFoundError` | 404 | 安全なメッセージ |
| 入力検証失敗 | zod schema validation / `ValidationError` | 400 | 安全なメッセージ |
| 未分類例外 | 上記以外 | 500 | 一般メッセージのみ（内部詳細・スタック秘匿） |

- `CustomError` 系のみ message を送出。それ以外（500）はスタック・内部情報を漏らさず、サーバログ＋監査（failure）に記録。
- これにより U1 で PATCH 時に 403 となっていた `NotFoundError` は **404** に精緻化される。
- いかなる例外でも「許可」側へフォールバックしない（fail closed）。

## BR-8. セキュリティヘッダ（Q9=A / SECURITY-04）
- API サーバ（Fastify）は `helmet` を踏襲・強化（HSTS・X-Content-Type-Options: nosniff・frameguard 等の既定を明示）。
- HTML の CSP は Next.js 側（U6u）で付与する役割分担。U-Cross は API のヘッダ方針を定義。
- prod の `@fastify/http-proxy` が `content-security-policy` を除去している現状は、CSP をフロント配信（Next.js）側で付与する設計と整合（U6u で具体化）。

## BR-9. 入力検証規約（Q10=A / SECURITY-05）
- すべての API 入力は controller の zod `validators` で**境界検証**してから UseCase に渡す。
- 数値入力（損傷率 0–100%・浸水深等）は範囲・型・最大長を厳格に検証。共通プリミティブ（`percentage` 等）を U-Cross が提供し、ドメイン固有は各ユニットが援用定義。
- 文字列は既定最大長（`DEFAULT_STRING_MAX`）を適用し、未指定の無制限長を避ける。

## BR-10. インジェクション対策（Q11=A / SECURITY-05）
- SQL は Prisma（パラメタライズド）のみを使用し、raw SQL を用いない。
- 出力はフレームワークのエスケープに委ねる。追加実装は不要で、本規約として遵守する。

## BR-11. 暗号化（保存時/通信時/ローカル, Q12=A, Q13=A, Q14=A / SECURITY-01, NFR-05）
- **サーバ at-rest/通信**: PostgreSQL・S3 の保存時暗号化と TLS はインフラ層で担保（Infrastructure Design 軽量文書に posture 記載）。サーバでのフィールドレベル暗号化は行わない。
- **クライアントローカル**: ブラウザ IndexedDB の PII・画像は **Web Crypto AES-GCM 256・レコード毎ランダム IV** で暗号化（標準は U-Cross が定義、実装は U6f）。
- **鍵ライフサイクル**: セッション単位の一時鍵をメモリ保持し永続化しない。ログアウト/セッション終了で破棄。同期成功確認後にローカル PII・画像を消去（喪失防止のため同期成功確認前は消去しない）。共用端末を前提とする。

## BR-12. セキュアな既定（デモ削除との整合, SECURITY-09）
- デモ用 Task/User の削除は U0 で完了済み。本番エラーは詳細を秘匿（BR-7）。U-Cross は「既定でセキュア」を担保する横断ルールを提供する。

## BR-13. 不変条件（テスト対象）
- INV-A（マスク不可逆）: `toFieldChanges` 出力に PII 実体を含めない。
- INV-B（マッピング網羅）: 既知例外型 → 一意な HTTP（401/403/404/400/500）。
- INV-C（fail closed）: 未分類例外は常に 500＋詳細秘匿。
- INV-D（追記専用）: 監査は INSERT のみ（UPDATE/DELETE 経路が存在しない）。
