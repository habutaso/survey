# U6u コード生成サマリ（画面ジャーニー UI）

**ステージ**: CONSTRUCTION → U6u Code Generation（Part 2 実装・完了）
**完了日時**: 2026-06-16T08:35+09:00
**設計**: `construction/U6u/functional-design/*`（D1〜D12）/ 計画: `construction/plans/U6u-code-generation-plan.md`（全18チェック [x]）

## 概要
ガイド付きステップウィザード（住家被害認定調査）の UI を実装。U6f のローカルファースト基盤（`useLocalDraft`/`useSyncOnSubmit`/`useNetworkStatus`）と U2/U4/U5 API（aspida）を組み合わせ、入力→ローカル自動保存→提出時一括同期、調査一覧・検索、家屋結果併記、承認/確定/正式判定、PDF/CSV 出力、ログアウト時ローカル消去を提供。純粋ロジック（ステップ機械・表示整形）は 100% カバレッジ、React コンポーネントは tsc/eslint で担保（Q8=A/D12）。

## 純粋ロジック（`client/features/survey/model/`・coverage 100%）
- `wizardSteps.ts` — `StepKey`/`isMultiStory`/`stepsFor`（house→victim→区分入力→photos→floors[単層スキップ]→review）/`isStepComplete`/`completedSteps`/`firstIncomplete`/`canNavigate`（US-206 ガード）/`nextStep`/`prevStep`。
- `display.ts` — `surveyTypeLabel`/`statusLabel`/`structureLabel`/`isDamageLevel`/`damageLevelLabel`/`damageRatioLabel`/`formatDate`（共通定数の `*_DISPLAY` マップ参照）。

## React コンポーネント（`client/features/survey/components/`）
- `formKit.tsx`（Field/TextInput/NumberInput/SelectInput/CheckboxField・インライン style）。
- `Stepper.tsx`（進捗パンくず・US-205/206）/ `NetworkBanner.tsx`（オフライン表示・US-207）。
- `steps/`（HouseStep[US-201/203]/VictimStep[US-202]/FirstInputStep[US-301/302/303]/SecondInputStep[US-602/603]/PhotosStep[US-304/305]/FloorsStep[US-404]/ReviewStep[US-501/207・計算結果は提出後表示]）。
- `SurveyWizard.tsx`（ステップ統括・ナビゲーションガード・提出）。
- `SurveyList.tsx`（一覧/検索/ページング US-703 ＋ 下書き再開 US-204）。
- `HouseResults.tsx`（第1次/第2次併記 US-605・正式判定 US-606・承認/確定 US-503/504・PDF/CSV US-701/702・第2次開始 US-601）。

## ルート（`client/app/`）
- `page.tsx`（一覧導線へ更新）/ `surveys/new/page.tsx`（新規＋`?draftId` 再開＋`?type=second&parentId=` 第2次）/ `surveys/[surveyId]/page.tsx`（家屋結果）。
- `BasicHeader.tsx`: サインアウト時に `localFirst.store.clearAll()` を実行（US-103/Q9=A）。
- `npm run generate:path` で `utils/$path.ts` 再生成（新ルート反映）。

## テスト（`client/tests/survey/`）
- `wizardSteps.test.ts`（9・PBT 含む INV-U6u-1〜4）・`display.test.ts`（全ラベル分岐）。

## 検証結果
- `npx tsc --noEmit`（client 全体）: **PASS**。
- `npx vitest run --coverage`: **8 ファイル / 61 テスト PASS**、対象（localFirst ＋ survey/model）**All 100%**（statements/branches/functions/lines）。
- `npx eslint`（features/app/layouts/tests/config）: **クリーン**。
- 表示専用コンポーネント（条件付きレンダリングが本質の SurveyWizard/SurveyList/ReviewStep/FloorsStep）には `// eslint-disable-next-line complexity` を付与（既存 `AuthLoader` の慣例に準拠）。

## 多層・セキュリティ整合
- 認可は UI 表示出し分け＋**サーバ最終判定**（US-102/802）。admin 操作（承認/確定/正式判定/PDF/CSV）は admin 表示。
- PII はローカルで U6f 暗号化保持・編集中自端末のみ表示。一覧 DTO は PII 除外（サーバ保証）。
- 入力は UI 即時検証＋サーバ境界検証（多層・US-801）。画像は `image/*` のみ（U6f `isImageType`）。
- 計算（損害割合・6区分）はクライアントで行わず提出後にサーバ結果を表示（FR-30/D6）。

## 申し送り
- React コンポーネントの単体描画テスト（@testing-library 等）は未導入（Q8=A により coverage 対象外）。E2E/結合は Build and Test／OPERATIONS で検討。
- 計算根拠表示（US-403）・差戻し（US-502）は後続（サーバ側も後続）。
- 本変更は未コミット（コミットはユーザー要求時）。
