# U-Cross ビジネスロジックモデル（Functional Design: 横断基盤）

監査記録・入力検証・セキュア既定動作・暗号化標準のビジネスロジック（技術非依存）。副作用は Store/Service/UseCase 境界に限定し、Model 層は純粋関数（既存 DDD ガイドライン準拠）。凡例: `tx: Prisma.TransactionClient`。

---

## 1. 監査ログ（`audit` ドメイン, Q1=A/Q2=A/Q3=A）

### 1.1 記録の共通インターフェイス（UseCase 境界）
```
auditUseCase.record(tx, event): Promise<void>
  event = {
    actorUserId: DtoId['user'] | null
    action: AuditAction
    targetType: string
    targetId?: string | null
    outcome: AuditOutcome            // 既定 'success'
    summary: string                  // PII を含めない
    changes?: FieldChange[] | null   // 変更系のみ（マスク済）
  }
```
- `tx` を受け取り、**呼出元のトランザクションに参加**して原子性を担保（状態遷移と監査記録が同一 tx）。失敗記録など tx 文脈が無い場合は `prismaClient` を用いた独立 INSERT を許容（オーバーロード）。
- 内部で `auditMethod.create(event)`（純粋・ID 採番/既定値補完）→ `auditCommand.save(tx, entity)`（INSERT のみ, Q1=A）。
- **DB が真実の源**。U-Cross は記録のみを提供し、参照（監査閲覧 UI）は本ユニットの責務外（必要なら後続）。

### 1.2 記録呼出の責務分担（Q2=A）
- **U-Cross が実装**: 認証失敗（`auth.failure`）・認可失敗（`authz.failure`）の記録。グローバルエラーハンドラ／認証 hooks の連携点で呼ぶ。
- **各ユニットが呼出**: 状態遷移（submit/approve/confirm/reject）・正式判定・PII 変更・ロール変更。U1 の `userUseCase.assignRoles` には既に呼出点コメントがあり、U-Cross 完了後に `auditUseCase.record(tx, { action:'user.roles.change', changes })` を接続する。

### 1.3 マスク生成（純粋, Q4=A）
```
auditMethod.toFieldChanges(before, after, fieldSpecs): FieldChange[]
```
- 変更のあったフィールドのみ抽出。各フィールドは `fieldSpecs` に従い PII か否かを判定し、PII は `maskValue()` でマスク（例: email→`***@***`、住所→`***`）、非 PII はそのまま記録。
- `summary` は件名のみ（例: 「調査 {id} を確定」）で PII を含めない。

### 1.4 失敗記録のフロー
```
[hooks] 認証失敗 → auditUseCase.record(prismaClient, { action:'auth.failure', outcome:'failure', actorUserId:null, summary:'認証失敗' }) → 401 応答
[global error handler] ForbiddenError → auditUseCase.record(..., { action:'authz.failure', outcome:'failure', actorUserId:req.user?.id ?? null }) → 403 応答
```
- アラートは MVP では行わず記録のみ（Q5=A）。保持は恒久（Q6=A）。

---

## 2. セキュアな既定動作（Q7=A/Q8=A/Q9=A）

### 2.1 グローバルエラーハンドラのマッピング（純粋判定）
`service/app.ts` の `setErrorHandler` を型ベースに精緻化。
```
resolveHttpStatus(err): number
  UnauthorizedError → 401
  ForbiddenError    → 403
  NotFoundError     → 404
  ValidationError / schema validation error → 400
  それ以外          → 500
```
```
resolveBody(err):
  err instanceof CustomError → 安全なメッセージ（一般化済）
  それ以外（500）           → 一般メッセージのみ（内部詳細/スタック秘匿, fail closed, Q8=A）
```
- 認可失敗（403）時は `authz.failure` を監査記録（§1.4）。500 はサーバログ＋監査（failure）に記録。
- fastify の `validatorCompiler`（zod safeParse 失敗）由来のエラーを 400（`ValidationError` 相当）に分類する。
- メソッド（GET/非GET）ベースの旧ヒューリスティックは廃し、型ベースへ置換。

