# U3c — コード生成 計画（Code Generation Plan: 計算コア assessment-core）

> 本計画は U3c Code Generation の**唯一の真実の源**。承認後に Part 2 で本計画の各ステップを順に実行する。
> 関連: FR-20〜28, FR-30 / NFR-04 / US-402・US-403・US-404・US-805。
> 設計根拠: `aidlc-docs/construction/U3c/functional-design/`（domain-entities / business-logic-model / business-rules）。
> ステージ判定: **NFR Requirements/Design = SKIP**（純粋・決定論計算、性能軽微。PBT は NFR-04 として本コード生成に内包）。**Infrastructure Design = SKIP**（永続化・インフラ非依存）。

---

## ユニット・コンテキスト

- **担当ストーリー**: US-402（6区分判定）, US-403（計算根拠）, US-404（階按分）, US-805（PBT）。
- **依存（前提・完了済）**: U-Cross（`service/customAssert` の `ValidationError`）、U1（`common/constants` 慣行）、U2（`common/types/survey.ts` の `AssessmentResult`/`FirstSurveyData`/`SecondSurveyData`/`ExternalForceFlags`/`FloorRatio`/`PartDamage`、`assessmentPort` スタブ）。
- **提供インターフェイス（後続へ）**: `computeFirstAssessment` / `computeSecondAssessment` / `classifyDamageLevel` / `applyFloorRatio` と正準型 `AssessmentResult`/`DamageLevel`。U3a/U3b が `assessmentPort` の `depend` 差替で本コアを注入。
- **配置**: `server/domain/assessment/**`（純粋関数・マスタ）、`server/common/constants/index.ts`（DamageLevel enum 追記）、`server/common/types/assessment.ts`（正準型・新規）。
- **品質ゲート**: `tsc --noEmit` PASS、`npm test` 全 PASS、coverage 100%（domain/** ・ common/**）、eslint クリーン（complexity≤5 / max-lines / no-unnecessary-condition 等の既存ルール遵守）。

### 既存契約との整合方針（重要）
- U2 `assessmentPort` の本実装注入は **U3a/U3b の責務**。U3c は純粋関数を提供するのみ（`assessmentPort` 本体は本ユニットで変更しない）。
- 正準 `AssessmentResult`/`DamageLevel` は `common/types/assessment.ts` に定義。U2 既存 `common/types/survey.ts` の `AssessmentResult` は**再エクスポート参照へ移行**し、構造（`{damageRatio, damageLevel, basis}`）の後方互換を保つ（`damageLevel` は `string` 上位互換のまま、`DamageLevel` は部分集合）。U2 既存テスト・型を壊さないことを `tsc`／`npm test` で保証。

---

## 生成ステップ（チェックボックスは Part 2 実行時に [x] 更新）

### Step 1: 定数 — 被害度区分 enum（`common/constants/index.ts` 追記）
- [x] `DAMAGE_LEVEL_LIST = ['totalCollapse','largeScaleHalf','mediumScaleHalf','half','quasiHalf','partial'] as const`（重い順）
- [x] `DAMAGE_LEVEL_NAMES = listToDict(DAMAGE_LEVEL_LIST)`（既存 `listToDict` 再利用）
- [x] `DAMAGE_LEVEL_DISPLAY: Record<(typeof DAMAGE_LEVEL_LIST)[number], string>`（全壊/大規模半壊/中規模半壊/半壊/準半壊/準半壊に至らない（一部損壊））
- 根拠: domain-entities §3 / FR-24 / Q1・Q2=A。

### Step 2: 正準型（`common/types/assessment.ts` 新規）
- [x] `DamageLevel = (typeof DAMAGE_LEVEL_LIST)[number]`
- [x] `AssessmentResult = { damageRatio: number; damageLevel: DamageLevel; basis: AssessmentBasis }`
- [x] `AssessmentBasis = FirstAssessmentBasis | SecondAssessmentBasis`（`surveyType` 判別）、`PartContributionDetail`、`FloorApportionmentBasis`、`FloorContribution`
- [x] 入力型 `FirstAssessmentInput` / `SecondAssessmentInput`（既存 `ExternalForceFlags`/`FloorRatio`/`PartDamage` を `common/types/survey` から import 再利用）
- 根拠: domain-entities §4・§5 / Q6・Q7=A。

### Step 3: U2 既存型の整合（`common/types/survey.ts` 修正）
- [x] `AssessmentResult` を `common/types/assessment` からの再エクスポート参照へ変更（重複定義排除、`Json` basis → `AssessmentBasis` 互換確認）
- [x] `damageLevel`/`damageRatio` 列の後方互換維持（U2 の `SurveyCommon` は `string | null` 据置で可）
- [x] `tsc` で U2 既存箇所（store/toSurveyDto, surveyUseCase, assessmentPort スタブ）の破綻がないこと確認、必要なら最小調整
- 根拠: domain-entities §1・§9（申し送り）。**加法/参照化のみ。U2 の振る舞いは不変**。

### Step 4: マスタ定数（`domain/assessment/constants/*`）
- [x] `damageLevelThresholds.ts` — `DAMAGE_LEVEL_THRESHOLDS: DamageLevelThreshold[]`（FR-24 確定値, `@source FR-24`）
- [x] `partComposition.ts` — `PART_DEFINITIONS`（部位定義＋表示名）＋ `PART_COMPOSITION: Record<StructureType, {part,compositionRatio}[]>`（wood/nonWood、合計100% プレースホルダ, `@source FR-23 placeholder`）
- [x] `inundationDepthTable.ts` — `INUNDATION_DEPTH_TABLE: InundationDepthBand[]`（単調増加プレースホルダ, `@source FR-22 placeholder`）
- [x] `tiltTable.ts` — `TILT_TABLE: TiltBand[]`（単調増加プレースホルダ, `@source FR-21 placeholder`）
- [x] `defaultFloorRatio.ts` — `DEFAULT_FLOOR_RATIO: FloorRatio[] = [{floor:1,ratio:100}]`
- 根拠: domain-entities §6 / business-rules BR-21/35/36/37 / Q3・Q4=A。

### Step 5: ドメイン内部型（`domain/assessment/types.ts`）
- [x] `DamageLevelThreshold` / `PartDefinition` / `PartComposition` / `InundationDepthBand` / `TiltBand`
- 根拠: domain-entities §6。

### Step 6: `classifyDamageLevel`（`domain/assessment/classifyDamageLevel.ts`）
- [x] `roundRatio`（小数第1位四捨五入, Q8）＋ `clamp` 補助（`domain/assessment/round.ts` か同ファイル内）
- [x] `classifyDamageLevel(damageRatio): DamageLevel`（[0,100]クランプ→丸め→閾値走査, BR-1〜4）
- 根拠: business-logic-model §2・§3 / FR-24 / US-402。

### Step 7: `applyFloorRatio`（`domain/assessment/applyFloorRatio.ts`）
- [x] 階別床面積比による加重平均（単一階/null は按分なし, 比率合計100% 検証 BR-20）＋ `FloorApportionmentBasis` 構築
- [x] 比率合計≠100（許容誤差外）は `ValidationError`（`service/customAssert`）で fail-closed
- 根拠: business-logic-model §4・§7 / FR-28 / US-404 / BR-20/23/31/32。

### Step 8: `computeFirstAssessment`（`domain/assessment/computeFirstAssessment.ts`）
- [x] 外力フラグ該当→100%（BR-25）／非該当→傾斜寄与＋浸水深寄与（換算表 lookup, BR-24/27）→ `applyFloorRatio` → `roundRatio` → `classifyDamageLevel`
- [x] `FirstAssessmentBasis` 構築（US-403）
- 根拠: business-logic-model §5 / FR-20〜22 / Q10=A。

### Step 9: `computeSecondAssessment`（`domain/assessment/computeSecondAssessment.ts`）
- [x] 構造別構成比マスタ選択（Q4）→ 部位別(損傷率×構成比/100) 合計（BR-30）→ `applyFloorRatio` → `roundRatio` → `classifyDamageLevel`
- [x] 未定義部位は `ValidationError`（BR-26）、損傷率範囲外は `ValidationError`（BR-29）
- [x] `SecondAssessmentBasis` 構築（part 内訳, US-403）
- 根拠: business-logic-model §6 / FR-23。

### Step 10: バレル/エクスポート整理
- [x] `domain/assessment/index.ts`（または各関数 named export）で `computeFirstAssessment`/`computeSecondAssessment`/`classifyDamageLevel`/`applyFloorRatio` を公開（U3a/U3b 注入用）
  - **実装メモ**: 各関数ファイルの named export を採用し、バレル `index.ts` は**作成しない**（domain/survey 等の既存慣行に合わせる＋未 import バレルが coverage `all` で 0% 判定になり 100% 閾値を割るため）。U3a/U3b は `domain/assessment/computeFirstAssessment` 等を直接 import。
- 根拠: domain-entities §9。

### Step 11: 単体テスト（`tests/unit/`）
- [x] `assessmentFixtures.ts`（fast-check ジェネレータ: floorApportionment 合計100% 正規化、partDamages 部位サブセット、externalForceFlags 組合せ）
- [x] `classifyDamageLevel.test.ts` — 境界値（9.9/10/19.9/20/29.9/30/39.9/40/49.9/50/100）＋ **INV-4（区分整合）**
- [x] `applyFloorRatio.test.ts` — 単一階/複数階加重平均＋比率合計違反 ValidationError ＋ **INV-5（按分保存）**
- [x] `computeFirstAssessment.test.ts` — 外力→全壊（**INV-6**）/傾斜・浸水深寄与/未入力0（BR-27）＋ **INV-1/2/3**
- [x] `computeSecondAssessment.test.ts` — 部位別合算/未定義部位エラー/全損→100（**INV-7**）＋ basis 合計一致（**INV-8**）＋ **INV-1/2/3**
- [x] マスタ整合テスト — 構成比合計=100%（BR-21）、閾値表が6区分を隙間なく被覆（BR-2）
- 根拠: business-rules §7 / NFR-04 / US-805。

### Step 12: コード要約ドキュメント
- [x] `aidlc-docs/construction/U3c/code/u3c-summary.md`（生成物一覧・決定事項・申し送り・残作業）

### Step 13: 検証（generate / typecheck / test / lint）
- [x] `npm run generate`（必要時。U3c は Prisma/aspida スキーマ変更なしのため通常不要だが型整合のため実行可）
- [x] `tsc --noEmit` PASS（server）
- [x] `npm test` 全 PASS、coverage 100%（domain/** ・ common/**）
- [x] `eslint` クリーン
- [x] U2 既存テスト（surveys.test.ts ほか）が引き続き PASS（型参照化の非破壊確認）

---

## 非該当（このユニットで行わないこと）
- Prisma スキーマ変更・マイグレーション（純粋計算、永続化なし）。
- `assessmentPort` 本体の実装注入（U3a/U3b）。
- API エンドポイント追加（U3c は内部カーネル。第1次/第2次の API は U3a/U3b/U2 で対応済/対応予定）。
- クライアント実装（U6f/U6u）。

## トレーサビリティ要約
| ストーリー | 実装ステップ | テスト/INV |
|---|---|---|
| US-402 | Step 1,2,6 | classifyDamageLevel.test / INV-4 |
| US-403 | Step 2,8,9 | basis 構造 / INV-8 |
| US-404 | Step 2,7 | applyFloorRatio.test / INV-5 |
| US-805 | Step 11 | INV-1〜8 |

## 端数・精度・出典
- 内部高精度、`roundRatio` は区分判定直前＋結果格納時のみ（Q8=A / BR-33）。
- マスタ実数値は代表値プレースホルダ（`@source` 明記）。差替時にロジック/型/PBT 不変（Q3=A / BR-35/36）。6区分閾値は FR-24 確定値（BR-37）。
