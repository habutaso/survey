# U3c コード生成サマリー（計算コア assessment-core）

**完了日時**: 2026-06-14T23:40+09:00
**ステージ**: CONSTRUCTION → U3c Code Generation（Part 2 完了）
**担当ストーリー**: US-402 / US-403 / US-404 / US-805（FR-20〜28, FR-30 / NFR-04）

## 検証結果
- `tsc --noEmit`: **PASS**
- `npm test`（vitest run --coverage）: **20 ファイル / 156 テスト PASS**（U3c で +5 ファイル / +46 テスト）
- カバレッジ: **All files 100%**（statements/branches/functions/lines、domain/** ・ common/** ・ api/**/{controller,hooks,validators}.ts）
- eslint: **クリーン**（complexity≤5 / max-depth≤2 / max-nested-callbacks≤3 / max-lines≤200 / no-non-null-assertion / no-unnecessary-condition / OptionalChain 禁止[tests] 遵守）
- Prisma マイグレーション: **なし**（純粋計算・永続化非依存）

## 生成・変更ファイル

### Created（アプリケーションコード）
- `server/common/types/assessment.ts` — 正準型: `DamageLevel` / `AssessmentResult` / `AssessmentBasis`（`FirstAssessmentBasis` | `SecondAssessmentBasis` 判別共用体）/ `PartContributionDetail` / `FloorApportionmentBasis` / `FloorContribution` / `FirstAssessmentInput` / `SecondAssessmentInput`。
- `server/domain/assessment/types.ts` — 内部マスタ型: `DamageLevelThreshold` / `PartDefinition` / `PartComposition` / `ConversionBand`。
- `server/domain/assessment/constants/damageLevelThresholds.ts` — 6区分閾値（**FR-24 確定値**, 降順連続）。
- `server/domain/assessment/constants/partComposition.ts` — 部位定義 `PART_DEFINITIONS`（8部位）＋構造別構成比 `PART_COMPOSITION`（wood/nonWood, 各合計100%, **プレースホルダ**）。
- `server/domain/assessment/constants/inundationDepthTable.ts` — 浸水深→損害割合換算（昇順連続, **プレースホルダ**）。
- `server/domain/assessment/constants/tiltTable.ts` — 傾斜→損害割合換算（昇順連続, **プレースホルダ**）。
- `server/domain/assessment/constants/defaultFloorRatio.ts` — `DEFAULT_FLOOR_RATIO` ＋ `FLOOR_RATIO_SUM_TOLERANCE`。
- `server/domain/assessment/round.ts` — `clampRatio`（[0,100]）/ `roundRatio`（小数第1位四捨五入, Q8）。
- `server/domain/assessment/lookupBandRatio.ts` — 換算表 lookup（upper-only, 連続表前提）。
- `server/domain/assessment/classifyDamageLevel.ts` — 損害割合→6区分（min-only, FR-24/US-402）。
- `server/domain/assessment/applyFloorRatio.ts` — 階別床面積比による加重平均（FR-28/US-404）。
- `server/domain/assessment/computeFirstAssessment.ts` — 第1次判定（外力→全壊/傾斜+浸水深, Q10=A）。
- `server/domain/assessment/computeSecondAssessment.ts` — 第2次判定（部位別損傷率×構成比, FR-23）。

### Modified
- `server/common/constants/index.ts` — `DAMAGE_LEVEL_LIST` / `DAMAGE_LEVEL_NAMES` / `DAMAGE_LEVEL_DISPLAY` 追記（FR-24/Q2=A）。
- `server/common/types/survey.ts` — `AssessmentResult`（緩い永続化境界型）に正準型との関係を明記するコメントを追加（**型定義は不変・非破壊**）。

