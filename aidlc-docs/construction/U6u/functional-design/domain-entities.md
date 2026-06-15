# U6u ドメインエンティティ（画面ジャーニー UI 状態）

**ステージ**: CONSTRUCTION → U6u Functional Design

U6u は永続ドメインを持たない（永続は U6f/サーバ）。本書は UI 状態と表示モデルを定義する。

## 1. ウィザード状態
```ts
export type StepKey =
  | 'house'        // 家屋情報（US-201）
  | 'victim'       // 被災者 PII（US-202）
  | 'firstInput'   // 第1次: 外力/傾斜/浸水深（US-301/302/303）
  | 'secondInput'  // 第2次: 部位損傷率（US-602/603）
  | 'photos'       // 撮影（US-304/305）
  | 'floors'       // 階按分（US-404・単層スキップ）
  | 'review';      // 計算プレビュー＋提出

export type WizardState = {
  steps: StepKey[];          // surveyType + floors から導出
  current: StepKey;
  completed: StepKey[];      // 入力充足済みステップ
};
```

## 2. 表示モデル（サーバ DTO の整形）
- **一覧行**: `SurveyDto`（U2/U5・PII 除外）→ 住所/家屋番号/区分/状態/被害度区分/作成日時の表示。
- **家屋結果**: `HouseResultsDto`（US-605）= `{ first: SurveyDto; seconds: SurveyDto[] }` を併記。正式判定（`officialSurveyId`）をハイライト。
- **被害度区分表示**: `damageLevel`（string・DAMAGE_LEVEL）→ 日本語表示名（`*_DISPLAY` マップ）。
- **出力チケット**: `ExportTicket`（U5）= presigned URL を新規タブで開く。

## 3. フォーム入力モデル（→ U6f DraftInput）
- house: address / houseNumber / structureType（wood|nonWood）/ buildingName? / floors? / lat? / lng?
- victim: victimName? / victimContact? / victimAddress?（PII・任意）
- firstInput: externalForceFlags{4 booleans} / tiltRatio? / inundationDepthCm?
- secondInput: partDamages[{part, damageRatio}]
- floors: floorApportionment[{floor, ratio}]（合計=100）
- photos: File（image/*）＋ part?/step? メタ → `useLocalDraft.addPhoto`

各入力は `useLocalDraft.update({ input: { ... } })` で IndexedDB へ自動保存（デバウンス）。
