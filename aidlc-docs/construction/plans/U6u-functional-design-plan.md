# U6u 機能設計プラン（画面ジャーニー UI）

**ステージ**: CONSTRUCTION → U6u Functional Design
**担当ストーリー**: US-101/102/103・US-201/202/203・US-205/206・US-301〜305・US-401/402/404・US-501/503/504・US-601/605/606・US-701/702/703
**関連要件**: FR-15/16/17/30/09 ほか UI 全般
**依存**: U6f（`useLocalDraft`/`useDraftList`/`useSyncOnSubmit`/`useNetworkStatus`/`localFirst.store.clearAll`）、U2/U4/U5 API（aspida）、既存 auth（Amplify Authenticator・PageLayout・useUser）。

## 決定事項（自律完了ランのため既定で解決。根拠を併記）
- **D1 ルーティング**: Next.js app dir。`/`（一覧）・`/surveys/new`（新規ウィザード）・`/surveys/[surveyId]`（家屋結果・第2次開始・正式判定・出力）。pathpida で `$path` 再生成。
- **D2 ステップ順序（US-205, FR-15/16/17）**: house（家屋情報）→ victim（被災者 PII）→ 区分入力（first: 外力/傾斜/浸水深 / second: 部位損傷率）→ photos（撮影）→ floors（階按分・**単層はスキップ**, US-404）→ review（計算プレビュー＋提出）。区分（1次/2次）は作成時に選択。
- **D3 スキップ判定**: `floors <= 1`（または未設定）で floors ステップをスキップ。
- **D4 ナビゲーション（US-206）**: 完了済みステップ・現在ステップ・「最初の未完了ステップ」へ移動可。前提未充足の先ステップへは不可（必要入力を提示）。
- **D5 ローカルファースト**: 入力は U6f `useLocalDraft.update`（デバウンス 500ms）で IndexedDB へ自動保存。提出は `useSyncOnSubmit.submit`。オフライン表示は `useNetworkStatus`。
- **D6 計算プレビュー**: クライアントは確定値を持たず、提出後にサーバ再計算結果（`SubmissionResultDto`/詳細 GET）の損害割合・6区分を表示（FR-30/US-401/402 は表示、計算は U3c サーバ）。レビュー段では「未計算（提出後に算出）」を明示。
- **D7 出力（US-701/702）**: 結果画面から PDF（`GET /surveys/:id/pdf`）・CSV（`GET /surveys/export/csv`）の presigned URL を取得し新規タブで開く。admin のみ表示（多層: サーバが最終認可）。
- **D8 認可表示**: ロールに応じてボタン表示を出し分けるが、**UI 非表示に依存せずサーバが最終判定**（US-102/802）。`useUser` の roles を参照。
- **D9 ログアウト（US-103/Q9=A）**: サインアウト前に `localFirst.store.clearAll()` を呼びローカル下書き/画像をクリア。
- **D10 区分従属 UI**: first/second でステップ内容を出し分け。第2次開始は確定済み第1次から `parentSurveyId` を引き継ぎ `createDraft('second', parentId)`。
- **D11 検証**: クライアント UI 検証（必須/範囲）は `common/validators/survey` を流用し即時フィードバック。最終境界検証はサーバ（多層・US-801）。
- **D12 カバレッジ（Q8=A 整合）**: 純粋ロジック（`features/survey/model/**` の wizard ステップ・マッピング）に 100% を課す。React コンポーネント（.tsx）は typecheck/lint/build で担保し coverage 対象外。

## 成果物
- `construction/U6u/functional-design/{domain-entities,business-logic-model,business-rules,frontend-components}.md`

## 完了後
- 機能設計承認 → コード生成（Part1 計画 + Part2 実装）→ Build and Test。
