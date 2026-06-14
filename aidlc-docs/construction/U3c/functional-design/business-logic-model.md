# U3c 機能設計 — 業務ロジックモデル（計算コア assessment-core）

> 対象: U3c 計算カーネルの純粋関数群。すべて副作用なし・決定論的（FR-27）。
> 確定回答: Q1–Q10 すべて A。端数処理 Q8=A（内部は高精度、区分判定・表示時に小数第1位を四捨五入）。

---

## 1. 関数一覧（純粋関数）

| 関数 | 入力 | 出力 | 担当 |
|---|---|---|---|
| `classifyDamageLevel` | `damageRatio: number` | `DamageLevel` | FR-24 / US-402 |
| `applyFloorRatio` | `floors: FloorContribution入力, ratios` | 加重平均損害割合＋根拠 | FR-28 / US-404 |
| `computeFirstAssessment` | `FirstAssessmentInput` | `AssessmentResult` | FR-20〜22 / Q10 |
| `computeSecondAssessment` | `SecondAssessmentInput` | `AssessmentResult` | FR-23 |
| `roundRatio`（内部補助） | `value: number` | `number`（小数第1位丸め） | Q8 |

---

## 2. 端数処理ポリシー（Q8=A）

- **内部計算**: すべて高精度の浮動小数で実施（途中で丸めない）。
- **丸め点**: `roundRatio` を以下の2箇所でのみ適用する。
  1. **区分判定の直前**: `classifyDamageLevel` に渡す `damageRatio` は小数第1位に四捨五入した値を用いる（境界の取り扱いを安定させる）。
  2. **結果（`AssessmentResult.damageRatio`）の格納**: 表示・記録値は小数第1位に四捨五入。
- `roundRatio(value) = Math.round(value * 10) / 10`（小数第1位四捨五入）。
- `basis` 内の中間値（`contribution` 等）は丸め前の値を保持してよい（根拠の追跡性優先）。ただし表示整形は呼び出し側に委ねる。
- すべての損害割合は最終的に **[0, 100] にクランプ**（BR-22）。

---

## 3. `classifyDamageLevel`（FR-24 / US-402）

### 3.1 ロジック

```text
function classifyDamageLevel(damageRatio: number): DamageLevel
  r = clamp(roundRatio(damageRatio), 0, 100)     // [0,100] に正規化（丸め後）
  for threshold in DAMAGE_LEVEL_THRESHOLDS:        // 重い順に評価
      lowerOk = r >= threshold.minInclusive
      upperOk = threshold.maxExclusive == null OR r < threshold.maxExclusive
      if lowerOk AND upperOk: return threshold.level
  return 'partial'                                 // フォールバック（r<10 を保証）
```

### 3.2 境界の扱い（下限包含・上限排他）

| 損害割合 r（丸め後） | 区分 |
|---|---|
| r ≥ 50 | `totalCollapse` |
| 40 ≤ r < 50 | `largeScaleHalf` |
| 30 ≤ r < 40 | `mediumScaleHalf` |
| 20 ≤ r < 30 | `half` |
| 10 ≤ r < 20 | `quasiHalf` |
| 0 ≤ r < 10 | `partial` |

- 境界値の代表例: `r=50.0`→全壊、`r=49.9`→大規模半壊、`r=40.0`→大規模半壊、`r=10.0`→準半壊、`r=9.9`→一部損壊。

---

## 4. `applyFloorRatio`（FR-28 / US-404 / Q5=A）

### 4.1 意味論: 階別床面積比による加重平均

住家損害割合 = Σ(階別損害割合 × 階床面積比 / 100)。床面積比の合計は 100% であること（BR-20）。

