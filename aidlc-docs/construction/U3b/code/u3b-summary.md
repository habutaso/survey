# U3b コード生成サマリー（第2次判定の本実装注入）

**完了日時**: 2026-06-15T09:07+09:00
**ステージ**: CONSTRUCTION → U3b Code Generation（Part 2 完了）
**担当ストーリー**: US-402 / US-403 / US-404（FR-23, FR-24, FR-26）

## 検証結果
- `tsc --noEmit`: **PASS**
- `npm test`（vitest run --coverage）: **20 ファイル / 157 テスト PASS**
- カバレッジ: **All files 100%**（`assessmentPort.ts` / `surveyDispatch.ts` 含め statements/branches/functions/lines 100%）
- eslint: **クリーン**（`npx eslint` 変更4ファイル）
- Prisma マイグレーション: **なし**（純粋計算の配線のみ。`prisma format` が schema を整形したが U3b と無関係のため revert 済み）

## 変更ファイル（Modified のみ・新規なし）
- `server/domain/survey/model/surveyDispatch.ts`
  - `assessmentInput` の戻り型を `{ first: FirstSurveyData } | { second: SecondAssessmentInput }` へ変更。
  - second 分岐で `entity.structureType`（SurveyCommon）を合成し `SecondAssessmentInput`（structureType / partDamages / floorApportionment）を構成。
  - `SecondAssessmentInput`（`common/types/assessment`）を import、未使用化した `SecondSurveyData` import を除去。
- `server/domain/survey/ports/assessmentPort.ts`
  - `calcSecond` の既定 `compute` をスタブから `computeSecondAssessment`（`domain/assessment/computeSecondAssessment`）へ差替。
  - ラッパ signature を `(input: SecondAssessmentInput) => AssessmentResult` へ変更。未使用化した `SecondSurveyData` import・`UNCLASSIFIED` 定数を除去。
  - コメントを実態へ更新（calcFirst=U3a / calcSecond=U3b ともに本実装）。
- `server/tests/unit/surveyDispatch.test.ts`
  - second 分岐テストを `SecondAssessmentInput` 形状検証へ更新（structureType / partDamages / floorApportionment が合成されること）。
- `server/tests/api/private/surveys.test.ts`
  - `computeSecondAssessment` を import。第2次提出テストに判定結果の実値検証を追加（`secondBody`= structureType:'wood' / partDamages:[{roof,30}] / floor:[{1,100}] の出力 `damageRatio`/`damageLevel` と提出後 Dto の一致を assert）。

## 主要な設計判断
- **純粋ディスパッチ層でのマッピング（呼出点不変）**: `structureType` の橋渡しを純粋関数 `surveyDispatch.assessmentInput` に閉じ込めた。これにより `assessmentPort.calcSecond` は calcFirst と対称な薄い DI バインドのまま、`surveyUseCase.resolveAssessment`（呼出点）も一切変更なし。
- **型整合**: 正準 `AssessmentResult`（assessment, DamageLevel/AssessmentBasis）⊆ 緩い境界 `AssessmentResult`（survey）。widen 代入のみで追加マッピング不要。
- **配線の検証戦略**: API 統合テストで提出結果が純粋関数 `computeSecondAssessment` の出力と一致することを検証し、スタブではなく本実装に接続されたことを決定論的に確認。計算ロジック自体（PBT INV-1〜8 含む）は U3c 単体テストで網羅済み。

## 後続ユニットへの申し送り
- **U4**: `photoPort` の S3 保存実装を注入。
- **U5**: 一覧/検索で `DAMAGE_LEVEL_LIST` / `DAMAGE_LEVEL_DISPLAY` を区分フィルタ・表示に利用。
- **U6f/U6u**: クライアント側の判定結果表示・同期。
- 備考: `assessmentPort` の calcFirst/calcSecond がともに本実装となり、第1次・第2次の提出フローは production 経路で実値算出が有効。reject フローは後続。