### 2.2 セキュリティヘッダ（Q9=A）
- API サーバ（Fastify）は既存 `helmet` を踏襲・強化（HSTS・noSniff・frameguard 等の既定を明示）。
- HTML（CSP）は主に Next.js 側（U6u）で付与する役割分担。U-Cross は API サーバのヘッダ方針を定義。
- **既知事項**: prod では `@fastify/http-proxy` の `rewriteHeaders` が `content-security-policy` を `undefined` に上書きしている。CSP は Next.js（フロント配信）側で付与する前提のため整合（U6u で具体化）。

---

## 3. 入力検証基盤（Q10=A/Q11=A）

### 3.1 共通バリデータ（`common/validators`）
- `percentage`、`boundedString(max)`、`numberInRange(min,max)`、`isoDate`/`epochMs`、`DEFAULT_STRING_MAX` を提供（domain-entities §3）。
- **境界適用規約**: すべての API 入力は controller の `validators`（zod）で検証してから UseCase へ渡す（既存 frourio パターン）。数値（損傷率・浸水深）は範囲・型を厳格化。
- ドメイン固有バリデータ（浸水深レンジ・部位コード等）は U2/U3 で `common` プリミティブを援用して定義。

### 3.2 インジェクション対策（明文化のみ, Q11=A）
- SQL は Prisma（パラメタライズド）のみ。raw SQL を使用しない。
- 出力はフレームワーク（fastify/Next.js）がエスケープ。追加実装は不要で、規約として business-rules に明文化。

---

## 4. 暗号化標準（Q12=A/Q13=A/Q14=A）

### 4.1 サーバ（Q12=A）
- at-rest（PG/S3）・TLS はインフラ層で担保。U-Cross にサーバ暗号化コードは無し。Infrastructure Design（軽量）で posture を文書化。

### 4.2 クライアント標準（Q13=A, 実装は U6f）
- `LocalCryptoStandard`（AES-GCM 256 / ランダム IV / Web Crypto）を仕様として確定。U6f が `LocalDraftStore` に適用。
- 鍵ライフサイクル（Q14=A）: セッション一時鍵（メモリ）・ログアウトで破棄・同期成功確認後にローカル PII/画像消去・永続鍵なし。

---

## 5. データフロー要約
```
[操作/失敗] → auditUseCase.record(tx) → auditMethod.create → auditCommand.save(INSERT) → AuditLog
[例外] → global error handler → resolveHttpStatus/resolveBody → (403/500 は監査failure) → 応答
[入力] → controller zod(共通プリミティブ＋ドメイン) → 失敗は ValidationError(400)
[ローカル機微データ] → LocalCryptoStandard（U6f 実装, セッション鍵）→ 暗号化IndexedDB → 同期後消去
```

## 6. PBT/不変条件の候補（Code Generation で確定）
- INV-A（マスク不可逆）: `toFieldChanges` の出力に PII 実体（生 email/住所等）が含まれない。
- INV-B（エラーマッピング網羅）: 既知例外型 → 期待 HTTP ステータスが一意に決まる（401/403/404/400/500）。
- INV-C（fail closed）: 未分類例外は常に 500＋詳細秘匿（メッセージにスタック/内部情報を含めない）。
- INV-D（追記専用）: 監査記録は INSERT のみで既存レコードを変更しない（テストで UPDATE/DELETE 経路が無いことを担保）。

## 7. 後続ユニット向け公開インターフェイス
- `auditUseCase.record(tx, event)` / `AuditAction` / `AuditOutcome` / `FieldChange` / `auditMethod.toFieldChanges`・`maskValue`
- 共通バリデータ（`percentage` 等）と検証規約
- `ValidationError` / `UnauthorizedError`（＋既存 `ForbiddenError`/`NotFoundError`）と統一エラーハンドラ
- `LocalCryptoStandard`（U6f 実装向け仕様）