### Created（テスト）
- `server/tests/unit/assessmentFixtures.ts` — fast-check ジェネレータ（ratio / externalForceFlags / 合計100%階按分 / 部位サブセット）。
- `server/tests/unit/classifyDamageLevel.test.ts` — 境界値12ケース＋丸め＋INV-4/1/2＋閾値表整合（18 tests）。
- `server/tests/unit/applyFloorRatio.test.ts` — 単一/複数階・合計違反・クランプ＋INV-5/5b/1（8 tests）。
- `server/tests/unit/computeFirstAssessment.test.ts` — 外力/傾斜+浸水深/階按分＋INV-1/2/3/6（9 tests）。
- `server/tests/unit/computeSecondAssessment.test.ts` — 部位別/全損/未定義部位/範囲外/構造切替＋構成比整合＋INV-1/2/3/7/8（11 tests）。

## 主要な設計判断
- **正準型 vs 永続化境界型**: 厳密な `AssessmentResult`（`common/types/assessment.ts`, `damageLevel: DamageLevel` / `basis: AssessmentBasis`）と、U2 の緩い `AssessmentResult`（`common/types/survey.ts`, `string`/`Json`）を**別レイヤとして共存**。正準型は緩い型へ構造的に代入可能なため、U3a/U3b は正準結果をそのまま `assessmentPort` へ widen 注入できる。U2 を一切壊さない（`'unclassified'` stub / `'halfDestroyed'` テスト等が維持）。
- **連続テーブルのカバレッジ設計**: 降順テーブル（区分閾値）は下限のみ、昇順テーブル（換算表）は上限のみで判定し、到達不能分岐を排除して branches 100% を達成。表の整合（連続被覆・合計100%）は専用テストで担保。`find` の理論上の undefined は `customAssert`（service/ 配下・カバレッジ対象外）で fail-closed 化。
- **端数処理（Q8=A）**: 内部高精度、`roundRatio` は区分判定直前＋結果格納時のみ。`basis` 中間値は丸め前を保持。
- **マスタ（Q3=A）**: 構成比・浸水深・傾斜の実数値は出典明記（`@source` + 「プレースホルダ」）の代表値。差替は当該 constants ファイルのみで完結し、型・ロジック・PBT は不変。6区分閾値のみ FR-24 確定値。

## PBT 不変条件カバレッジ（US-805 / NFR-04）
- INV-1（範囲 [0,100]）/ INV-2（決定論）/ INV-3（単調性: 浸水深・部位損傷率）/ INV-4（区分整合）/ INV-5（按分保存＋並べ替え不変）/ INV-6（外力→全壊）/ INV-7（全損→100%）/ INV-8（basis 寄与合計＝combinedRatio）。

## 後続ユニットへの申し送り
- **U3a（第1次）**: `computeFirstAssessment`（`domain/assessment/computeFirstAssessment`）を `assessmentPort.calcFirst` の `depend` 差替で注入。入力 `FirstSurveyData` → `FirstAssessmentInput` への対応付けが必要（同名フィールド）。
- **U3b（第2次）**: `computeSecondAssessment` を `assessmentPort.calcSecond` へ注入。`SecondSurveyData` に `structureType` を渡す経路の確認（U2 `SurveyCommon.structureType` から供給）。
- **U2 連携**: 注入後、`damageLevel='unclassified'` を前提とする `surveys.test.ts` の期待値は U3a/U3b で実値へ更新（U2 stub テストの申し送り）。
- **マスタ実数値**: `docs/references/`（内閣府 運用指針 水害編・記入の手引き・調査票）確定後、`constants/{partComposition,inundationDepthTable,tiltTable}.ts` を差替。型・ロジック・PBT は不変。
- **U5（検索/一覧）**: `DAMAGE_LEVEL_LIST` / `DAMAGE_LEVEL_DISPLAY` を区分フィルタ・表示に利用。

## 残作業（U3c スコープ外）
- 第1次の傾斜＋浸水深の合成方式（現状: 加算→クランプのプレースホルダ）は運用指針確定値で見直し可能（`computeFirstAssessment.sumContributions` に局所化済み）。
- 階別に個別損傷を入力する拡張（現状は combinedRatio を全階一律適用）。
