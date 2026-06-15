# U6f 機能設計プラン（ローカルファースト基盤 / Functional Design）

**ステージ**: CONSTRUCTION → U6f Functional Design
**作成日時**: 2026-06-15T22:40+09:00
**担当ストーリー**: US-204（下書き保存・再開）/ US-207（オフライン入力と提出時同期, クライアント側）
**関連要件**: FR-18・FR-19 / NFR-02 / SECURITY-01
**依存**: U2（`POST /api/private/surveys/submission` = ingestSubmission）、U4（写真 presigned PUT / `photos/confirm`）、U-Cross（`LocalCryptoStandard` AES-GCM 256・鍵ライフサイクル仕様）

## ユニット責務（unit-of-work.md より）
- 入力内容・進捗・撮影画像を IndexedDB にオフライン保持・復元、アプリ層暗号化（Web Crypto）。
- 提出時一括同期（`SyncOnSubmit`）＝送信・キューイング・再試行・同期成功確認後のローカル PII/画像消去。
- 主コンポーネント: `LocalDraftStore`, `SyncOnSubmit`/`syncService`, ネットワーク状態監視。
- **境界**: U6f は headless 基盤（store / service / hooks）。可視 React UI（ウィザード・入力画面）は U6u。

## スコープ内 / スコープ外
- **内**: IndexedDB スキーマ・下書き CRUD、Web Crypto 暗号/復号ラッパ、鍵ライフサイクル、提出同期オーケストレーション（submission→写真 PUT→confirm）、再試行・キュー、ネットワーク監視、同期後ローカル消去、公開フック。
- **外**: 画面・フォーム・ステッパー（U6u）、サーバ実装（U2/U4 済）、PDF/CSV トリガ UI（U6u）。

## 機能設計ステップ（チェックボックス）
- [ ] 1. ドメインエンティティ定義: `LocalDraft`（survey 入力＋進捗＋メタ）、`LocalPhoto`（バイナリ＋メタ）、`SyncJob`（提出キュー要素）、`SyncStatus`/`SyncResult`、暗号化レコード封筒 `EncryptedRecord`（iv＋ciphertext）。
- [ ] 2. IndexedDB スキーマ設計: object store（drafts / photos / syncQueue）、キー・インデックス、バージョニング。
- [ ] 3. 暗号化標準の適用設計: `LocalCryptoStandard`（AES-GCM 256・12B ランダム IV/レコード）に基づく encrypt/decrypt、鍵の取得・破棄ライフサイクル。
- [ ] 4. 下書きライフサイクル: 作成・更新（自動保存）・復元（再読込跨ぎ）・列挙・削除の状態遷移。
- [ ] 5. 提出同期オーケストレーション: submission POST →（応答 tickets で）写真 presigned PUT → photos/confirm、成功確認後にローカル PII/画像消去（FR-19 / SECURITY-01）。
- [ ] 6. 再試行・キューイング・ネットワーク監視: オフライン時キュー保持・オンライン復帰で再開、再試行ポリシー（回数・バックオフ）、失敗時ローカル保持＋エラー通知。
- [ ] 7. ビジネスルール: 同期前消去禁止、確定/提出済み下書きの扱い、鍵未取得時の動作、検証境界、エラー処理（秘匿）。
- [ ] 8. 公開フック/サービス契約: `useLocalDraft`・`useSyncOnSubmit`・`syncService`・`localDraftStore`・`networkStatus` のシグネチャ（U6u 利用）。
- [ ] 9. データフロー図（IndexedDB ↔ 暗号化 ↔ 同期 ↔ サーバ API）。
- [ ] 10. テスト戦略: fake-indexeddb＋Node WebCrypto、暗号往復 PBT（Full enforcement）、同期オーケストレーションの単体（DI スタブ）。

## 明確化のための質問（[Answer]: タグに回答してください）

### Q1. IndexedDB アクセス方式
ローカル下書き永続化の実装方式は？
- A) `idb`（Jake Archibald、軽量・Promise ラッパ、pinned 追加）を使い、薄い `localDraftStore` を構築【推奨：可読性・テスト容易・実績】
- B) 生の IndexedDB API を自前ラップ（依存追加なし、記述量増）
- C) その他（指定）

[Answer]: A

