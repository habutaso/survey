# U6u ビジネスルール（画面ジャーニー UI）

**ステージ**: CONSTRUCTION → U6u Functional Design

## BR-U6u-1. ステップ順序とスキップ（FR-15/16/17 / US-205/404）
- 標準順序: house → victim →（first: firstInput / second: secondInput）→ photos →（多層のみ）floors → review。
- 単層住家（`floors <= 1` または未設定）は floors ステップをスキップする。

## BR-U6u-2. ナビゲーション制約（US-206）
- 完了済み・現在・「最初の未完了」ステップへは移動可。前提未充足の先ステップへは移動不可（不足入力を提示）。
- 既存入力はステップ移動で保持（ローカル下書き／IndexedDB）。

## BR-U6u-3. 自動保存（ローカルファースト・US-204/207）
- 入力変更は U6f `useLocalDraft.update` で IndexedDB へ自動保存（デバウンス）。サーバ送信は提出時のみ。

## BR-U6u-4. 提出と同期表示（US-207）
- review で `submit`。同期は U6f が 3 段・冪等・再試行。オフライン時はキュー保持・復帰時自動再開。UI は同期状態（queued/syncing/failed/synced）と再試行導線を表示。

## BR-U6u-5. 計算結果は表示のみ（FR-30 / US-401/402, D6）
- クライアントは損害割合・6区分を**算出しない**。提出後にサーバ再計算結果（詳細 DTO）を表示する。review では「提出後に算出」を明示。

## BR-U6u-6. 認可は表示制御 + サーバ最終判定（US-102/802, D8）
- admin 専用操作（承認/確定/正式判定/PDF/CSV）は admin にのみ UI 表示。ただし UI 非表示に依存せず、サーバが最終的に認可（fail closed）。
- 一覧/詳細はロール範囲（surveyor=自分のみ 等）に従う（U5 `scopeForList`）。

## BR-U6u-7. 入力検証（多層・US-801/SECURITY-05）
- UI は `common/validators/survey` を流用し即時検証（必須・範囲 0–100%・階按分合計=100）。最終境界検証はサーバ。

## BR-U6u-8. PII 取り扱い（US-202/SECURITY-01）
- 被災者 PII はローカルで U6f が暗号化保持。画面表示は編集中の自端末のみ。一覧 DTO に PII は含まれない（サーバ保証）。

## BR-U6u-9. ログアウト時クリア（US-103 / Q9=A）
- ログアウトは `localFirst.store.clearAll()` 実行後に Amplify `signOut()`。共用端末でのローカル残留を防ぐ。

## BR-U6u-10. 画像は image/* のみ（US-304/305 / U4 BR-P15）
- 添付は `image/*` に限定（U6f `isImageType` で送信前検証）。1 部位複数枚可。

## 不変条件（テスト対象・純粋ロジック）
- **INV-U6u-1**: `stepsFor` は常に house で始まり review で終わる。
- **INV-U6u-2**: 単層では floors を含まず、多層では含む。
- **INV-U6u-3**: `canNavigate` は完了済み・現在以前・最初の未完了のみ true（先の未完了は false）。
- **INV-U6u-4**: `completedSteps ⊆ steps`。
