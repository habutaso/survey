# U6u ビジネスロジックモデル（画面ジャーニー UI）

**ステージ**: CONSTRUCTION → U6u Functional Design

## 1. モジュール構成（実装マップ）
```text
client/features/survey/
├── model/                      # 純粋ロジック（100% カバレッジ対象 / Q8=A, D12）
│   ├── wizardSteps.ts          # ステップ導出・スキップ・ナビゲーション・完了判定
│   └── display.ts              # DTO→表示文字列（区分名・状態名・日時）
├── components/                 # React（typecheck/lint/build で担保・coverage 除外）
│   ├── Stepper.tsx             # 進捗パンくず（US-205）
│   ├── SurveyWizard.tsx        # ステップ統括（current/move/submit）
│   ├── steps/                  # 各入力ステップ（HouseStep/VictimStep/FirstInputStep/SecondInputStep/PhotosStep/FloorsStep/ReviewStep）
│   ├── SurveyList.tsx          # 一覧・検索（US-703）
│   ├── HouseResults.tsx        # 第1次/第2次併記・正式判定・出力（US-605/606/701/702）
│   └── NetworkBanner.tsx       # オフライン表示
└── (app routes は client/app/ 配下)
```

## 2. ウィザードステップ機械（`wizardSteps.ts`・純粋）
```text
stepsFor(surveyType, floors):
  base = surveyType==='first' ? [house,victim,firstInput,photos]
                              : [house,victim,secondInput,photos]
  if isMultiStory(floors): base += [floors]      # 単層はスキップ（D3, US-404）
  return base + [review]

isMultiStory(floors) = (floors ?? 1) > 1

isStepComplete(step, draft):
  house       -> address & houseNumber & structureType 充足
  victim      -> 常に true（PII 任意, US-202）
  firstInput  -> externalForceFlags 充足
  secondInput -> partDamages.length > 0
  photos      -> 常に true（任意）
  floors      -> floorApportionment 合計 == 100（±ε）
  review      -> false（終端・提出で離脱）

completedSteps(steps, draft) = steps.filter(isStepComplete)
firstIncomplete(steps, draft) = 最初の未完了ステップ（無ければ review）
canNavigate(steps, draft, target):
  完了済み target | target == firstIncomplete | target は現在より前 → true、それ以外 false（D4, US-206）
nextStep / prevStep(steps, current)
```

## 3. 主要フロー
- **新規第1次（US-201〜203, 205）**: `/surveys/new` → `useLocalDraft.create('first')` → SurveyWizard。各ステップ入力→`update`（自動保存）。review→`useSyncOnSubmit.submit(draftId)`（3段同期は U6f）。同期成功で一覧へ。
- **オフライン継続（US-207）**: NetworkBanner がオフライン表示。提出は U6f がキュー化・復帰時自動再開。`useSyncOnSubmit.status` を表示。
- **再開（US-204）**: 一覧の「下書き」セクション（`useDraftList`）から該当 draftId で SurveyWizard 復元。
- **第2次開始（US-601）**: 確定済み第1次の結果画面から `createDraft('second', parentSurveyId)` → SurveyWizard（secondInput）。
- **承認/確定（US-503/504）**: 管理者は結果/詳細画面から `approve`/`confirm` API を呼ぶ（ボタンは admin のみ表示・サーバ最終認可）。
- **正式判定（US-606）**: HouseResults で第1次/第2次のどちらを正式とするか admin が選択 → `official` API。
- **出力（US-701/702）**: 結果画面の PDF/CSV ボタン → presigned URL を新規タブで開く（admin）。
- **一覧/検索（US-703）**: SurveyList が `apiClient.private.surveys.$get({ query })`（U5 `SurveyListResult`）でフィルタ・ページング。
- **ログアウト（US-103）**: ヘッダのログアウトで `localFirst.store.clearAll()` → Amplify `signOut()`。

## 4. データフロー
```text
SurveyWizard ──update──> useLocalDraft ──> (U6f) IndexedDB 暗号化
            ──submit──> useSyncOnSubmit ──> (U6f) syncService ─3段─> U2/U4 API + S3
SurveyList ───$get────> U2/U5 surveys API
HouseResults ─approve/confirm/official─> U2 API ; pdf/csv ─> U5 API (presigned)
NetworkBanner <─ useNetworkStatus
```

## 5. テスト戦略（D12）
- 純粋ロジック（`wizardSteps`/`display`）を vitest で 100%（PBT: ステップ導出の整合・スキップ・ナビゲーション不変条件）。
- React コンポーネントは tsc + eslint + （任意）build で担保。coverage include には含めない。
