# U3a コード生成サマリー（第1次判定の本実装注入）

**完了日時**: 2026-06-15T08:42+09:00
**ステージ**: CONSTRUCTION → U3a Code Generation（Part 2 完了）
**担当ストーリー**: US-402 / US-403 / US-404（FR-20〜22, FR-24, FR-28）

## 検証結果
- `tsc --noEmit`: **PASS**
- `npm test`（vitest run --coverage）: **20 ファイル / 157 テスト PASS**（U3a で +1 テスト）
- カバレッジ: **All files 100%**（`domain/survey/ports/assessmentPort.ts` 含め statements/branches/functions/lines 100%）
- eslint: **クリーン**
- Prisma マイグレーション: **なし**（純粋計算の配線のみ）

## 変更ファイル（Modified のみ・新規なし）
- `server/domain/survey/ports/assessmentPort.ts`
  - `calcFirst` の既定 `compute` 依存をスタブから `computeFirstAssessment`（`domain/assessment/computeFirstAssessment`）へ差替。
  - ラッパ signature `(input: FirstSurveyData) => AssessmentResult`（緩い境界型）は不変。呼出点（`surveyUseCase.ingestSubmission` → `resolveAssessment` → `calcFirst`）も不変。
  - `calcSecond` はスタブ据え置き（U3b 担当）。コメントを実態へ更新。
- `server/tests/api/private/surveys.test.ts`
  - 第1次提出テストを `damageLevel==='unclassified'`（スタブ）から `computeFirstAssessment` 由来の実値検証（`damageLevel`/`damageRatio` 一致）へ更新。テスト名から「スタブ」を除去。
  - 外力フラグ true（`houseWashedAway`）経路の API テストを追加（`damageRatio===100` / `damageLevel==='totalCollapse'`, FR-20/BR-25）。

## 主要な設計判断
- **DI 境界でのバインド（呼出点不変）**: 本実装注入を `assessmentPort.calcFirst` の既定 `compute` 差替で実現。コントローラ／UseCase の呼出点は一切変更せず、production 経路で実値算出が有効化される。テスト等は velona `.inject` でスタブ差替が引き続き可能。
- **型整合**: `FirstSurveyData` ≡ `FirstAssessmentInput`（構造同一）、正準 `AssessmentResult`（assessment）⊆ 緩い境界 `AssessmentResult`（survey）。追加マッピングコード不要で widen 代入のみ。
- **配線の検証戦略**: API 統合テストで提出結果が純粋関数 `computeFirstAssessment` の出力と一致することを検証し、スタブではなく本実装に接続されたことを決定論的に確認。計算ロジック自体の網羅は U3c 単体テスト（PBT 含む）で担保済み。

## 後続ユニットへの申し送り
- **U3b（第2次）**: `computeSecondAssessment` を `calcSecond` へ同様に注入。`surveys.test.ts` 第2次提出テストの `'unclassified'` 期待値を実値化。`SecondSurveyData` → `SecondAssessmentInput`（`structureType` 供給経路: `SurveyCommon.structureType`）の対応付けに留意。
- **U4**: `photoPort` の S3 保存実装を注入。
- **U5**: 一覧/検索で `DAMAGE_LEVEL_LIST` / `DAMAGE_LEVEL_DISPLAY` を区分フィルタ・表示に利用。
