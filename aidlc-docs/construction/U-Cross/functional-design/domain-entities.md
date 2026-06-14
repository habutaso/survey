# U-Cross ドメインエンティティ（Functional Design: 横断基盤）

確定回答（Q1=A, Q2=A, Q3=A, Q4=A, Q5=A, Q6=A, Q7=A, Q8=A, Q9=A, Q10=A, Q11=A, Q12=A, Q13=A, Q14=A, Q15=A）に基づく、横断ユニットの技術非依存ドメインモデル。型表現は既存 CATAPULT 規約（`XxxBase`/`XxxDto`/`XxxEntity`、Branded ID、zod、`ID_NAME_LIST` 駆動）に準拠。

## 1. 監査ログ（Audit Log）

### 1.1 AuditLog エンティティ
追記専用（append-only）の監査記録。アプリは INSERT のみを行い、UPDATE/DELETE しない（Q1=A）。

```
AuditLogBase = {
  occurredAt: number              // 発生時刻（epoch ms）
  actorUserId: DtoId['user'] | null // 実施者（システム/未認証は null）
  action: AuditAction             // 監査アクション（enum）
  targetType: string              // 対象種別（例: 'survey', 'user'）
  targetId: string | null         // 対象ID（無い場合 null）
  outcome: AuditOutcome           // 'success' | 'failure'
  summary: string                 // 人間可読の要約（PII を含めない）
  changes: FieldChange[] | null   // 変更系のみ（マスク済 before/after）
}
AuditLogDto    = AuditLogBase & { id: DtoId['auditLog'] }
AuditLogEntity = AuditLogBase & { id: EntityId['auditLog'] }
```
- ID 名 `auditLog` を `common/constants` の `ID_NAME_LIST` に追加（ULID 採番、brandedId が型/バリデータを駆動）。
- `ipAddress`/`userAgent` は記録しない（Q3=A）。

### 1.2 AuditAction（enum, 拡張可能）
横断基盤として最小集合を定義し、後続ユニットが利用する。
| 値 | 用途 | 主な発生元 |
|---|---|---|
| `auth.login` | ログイン成功 | U1 |
| `auth.failure` | 認証失敗（トークン無効/失効） | U-Cross（hooks/handler 連携） |
| `authz.failure` | 認可失敗（権限不足） | U-Cross（グローバルエラーハンドラ） |
| `user.roles.change` | ロール変更 | U1（`assignRoles` 呼出点） |
| `survey.submit` | 提出（下書き→提出） | U2 |
| `survey.approve` | 承認 | U2 |
| `survey.confirm` | 確定 | U2 |
| `survey.reject` | 差戻し | U2 |
| `survey.officialJudgment` | 正式判定の選択 | U2 |
| `pii.change` | 被災者 PII 変更 | U2 |
> enum は文字列リテラル集合（`AUDIT_ACTION_LIST`）として `common/constants` に定義。後続ユニットが値を追記してよい（U-Cross は基盤と最小集合のみ確定）。

### 1.3 AuditOutcome
- `AUDIT_OUTCOME_LIST = ['success', 'failure'] as const`、`AuditOutcome = (typeof ...)[number]`。

### 1.4 FieldChange（マスク済 before/after, Q4=A）
PII 実体を保存せず、変更フィールド名とマスク値のみ記録。
```
FieldChange = {
  field: string      // 変更フィールド名（例: 'email', 'address'）
  before: string     // マスク済の旧値（例: '***@***'、非PIIはそのまま可）
  after: string      // マスク済の新値
}
```
- マスク方針は business-rules（BR-4）参照。状態遷移など値変更のないアクションは `changes = null`。

### 1.5 永続化（Prisma, Code Generation 段階）
- `model AuditLog`（PostgreSQL）。`changes` は `Json?`。`actorUserId`/`targetId` は nullable string。`action`/`outcome` は enum または string。
- アプリ経路は INSERT のみ（追記専用運用, Q1=A）。保持は恒久（MVP, Q6=A、削除ジョブなし）。