```text
function applyFloorRatio(
    floorDamageRatios: { floor: number; floorDamageRatio: number }[],
    floorAreaRatios: FloorRatio[] | null
): { ratioAfter: number; basis: FloorApportionmentBasis }

  if floorAreaRatios is null OR length<=1:
      // 単一階扱い（DEFAULT_FLOOR_RATIO）。按分なし。
      single = floorDamageRatios[0].floorDamageRatio (or 0)
      return { ratioAfter: clamp(single,0,100),
               basis: { applied:false, floors:[...], ratioBefore:single, ratioAfter:single } }

  // 複数階: 比率合計の検証は business-rules BR-20（呼び出し前 or ここで assert）
  weighted = Σ ( match(floor).floorDamageRatio × areaRatio / 100 )
  ratioAfter = clamp(weighted, 0, 100)
  return { ratioAfter, basis: { applied:true, floors:[{floor,areaRatio,floorDamageRatio}...],
                                 ratioBefore: avg or representative, ratioAfter } }
```

- 各階に対応する `floorAreaRatios` が無い場合の扱いは BR-23（欠損階は損害割合0または検証エラー）で規定。
- `ratioBefore` は按分前の参考値（按分しない場合の単純代表値）。`basis` の説明性のために保持。

---

## 5. `computeFirstAssessment`（第1次, FR-20〜22 / Q10=A）

### 5.1 算定フロー

```text
function computeFirstAssessment(input: FirstAssessmentInput): AssessmentResult

  // (1) 外力・流失等の判定（FR-20）— 最優先・即全壊
  reasons = flags where input.externalForceFlags[flag] == true
  if reasons is non-empty:
      ratio = 100   // 全壊扱い（≥50%）
      basis.externalForceApplied = true; basis.externalForceReasons = reasons
      // 階按分は適用しない（全壊確定）。floorBasis.applied=false, ratioBefore=ratioAfter=100
  else:
      // (2) 傾斜寄与（FR-21）— tiltTable 参照（input.tiltRatio が null なら null）
      tiltContribution = input.tiltRatio==null ? null : lookupBand(TILT_TABLE, input.tiltRatio).damageRatio
      // (3) 浸水深寄与（FR-22）— inundationDepthTable 参照（null なら null）
      inundationContribution = input.inundationDepthCm==null ? null
                               : lookupBand(INUNDATION_DEPTH_TABLE, input.inundationDepthCm).damageRatio
      // (4) 第1次の住家損害割合 = 傾斜・浸水深寄与の合算（上限100, BR-24）
      combinedRatio = clamp( sum(nonNull(tiltContribution, inundationContribution)), 0, 100 )
      // (5) 階按分（複数階入力時）
      { ratioAfter, floorBasis } = applyFloorRatio(
            floorsFrom(combinedRatio, input.floorApportionment), input.floorApportionment )
      ratio = ratioAfter

  damageRatio = roundRatio(ratio)
  damageLevel = classifyDamageLevel(damageRatio)
  return { damageRatio, damageLevel, basis: FirstAssessmentBasis{...} }
```

> 合算方式（傾斜＋浸水深）は運用指針の確定値次第で「加算／最大値／換算表合成」のいずれかに切替可能なよう、`combinedRatio` 算出を単一箇所に局所化する（Q3=A のマスタ差替方針と整合）。本設計の既定は **加算（上限クランプ）** のプレースホルダ。

### 5.2 外力フラグ → 全壊（FR-20, BR-25）

`houseWashedAway`（住家流失）/ `groundScour`（地盤洗掘）/ `foundationWashout`（基礎流失）/ `fullCeilingInundation`（全階天井までの浸水）のいずれかが true なら、他の入力に関わらず全壊（damageRatio=100, `totalCollapse`）。

---

## 6. `computeSecondAssessment`（第2次, FR-23）

### 6.1 算定フロー

