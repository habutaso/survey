# U3b コード生成プラン（第2次判定 calcSecond 本実装注入）

**ステージ**: CONSTRUCTION → U3b Code Generation（Part 1: Planning）
**作成日時**: 2026-06-15T09:04+09:00
**担当ストーリー**: US-402 / US-403 / US-404（FR-23, FR-24, FR-26）
**Functional/NFR/Infra Design**: SKIP（U3a と同様、純粋計算の DI 配線のみ）

## ゴール
`assessmentPort.calcSecond` の既定 compute をスタブ（damageRatio=0 / damageLevel='unclassified'）から本実装 `computeSecondAssessment` へ差替え、production 経路で第2次判定の実値算出を有効化する。

## 設計上の要点（U3a との差分）
- U3a の `calcFirst` は `FirstSurveyData ≡ FirstAssessmentInput`（構造同一）のため、追加マッピング不要だった。
- U3b の `computeSecondAssessment` は `SecondAssessmentInput`（`structureType` + `partDamages` + `floorApportionment`）を要求するが、`SecondSurveyData` には `structureType` が無く、`SurveyCommon.structureType`（エンティティ本体）に存在する。
- → `structureType` をエンティティから判定入力へ橋渡しする必要がある。

## 採用方針: 純粋ディスパッチ層でのマッピング（推奨）
`surveyDispatch.assessmentInput` の second 分岐で `entity.structureType` を合成し `SecondAssessmentInput` を返す。これにより:
- マッピングは純粋関数（surveyDispatch）に閉じる（テスト容易・副作用なし）。
- `assessmentPort.calcSecond` は calcFirst と対称な「薄い DI バインド」のまま。
- `resolveAssessment`（useCase 呼出点）は**変更不要**（`input.second` をそのまま渡す）。

### 代替案（不採用）
- B案: `resolveAssessment` 内でインラインマッピング → マッピングロジックが UseCase に漏れ、純粋性・対称性が劣る。

## 実装ステップ（チェックボックス）

### コード変更
- [x] 1. `server/domain/survey/model/surveyDispatch.ts`
  - `assessmentInput` の戻り型を `{ first: FirstSurveyData } | { second: SecondAssessmentInput }` へ変更。
  - second 分岐で `{ second: { structureType: entity.structureType, partDamages: entity.second.partDamages, floorApportionment: entity.second.floorApportionment } }` を返す。
  - `SecondAssessmentInput`（`common/types/assessment`）を import。
- [x] 2. `server/domain/survey/ports/assessmentPort.ts`
  - `calcSecond` の既定 `compute` をスタブから `computeSecondAssessment`（`domain/assessment/computeSecondAssessment`）へ差替。
  - ラッパ signature を `(input: SecondAssessmentInput) => AssessmentResult` へ変更。`SecondSurveyData` import は不要化（未使用なら除去）。
  - コメントを実態へ更新（U3b 完了、calcFirst/calcSecond ともに本実装）。
  - 未使用化する `UNCLASSIFIED` 定数を除去。
- [x] 3. `server/domain/survey/surveyUseCase.ts`
  - `resolveAssessment` は呼出点不変を確認（変更が不要であることをレビュー）。型整合のみ確認。

### テスト更新
- [x] 4. `server/tests/unit/surveyDispatch.test.ts`
  - second 分岐の戻り値に `structureType`/`partDamages`/`floorApportionment` が含まれることを検証（`SecondAssessmentInput` 形状）。
- [x] 5. `server/tests/api/private/surveys.test.ts`
  - 第2次提出テスト（line 236〜）に判定結果の実値検証を追加。`secondBody` = `structureType:'wood'`, `partDamages:[{roof,30}]`, `floor:[{1,100}]` の `computeSecondAssessment` 出力（`damageRatio`/`damageLevel`）と提出後 Dto の一致を assert。
  - 必要なら別 structureType / 複数部位ケースを 1 件追加して配線の決定性を担保。

### 検証
- [x] 6. `npx tsc --noEmit` PASS。
- [x] 7. `npm test`（vitest run --coverage）全 PASS、coverage All files 100% 維持（`assessmentPort.ts` / `surveyDispatch.ts` 含む）。
- [x] 8. `npm run lint`（eslint）クリーン。
- [x] 9. Prisma 変更なしを確認（純粋計算の配線のみ）。

### ドキュメント
- [x] 10. `aidlc-docs/construction/U3b/code/u3b-summary.md` 作成（変更ファイル・検証結果・設計判断・申し送り）。
- [x] 11. `aidlc-state.md` / `audit.md` 更新。

## Security Baseline / PBT コンプライアンス
- **Security Baseline**: 認可・監査は U1/U-Cross で担保済み。U3b は純粋計算の DI 配線のみで新規攻撃面なし → 該当ルールは N/A。入力範囲外（部位/損傷率）は `computeSecondAssessment` 内で `ValidationError` により fail-closed（既存）。
- **Property-Based Testing**: 第2次計算ロジックの PBT 不変条件（INV-1〜8）は U3c の `computeSecondAssessment.test.ts` で網羅済み。U3b は配線変更のため、API 統合テストで本実装接続を決定論的に検証（PBT 追加は不要、N/A）。

## 後続ユニットへの申し送り
- **U4**: `photoPort` の S3 保存実装を注入。
- **U5**: 一覧/検索で `DAMAGE_LEVEL_LIST` / `DAMAGE_LEVEL_DISPLAY` を区分フィルタ・表示に利用。
- **U6f/U6u**: クライアント側の判定結果表示・同期。