## 2. エラー分類（Secure Defaults / Q7=A, Q8=A）

### 2.1 ドメイン例外の体系（`service/customAssert` 拡張）
既存の `CustomError`（基底）/ `ForbiddenError` / `NotFoundError` に加えて分類を整理。
| 例外型 | 継承 | HTTP | message 送出 |
|---|---|---|---|
| `ValidationError` | `CustomError` | 400 | あり（一般化されたメッセージ） |
| `UnauthorizedError` | `CustomError` | 401 | あり |
| `ForbiddenError`（U1 既存） | `CustomError` | 403 | あり |
| `NotFoundError`（U1 既存） | `CustomError` | 404 | あり |
| 上記以外（未分類例外） | — | 500 | なし（一般メッセージのみ・詳細秘匿） |
- 入力検証失敗（fastify/zod の schema validation）は 400 として扱う（`validatorCompiler` の失敗を分類）。
- `CustomError` 系は安全なメッセージのみ送出。それ以外は内部詳細・スタックを秘匿（fail closed, Q8=A）。

### 2.2 ErrorResponse（概念）
- 利用者向けボディは「一般化メッセージ文字列」または無し。内部詳細・PII・スタックを含めない。

## 3. 入力検証プリミティブ（US-801 / SECURITY-05 / Q10=A）
U-Cross が提供する再利用バリデータ（`common/validators` に集約）。ドメイン固有値は各ユニットで定義。
| プリミティブ | 定義 | 用途 |
|---|---|---|
| `percentage` | `z.number().min(0).max(100)` | 損傷率・損害割合（U3） |
| `boundedString(max)` | `z.string().max(max)` ヘルパー | 文字列最大長の既定適用 |
| `numberInRange(min,max)` | 数値範囲ヘルパー | 浸水深等（ドメイン側で min/max 指定） |
| `isoDate` / `epochMs` | 日付/時刻の型・範囲 | 共通日時 |
- 文字列の既定最大長（`DEFAULT_STRING_MAX`）を定数化し、各バリデータが援用する。

## 4. 暗号化標準（US-804 / SECURITY-01 / Q12=A, Q13=A, Q14=A）

### 4.1 サーバ at-rest / 通信（Q12=A）
- PostgreSQL・S3 の保存時暗号化、TLS はインフラ層（マネージド/設定）で担保。**U-Cross のコード成果物には含めない**（Infrastructure Design 軽量文書に posture を記載）。
- サーバでの PII フィールドレベル暗号化は行わない（at-rest＋アクセス制御で保護）。

### 4.2 クライアントローカル暗号化標準（Q13=A, 仕様のみ・実装は U6f）
ブラウザ IndexedDB に保持する PII・画像の保護仕様。実装は U6f。
```
LocalCryptoStandard = {
  algorithm: 'AES-GCM'
  keyLength: 256            // bits
  ivBytes: 12               // ランダム IV（レコード毎）
  api: 'Web Crypto (SubtleCrypto)'
}
```

### 4.3 ローカル鍵ライフサイクル（Q14=A）
- セッション単位の**一時鍵**をメモリ保持。永続化しない。
- ログアウト/セッション終了で鍵を破棄。
- 同期成功確認後にローカル PII・画像を消去（喪失防止のため同期成功確認前は消去しない, SECURITY-01）。

## 5. エンティティ関連（概念）
```
[各ユニットの操作] --record--> [auditUseCase] --> [AuditLog(append-only, PostgreSQL)]
[認証失敗(hooks)] --record(auth.failure)-->
[認可失敗(global error handler)] --record(authz.failure)-->
[入力境界] --zod(共通プリミティブ＋ドメイン)--> [拒否(ValidationError→400)]
[ブラウザローカル] --LocalCryptoStandard(実装U6f)--> [暗号化IndexedDB]
```
- `auditLog` は U-Cross の中核エンティティ。`user`（U1）を実施者として参照、`survey` 等（U2+）を対象として参照する。