```text
function computeSecondAssessment(input: SecondAssessmentInput): AssessmentResult

  composition = PART_COMPOSITION[input.structureType]    // wood/nonWood の構成比マスタ（Q4=A）

  // (1) 部位別寄与 = 損傷率 × 構成比 / 100（FR-23）
  partBreakdown = for each input.partDamages (part, damageRatio):
      compositionRatio = composition.parts[part].compositionRatio   // マスタ。未定義部位は BR-26
      contribution = damageRatio × compositionRatio / 100
      → PartContributionDetail{ part, damageRatio, compositionRatio, contribution }

  // (2) 住家損害割合（按分前） = 寄与合計（上限100）
  combinedRatio = clamp( Σ contribution, 0, 100 )

  // (3) 階按分（複数階入力時）
  { ratioAfter, floorBasis } = applyFloorRatio(
        floorsFrom(combinedRatio, input.floorApportionment), input.floorApportionment )

  damageRatio = roundRatio(ratioAfter)
  damageLevel = classifyDamageLevel(damageRatio)
  return { damageRatio, damageLevel, basis: SecondAssessmentBasis{ structureType, partBreakdown, combinedRatio, floorBasis } }
```

### 6.2 構成比マスタの整合（BR-21）

- 構成比合計は構造種別ごとに 100%（マスタ不変条件）。`partDamages` の各部位はマスタ定義部位のサブセット（未定義部位は検証エラー / BR-26）。
- 入力に存在しない部位は損傷率 0%（寄与 0）として扱う。

---

## 7. 階按分の入力分解 `floorsFrom`（補助）

第1次/第2次で共通。住家全体の按分前損害割合 `combinedRatio` を各階に展開する方針:

- 既定（プレースホルダ）: 全階一律に `combinedRatio` を割り当て、床面積比で加重平均（結果は元の `combinedRatio` と一致 = 恒等 / INV 按分保存）。
- 階別の損害割合が個別入力で提供される拡張は後続（U3a/U3b の入力フローで階別損傷を扱う場合）に対応。本コアは「階別床面積比による加重平均」の機構を提供する（Q5=A）。

> この設計により、按分保存則（比率合計100%で全階同値なら按分後＝按分前）が PBT INV-5 で検証可能。

---

## 8. データフロー（まとめ）

```text
[第1次]  FirstAssessmentInput
   → 外力判定(全壊?) ─yes→ ratio=100
                     └no→ 傾斜寄与 + 浸水深寄与 → combinedRatio
   → applyFloorRatio → roundRatio → classifyDamageLevel → AssessmentResult

[第2次]  SecondAssessmentInput
   → 部位別(損傷率×構成比) 合計 → combinedRatio
   → applyFloorRatio → roundRatio → classifyDamageLevel → AssessmentResult
```

---

## 9. 決定論・依存注入の整理

- 全関数はマスタ定数を**モジュールスコープ import**で参照（純粋・決定論）。テスト時にマスタ差替が必要なら、関数はマスタを**省略可能引数**として受け取る設計を許容（既定値＝正準マスタ）。これにより PBT でマスタ生成も property 化できる。
- U3a/U3b は velona `depend` でこれら純粋関数を `assessmentPort` 実装に注入する（U3c 自体は velona 非依存）。

---

## 10. トレーサビリティ

| 要件/ストーリー | 関数/ロジック |
|---|---|
| FR-20 / BR-25 | `computeFirstAssessment` 外力判定 |
| FR-21 | 傾斜寄与（`TILT_TABLE` lookup） |
| FR-22 | 浸水深寄与（`INUNDATION_DEPTH_TABLE` lookup） |
| FR-23 | `computeSecondAssessment` 部位別×構成比 |
| FR-24 / US-402 | `classifyDamageLevel` |
| FR-26 | `AssessmentResult.{damageRatio, damageLevel}` |
| FR-27 / NFR-04 | 純粋関数・決定論（PBT INV-2） |
| FR-28 / US-404 | `applyFloorRatio` |
| US-403 | `AssessmentBasis` 構築（全関数） |
| Q8 | `roundRatio`（小数第1位四捨五入） |
