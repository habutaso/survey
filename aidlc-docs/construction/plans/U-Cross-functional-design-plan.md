# U-Cross — 機能設計計画＋明確化質問（Functional Design Plan）

横断ユニット（監査ログ・入力検証・暗号化・セキュアな既定動作）の機能設計計画。下部の **[回答]** に記入いただいた後、機能設計アーティファクトを生成します。

## ユニット・コンテキスト
- **ユニット**: U-Cross — 横断（監査ログ・入力検証・暗号化・セキュア既定）
- **責務**: 監査ログ基盤（状態遷移・PII/確定変更・認証認可失敗の記録）、入力検証基盤（zod の境界適用・共通バリデータ）、暗号化基盤（保存時/通信時/ローカル PII・画像）、セキュアな既定動作（セキュリティヘッダ・エラー秘匿・fail closed・グローバルエラーハンドラ）。
- **依存**: U1 完了（認可基盤）。U-Cross は PostgreSQL（audit）を使用。後続 U2/U4/U5/U6f が本基盤を利用。
- **担当ストーリー**: US-801（入力検証）, US-803（監査ログ）, US-804（暗号化）, US-806（セキュア既定動作）
- **関連要件**: NFR-08, NFR-05 / SECURITY-01, 03/14, 04, 05, 09, 13, 15
- **既存コードの関連点**:
  - `service/app.ts` `setErrorHandler`：現状「非GET 例外→403 / GET 例外→404、`CustomError` のみ message 送出」。helmet 登録済み。prod は http-proxy が CSP ヘッダを除去。
  - `service/customAssert.ts`：`CustomError` / `ForbiddenError` / `NotFoundError`（U1 で追加）。
  - `api/private/hooks.ts`：認証失敗で 401。`userUseCase.assignRoles` に監査呼出点コメントあり（U1）。
  - `common/validators/*`：zod バリデータ。`vite.config` でカバレッジ 100%（`common/**`, `domain/**`, `api/**/{controller,hooks,validators}.ts`）。

## ステージ評価（U-Cross, 提案）
| ステージ | 判定（提案） |
|---|---|
| Functional Design | EXECUTE（本計画） |
| NFR Requirements / NFR Design | 提案 SKIP（本ユニットの機能設計が NFR/セキュリティ設計を内包） → **Q15 で確認** |
| Infrastructure Design | 提案 軽量実行（at-rest 暗号化・TLS・監査保護・アクセスログの posture を文書化） → **Q15 で確認** |
| Code Generation | EXECUTE（設計承認後） |

## 機能設計の作業計画（チェックボックス）
- [ ] 監査ログのドメインモデル（`AuditLog` エンティティ・`action` enum・`outcome`・before/after 方針）を定義
- [ ] 監査記録の共通インターフェイス（`auditUseCase.record` / 呼出規約・どのユニットが何を記録するか）を定義
- [ ] 監査の改ざん耐性・保持・PII 取扱い方針を business-rules 化
- [ ] 入力検証基盤（共通バリデータ群・境界適用規約・インジェクション対策方針）を定義
- [ ] 暗号化基盤（サーバ at-rest はインフラ／アプリ層スコープ、クライアント Web Crypto 標準・鍵ライフサイクル）を定義
- [ ] セキュアな既定動作（グローバルエラーハンドラの型別 HTTP マッピング、エラー秘匿、fail closed、セキュリティヘッダ）を定義
- [ ] PBT/不変条件の候補（該当する場合: 監査の不可改変性・エラーマッピングの網羅性 等）を特定
- [ ] 後続ユニット向け公開インターフェイスを整理

---

## 明確化質問（各 [回答] に記入してください）

### A. 監査ログ（US-803 / NFR-08 / SECURITY-13・14）

**Q1. 監査ログの保存先・改ざん耐性**
- A) PostgreSQL 専用 `auditLog` テーブル（アプリは INSERT のみ＝追記専用運用、UPDATE/DELETE しない）。MVP はこれで十分。
- B) A に加えてハッシュチェーン（各レコードに前レコードのハッシュを連結）で改ざん検知を付与。
- C) その他（記述）

[回答]:A

**Q2. 監査記録の連携方式（U-Cross が提供する共通 API）**
- A) U-Cross は汎用 `auditUseCase.record(event, tx)` を提供。認証/認可失敗の記録（グローバルエラーハンドラ/hooks 連携）は U-Cross が実装し、状態遷移・PII・確定・正式判定の記録呼出は各ユニット（U2 等）が行う。
- B) ドメインイベント購読の中央集権型（イベントバス）。
- C) その他

[回答]: A

**Q3. 監査レコードのスキーマ項目**
- A) `{ id, occurredAt, actorUserId, action(enum), targetType, targetId, outcome(success/failure), summary }` ＋ 変更系は `before/after`。`ipAddress`/`userAgent` は含めない。
- B) A ＋ `ipAddress` / `userAgent` も記録。
- C) その他

[回答]: A

**Q4. before/after に含まれる PII の扱い（SECURITY-13「前後値記録」と SECURITY-14「PII をログに出さない」の両立）**
- A) `before/after` には PII 実体を保存せず、変更フィールド名＋マスク値（例: `email: "***@***"`）のみ記録（追跡性は中、漏えいリスク低）。
- B) `before/after` に PII 実体を保存するが、`auditLog` はアクセス制御＋（任意で）アプリ層暗号化で保護。構造化アプリログ（stdout）には PII を一切出さない（追跡性は高、要保護）。
- C) その他

