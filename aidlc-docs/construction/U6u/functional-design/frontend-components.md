# U6u フロントエンド構成（画面ジャーニー UI）

**ステージ**: CONSTRUCTION → U6u Functional Design

## 1. ルート（Next.js app dir）
| パス | 役割 | 主コンポーネント | ストーリー |
|---|---|---|---|
| `/` | ダッシュボード/一覧導線 | `SurveyList` + 下書き再開 | US-703/204 |
| `/surveys/new` | 第1次 新規ウィザード | `SurveyWizard`（create 'first'） | US-201〜205/301〜305/401/402/404/501 |
| `/surveys/[surveyId]` | 家屋結果・第2次開始・承認/確定・正式判定・出力 | `HouseResults` | US-605/606/601/503/504/701/702 |

- 全保護ページは `PageLayout` でロール認証ゲート（既存）。`NetworkBanner` を共通表示。

## 2. コンポーネント階層と契約

### SurveyWizard
- **props**: `{ draftId: string }`
- **state**: `WizardState`（U6f `useLocalDraft` の draft から `wizardSteps` で導出）。
- **子**: `Stepper`（current/completed/onSelect）＋ 現在ステップの入力コンポーネント。
- **相互作用**: 各ステップの onChange → `useLocalDraft.update`。次/前 → `nextStep`/`prevStep`（`canNavigate` ガード）。review の「提出」→ `useSyncOnSubmit.submit`。
- **API**: なし（提出は U6f 経由）。

### Stepper（US-205/206）
- **props**: `{ steps, current, completed, onSelect, canSelect }`。完了/現在/残/スキップ済みを識別表示。

### 入力ステップ（`steps/`）
| コンポーネント | 入力 | 検証 | ストーリー |
|---|---|---|---|
| `HouseStep` | address/houseNumber/structureType/buildingName/floors/GPS | 必須・構造種別 enum | US-201/203 |
| `VictimStep` | victimName/contact/address（任意 PII） | 最大長 | US-202 |
| `FirstInputStep` | externalForceFlags(4)/tiltRatio/inundationDepthCm | 範囲(>=0) | US-301/302/303 |
| `SecondInputStep` | partDamages[{part,damageRatio}] | 0–100% | US-602/603 |
| `PhotosStep` | File(image/*) + part/step、複数枚、一覧/削除 | image/* | US-304/305 |
| `FloorsStep` | floorApportionment[{floor,ratio}] | 合計=100 | US-404 |
| `ReviewStep` | サマリ表示＋提出＋同期状態 | — | US-501/207/401/402(表示) |

### SurveyList（US-703）
- **props**: なし。`apiClient.private.surveys.$get({ query: SurveyListQuery })`。
- フィルタ（status/surveyType/structureType/address/createdFrom/to）＋オフセットページング（page/pageSize、`total`）。
- 行クリック → `/surveys/[surveyId]`。下書き（`useDraftList`）は別セクションで「再開」。

### HouseResults（US-605/606/701/702 + 承認/確定）
- **props**: `{ surveyId: string }`。`apiClient.private.surveys._surveyId(id).results.$get()`（`HouseResultsDto`）＋詳細 `._surveyId(id).$get()`。
- 第1次/第2次の損害割合・6区分を併記。正式判定をハイライト。
- **admin のみ**: 承認 `approve`・確定 `confirm`・正式判定 `official`・PDF（`._surveyId(id).pdf.$get`）・CSV（`export.csv.$get`）。第2次開始（確定済み第1次から `createDraft('second', id)` → `/surveys/new?...` or wizard）。

### NetworkBanner
- `useNetworkStatus().online` が false のときオフライン表示。

## 3. 状態管理
- ローカル下書き状態は U6f フック（`useLocalDraft`/`useDraftList`/`useSyncOnSubmit`）。
- サーバ取得は aspida 直呼び（必要に応じ `useState`/`useEffect`、既存方針）。新規グローバルストアは導入しない。

## 4. 純粋ロジック（coverage 100% 対象 / D12）
- `features/survey/model/wizardSteps.ts`・`features/survey/model/display.ts`。React コンポーネント（.tsx）は coverage 対象外（tsc/lint/build で担保）。

## 5. ログアウト連携（US-103）
- 既存ヘッダ（`BasicHeader`/`YourProfile`）のサインアウト導線で `localFirst.store.clearAll()` を `signOut()` 前に呼ぶ。