### Q2. 暗号鍵のライフサイクルと再読込跨ぎ（重要・要件間の整合）
FR-18 は「アプリ再読込・端末スリープを跨いでローカルデータ維持」を要求する一方、U-Cross 仕様 §4.3 は「鍵はメモリ保持・非永続・ログアウトで破棄」。両立方式は？
- A) **セッション由来の鍵導出**：認証セッション（Cognito の安定したセッション識別子/トークン由来の秘匿値）から HKDF/PBKDF2 で鍵を導出。再読込後もセッション有効中は再導出して復号可能、ログアウト（セッション終了）で導出不能＝実質消去。【推奨：FR-18 と §4.3 を両立】
- B) `sessionStorage` に鍵を保持：同一タブの再読込は維持、タブ/ブラウザ終了で消失（フル再起動跨ぎは不可）。
- C) ラップした鍵を IndexedDB に永続：完全に再起動跨ぎ可能だが「非永続」方針から逸脱（パスフレーズ等の追加要素が必要）。
- D) その他（指定）

[Answer]: A

### Q3. 暗号化の粒度
ローカル保持データの暗号化範囲は？
- A) **下書き全体（直列化 JSON）＋各画像 Blob を個別に暗号化**して保存（保持データを一律保護）【推奨：SECURITY-01 を簡潔に充足】
- B) PII フィールド（氏名・連絡先・住所）＋画像のみ暗号化、非 PII は平文
- C) その他（指定）

[Answer]: A

### Q4. 提出同期のオーケストレーション範囲
U6f が担う同期処理の範囲は？
- A) **3 段フルオーケストレーション**：`submission` POST →（応答 `photoUploadTickets` で）各画像を presigned PUT → `photos/confirm` まで実施し、全成功で同期完了とする【推奨：US-207 と U4 設計に整合】
- B) `submission` POST のみ実施、写真 PUT/confirm は U6u 側
- C) その他（指定）

[Answer]: A

### Q5. オフライン提出キューの永続性
ネットワーク不通時に「提出」した場合のキューは？
- A) **IndexedDB に永続化**したキュー（`syncQueue` store）。再読込/再起動後もオンライン復帰で自動再開【推奨：喪失防止・FR-19】
- B) メモリ内キューのみ（再読込で消失、再提出が必要）
- C) その他（指定）

[Answer]: A

### Q6. 再試行ポリシー
一括同期失敗時の再試行は？
- A) **指数バックオフ＋上限回数**（例: 最大 5 回・初回 1s〜上限 30s）。上限到達でローカル保持のままエラー通知、手動再試行可【推奨】
- B) 単純固定間隔リトライ（例: 5 回・各 3s）
- C) 自動リトライなし（失敗即通知、手動のみ）
- D) その他（回数・間隔を指定）

[Answer]: A

### Q7. ネットワーク状態監視
オンライン/オフライン判定の方式は？
- A) `navigator.onLine` ＋ `online`/`offline` イベント購読（軽量）。オンライン復帰でキュー処理を起動【推奨】
- B) 上記＋定期ヘルスチェック（`/api/health` への ping）で実効到達性を確認
- C) その他

[Answer]: A

### Q8. クライアントテストのカバレッジ方針（PBT Full enforcement 整合）
client 側は現状カバレッジ閾値未設定。U6f ロジックの品質保証は？
- A) **client に vitest coverage を導入し、U6f の非 UI ロジック（store/service/crypto/util）に 100% を課す**。fake-indexeddb＋Node WebCrypto、暗号往復は fast-check で PBT。React フック/コンポーネントは対象外（U6u）【推奨：サーバ方針・PBT 拡張と整合】
- B) 閾値は課さずユニットテストのみ（暗号往復 PBT は実施）
- C) その他

[Answer]: A

### Q9. セッション終了時のローカルデータ取り扱い（共用端末・SECURITY-01）
ログアウト/セッション終了時の挙動は？
- A) **鍵を破棄**し（Q2=A なら復号不能化）、未同期下書き・画像・キューは保持はするが復号不能＝次回別セッションからは読めない。明示「ログアウト時クリア」は別途 U6u のログアウト導線で `clearAll()` を呼ぶ【推奨】
- B) ログアウト時に未同期含め全ローカルデータを即時物理削除（喪失リスクあり）
- C) その他

[Answer]: A

## 完了後の次ステージ
- 回答に曖昧さがなければ機能設計成果物（`construction/U6f/functional-design/` に domain-entities.md / business-logic-model.md / business-rules.md / frontend-components.md）を生成し承認を求める。
- 承認後: NFR Requirements 要否判断 → （必要なら）NFR Design → Infrastructure Design（クライアントのみのため SKIP 想定）→ Code Generation。