[回答]: A

**Q5. 認証/認可失敗の記録とアラート**
- A) 失敗は `auditLog` に `outcome=failure` で記録のみ（MVP）。外部アラート連携は OPERATIONS へ保留。
- B) 記録＋ログレベル warn 出力（外部ログ基盤がアラート化する前提）。
- C) その他

[回答]: A

**Q6. 監査ログの保持期間（SECURITY-14）**
- A) MVP は恒久保持（削除しない）。保持ポリシーは運用で別途。
- B) 期間を設定（例: ___ か月）。
- C) その他

[回答]: A

### B. セキュアな既定動作・エラーハンドラ（US-806 / SECURITY-04・09・15）

**Q7. グローバルエラーハンドラの HTTP ステータス・マッピング精緻化（現状: 非GET→403 / GET→404）**
- A) エラー型で判定: 認証失敗→401、`ForbiddenError`→403、`NotFoundError`→404、入力検証失敗→400、未分類例外→500。`CustomError` 系のみ message 送出、その他は一般メッセージ＋詳細秘匿（fail closed）。
- B) 現状の method ベースを踏襲し最小調整のみ。
- C) その他

[回答]: A

**Q8. 500（未分類例外）の応答**
- A) 利用者には一般メッセージのみ（例: 「予期しないエラーが発生しました」）。内部詳細・スタックは秘匿し、サーバログ＋監査（failure）に記録。
- B) その他

[回答]: A

**Q9. セキュリティヘッダ（CSP 等, SECURITY-04）の役割分担**
- A) API サーバ（Fastify/helmet）は既存 helmet を踏襲・強化（HSTS/noSniff/frameguard 等）。HTML の CSP は主に Next.js 側（U6u）で付与する役割分担とし、U-Cross は API サーバのヘッダ強化方針を定義（prod の http-proxy が CSP を除去する現状も整理）。
- B) U-Cross が API・HTML 双方の CSP を一元定義。
- C) その他

[回答]: A

### C. 入力検証基盤（US-801 / SECURITY-05）

**Q10. U-Cross が提供する共通バリデータの範囲**
- A) 再利用可能な共通バリデータ（例: `percentage`(0–100)、文字列最大長デフォルト、数値/日付範囲ヘルパー）と「境界での zod 適用」規約を U-Cross に集約。ドメイン固有（浸水深レンジ・部位コード等）は各ユニット（U2/U3）で定義。
- B) すべての入力バリデータを U-Cross に集約。
- C) その他

[回答]: A

**Q11. インジェクション対策の方針（明文化のみ／追加実装なしの想定）**
- A) 「SQL は Prisma パラメタライズドのみ・raw SQL 不使用」「出力はフレームワークがエスケープ」を U-Cross の規約として明文化（追加実装なし）。
- B) その他

[回答]: a

### D. 暗号化基盤（US-804 / SECURITY-01 / NFR-05）

**Q12. サーバ側の暗号化スコープ**
- A) DB(PostgreSQL)・S3 の保存時暗号化と TLS は**インフラ層（マネージド/設定）**で担保し、U-Cross のコード成果物には含めない（Infra Design 軽量文書で posture 記載）。サーバでのフィールドレベル暗号化は行わない（at-rest＋アクセス制御で保護）。
- B) サーバで PII フィールドのアプリ層暗号化も実装する。
- C) その他

[回答]: A

**Q13. クライアント側ローカル暗号化（IndexedDB の PII/画像, SECURITY-01）の実装責務**
- A) U-Cross は暗号方式の標準（例: Web Crypto **AES-GCM 256**・ランダム IV）と鍵管理方針のみ定義し、実装（`LocalDraftStore` への適用・鍵ライフサイクル）は U6f で行う。
- B) U-Cross がクライアント暗号化ユーティリティ（Web Crypto ラッパ）も実装し、U6f が利用。
- C) その他

[回答]: A

**Q14. ローカル暗号鍵のライフサイクル（共用端末・セッション終了時, SECURITY-01）**
- A) セッション単位の一時鍵（メモリ保持、ログアウト/セッション終了で破棄）＋同期成功確認後にローカル PII/画像を消去。永続鍵は保存しない。
- B) 端末永続鍵（再開のため保持）＋保持期間後に消去。
- C) その他

[回答]: A

### E. ステージ進行

**Q15. U-Cross の後続ステージ**
- A) Functional Design 後、NFR Requirements / NFR Design は **SKIP**（機能設計が NFR/セキュリティ設計を内包）し、Infrastructure Design を **軽量実行**（at-rest 暗号化・TLS・監査保護・アクセスログの posture を文書化）してから Code Generation。
- B) NFR Requirements / NFR Design も個別に実行。
- C) その他

[回答]: A

---

> 回答後、`aidlc-docs/construction/U-Cross/functional-design/` に `domain-entities.md` / `business-logic-model.md` / `business-rules.md` を生成します。曖昧な回答がある場合はフォローアップ質問を追加します。
