# U6u コード生成プラン（画面ジャーニー UI）

**ステージ**: CONSTRUCTION → U6u Code Generation
**配置**: `client/features/survey/`（model[.ts]/components[.tsx]）・`client/app/`（ルート）・`client/tests/survey/`（純粋ロジックテスト）
**設計**: `construction/U6u/functional-design/*`（D1〜D12）

## 純粋ロジック（100% カバレッジ対象 / D12）
- [x] 1. `features/survey/model/wizardSteps.ts` — `StepKey`/`isMultiStory`/`stepsFor`/`isStepComplete`/`completedSteps`/`firstIncomplete`/`canNavigate`/`nextStep`/`prevStep`。
- [x] 2. `features/survey/model/display.ts` — `surveyTypeLabel`/`statusLabel`/`structureLabel`/`damageLevelLabel`/`damageRatioLabel`/`formatDate`/`isDamageLevel`。
- [x] 3. vite.config.ts coverage include に `features/survey/model/**` 追加。

## React コンポーネント（typecheck/lint で担保・coverage 除外）
- [x] 4. `components/NetworkBanner.tsx`（`useNetworkStatus`）。
- [x] 5. `components/Stepper.tsx`（進捗パンくず・US-205/206）。
- [x] 6. `components/steps/*`（HouseStep/VictimStep/FirstInputStep/SecondInputStep/PhotosStep/FloorsStep/ReviewStep）。
- [x] 7. `components/SurveyWizard.tsx`（`useLocalDraft`＋`useSyncOnSubmit`＋wizardSteps、ステップ統括・提出）。
- [x] 8. `components/SurveyList.tsx`（US-703・`surveys.$get`＋`useDraftList` 再開）。
- [x] 9. `components/HouseResults.tsx`（US-605/606/701/702/601/503/504・results/詳細/approve/confirm/official/pdf/csv）。

## ルート（app dir）
- [x] 10. `app/surveys/new/page.tsx`（第1次新規ウィザード）。
- [x] 11. `app/surveys/[surveyId]/page.tsx`（家屋結果）。
- [x] 12. `app/page.tsx` を SurveyList 導線へ更新。
- [x] 13. ログアウト導線（`BasicHeader`/`YourProfile`）に `localFirst.store.clearAll()` を追加（US-103/Q9=A）。
- [x] 14. `npm run generate:path`（pathpida $path 再生成）。

## テスト・検証
- [x] 15. `tests/survey/wizardSteps.test.ts`（PBT 含む・INV-U6u-1〜4）・`tests/survey/display.test.ts`。
- [x] 16. `tsc --noEmit`（client 全体）PASS。
- [x] 17. `vitest run --coverage`（survey/model 100% 維持＋localFirst 100%）。
- [x] 18. `eslint` 変更ファイル クリーン。サマリ `construction/U6u/code/u6u-summary.md`。
