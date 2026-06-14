# U3c 機能設計 — ドメインエンティティ / 型定義（計算コア assessment-core）

> 対象ユニット: **U3c（計算コア, 共有 assessment-core）** — U3a/U3b/U5 が依存する純粋計算カーネル。
> 関連: FR-20〜FR-28, FR-30 / NFR-04 / US-402・US-403・US-404・US-805 / AC-2・AC-7。
> 確定回答: Q1–Q10 すべて A（`U3c-functional-design-plan.md`）。
> **重要 (Q3=A)**: マスタ値（構成比・浸水深換算・部位定義・既定按分）は**設定可能な構造として実装**し、出典を明記の上で**代表値プレースホルダ**を置く。`server/domain/assessment/constants` を唯一の真実の源（single source of truth）とし、実数値は後日 `docs/references/`（内閣府 運用指針）またはユーザー確定値で差し替える。差替時にロジック・型・PBT は不変。

---

## 1. 設計方針

- **純粋性**: `assessment` ドメインはフレームワーク非依存・永続化非依存。入力 → 出力の決定論的純粋関数のみ（FR-27）。velona/Prisma/DB を一切参照しない。
- **enum 統一 (Q2=A)**: 被害度区分は英語 enum キー＋日本語表示名マップ。U1/U2 の `common/constants` 慣行（`*_LIST` + `*_DISPLAY`）に合わせる。
- **正準型の所在 (Q6=A)**: `AssessmentResult` / `DamageLevel` の正準定義は U3c が持ち、`common/` に配置してクライアント共有可能にする。U2 の暫定 `AssessmentResult`（`common/types/survey.ts`）は本定義を参照/再エクスポートして整合させる（後続作業として申し送り）。
- **マスタ単一源 (Q3=A)**: 数値定数は `domain/assessment/constants` に集約。各定数に `@source` コメント（出典・プレースホルダ表記）を付す。

---

## 2. 配置（予定）

```text
server/
├── common/
│   └── constants/
│       └── index.ts                 # DAMAGE_LEVEL_LIST / _NAMES / _DISPLAY を追記（共有）
│   └── types/
│       ├── assessment.ts            # 正準 AssessmentResult / DamageLevel / 入力型（共有・新規）
│       └── survey.ts                # 既存。AssessmentResult を assessment.ts 参照へ移行（申し送り）
└── domain/
    └── assessment/
        ├── constants/
        │   ├── damageLevelThresholds.ts   # 6区分閾値テーブル（@source FR-24）
        │   ├── partComposition.ts         # 部位定義＋構造別構成比マスタ（@source FR-23 / プレースホルダ）
        │   ├── inundationDepthTable.ts     # 浸水深→損害割合換算表（@source FR-22 / プレースホルダ）
        │   ├── tiltTable.ts                # 傾斜→損害割合換算（@source FR-21 / プレースホルダ）
        │   └── defaultFloorRatio.ts        # 既定階按分（単一階=100%）
        ├── types.ts                        # ドメイン内部型（マスタ型・basis 型）
        ├── classifyDamageLevel.ts          # 損害割合→6区分（純粋関数）
        ├── applyFloorRatio.ts              # 階別床面積比による加重平均（純粋関数）
        ├── computeFirstAssessment.ts       # 第1次: 入力→損害割合→区分（共有部分, Q10=A）
        └── computeSecondAssessment.ts      # 第2次: 部位別損傷率×構成比→損害割合→区分
```

> 注: 関数の最終的なファイル構成は Code Generation で確定。本書はドメインモデルと型の論理設計を示す。

---

## 3. enum: 被害度区分 `DamageLevel`（Q1・Q2=A）

`common/constants/index.ts` に以下を追記する。

| enum キー | 日本語表示名 | 損害割合の範囲（％） |
|---|---|---|
| `totalCollapse` | 全壊 | ≥ 50 |
| `largeScaleHalf` | 大規模半壊 | 40 以上 50 未満 |
| `mediumScaleHalf` | 中規模半壊 | 30 以上 40 未満 |
| `half` | 半壊 | 20 以上 30 未満 |
| `quasiHalf` | 準半壊 | 10 以上 20 未満 |
| `partial` | 準半壊に至らない（一部損壊） | < 10 |

- 区間規約: **下限包含・上限排他**（`partial` のみ下限なし、`totalCollapse` のみ上限なし）。
- 定義（型・値の真実の源）:

```text
DAMAGE_LEVEL_LIST = ['totalCollapse','largeScaleHalf','mediumScaleHalf','half','quasiHalf','partial'] as const
DAMAGE_LEVEL_NAMES = listToDict(DAMAGE_LEVEL_LIST)            // 既存 listToDict 慣行を再利用
DAMAGE_LEVEL_DISPLAY: Record<DamageLevel, string> = { totalCollapse:'全壊', ... 'partial':'準半壊に至らない（一部損壊）' }
type DamageLevel = (typeof DAMAGE_LEVEL_LIST)[number]
```

> 配列順は被害度の重い順（`totalCollapse` → `partial`）。重大度比較や表示ソートに利用可能。

---

## 4. 正準結果型 `AssessmentResult`（Q6・Q7=A）

`common/types/assessment.ts`（新規・共有）に定義。U2 既存型を上位互換に保ちつつ `basis` を構造化する。

```text
AssessmentResult = {
  damageRatio: number          // 損害割合（％, 小数第1位丸め後の表示値。0–100, FR-26）
  damageLevel: DamageLevel     // 6区分（FR-24）
  basis: AssessmentBasis       // 計算根拠（構造化, US-403）
}
```

### 4.1 計算根拠 `AssessmentBasis`（US-403 / Q7=A）

経路別・部位別・階按分の中間値を構造化保持する判別共用体（`surveyType` で判別）。

```text
AssessmentBasis =
  | FirstAssessmentBasis
  | SecondAssessmentBasis

FirstAssessmentBasis = {
  surveyType: 'first'
  externalForceApplied: boolean        // 外力・流失等該当（true → 全壊確定, FR-20）
  externalForceReasons: string[]       // 該当フラグ名（houseWashedAway 等）
  tiltContribution: number | null      // 傾斜寄与の損害割合（％, tiltTable 由来）
  inundationContribution: number | null// 浸水深寄与の損害割合（％, inundationDepthTable 由来）
  combinedRatio: number                // 階按分前の住家損害割合（％）
  floorBasis: FloorApportionmentBasis  // 階按分前後（§4.2）
}

SecondAssessmentBasis = {
  surveyType: 'second'
  structureType: StructureType         // wood / nonWood（適用した構成比マスタ）
  partBreakdown: PartContributionDetail[]  // 部位別: 損傷率 × 構成比 = 寄与割合
  combinedRatio: number                // 階按分前の住家損害割合（％, partBreakdown 合計）
  floorBasis: FloorApportionmentBasis  // 階按分前後（§4.2）
}

PartContributionDetail = {
  part: string                         // 部位キー（partComposition マスタ）
  damageRatio: number                  // 当該部位の損傷率（％, 入力）
  compositionRatio: number             // 当該部位の構成比（％, マスタ）
  contribution: number                 // damageRatio × compositionRatio / 100（％寄与）
}
```

### 4.2 階按分根拠 `FloorApportionmentBasis`（FR-28 / US-404 / Q5=A）

```text
FloorApportionmentBasis = {
  applied: boolean                     // 階按分を適用したか（複数階入力ありで true）
  floors: FloorContribution[]          // 階別の比率と損害割合
  ratioBefore: number                  // 按分前（代表値 or 合算前）の損害割合（％）
  ratioAfter: number                   // 按分後の住家損害割合（％, 加重平均結果）
}

FloorContribution = {
  floor: number                        // 階（1, 2, ...）
  areaRatio: number                    // 階床面積比（％, 合計=100, BR-20）
  floorDamageRatio: number             // 当該階の損害割合（％）
}
```

---

## 5. 入力型（共有）

`common/types/assessment.ts` に定義。U2 の `FirstSurveyData` / `SecondSurveyData`（`common/types/survey.ts`）と整合させる（同名フィールド・同意味）。

### 5.1 第1次入力 `FirstAssessmentInput`（FR-20〜22 / Q10=A）

```text
FirstAssessmentInput = {
  externalForceFlags: ExternalForceFlags   // houseWashedAway / groundScour / foundationWashout / fullCeilingInundation
  tiltRatio: number | null                  // 傾斜の実測値（傾斜割合, 0–）。null=未入力
  inundationDepthCm: number | null          // 床上浸水深（cm）。null=未入力
  floorApportionment: FloorRatio[] | null   // 階別床面積比（FloorRatio={floor, ratio}）。null=単一階扱い
}
```

### 5.2 第2次入力 `SecondAssessmentInput`（FR-23 / Q4=A）

```text
SecondAssessmentInput = {
  structureType: StructureType              // wood / nonWood（適用構成比マスタの選択）
  partDamages: PartDamage[]                 // 部位別損傷率（PartDamage={part, damageRatio}）
  floorApportionment: FloorRatio[] | null   // 階別床面積比。null=単一階扱い
}
```

> `ExternalForceFlags` / `FloorRatio` / `PartDamage` は既存 `common/types/survey.ts` 定義を再利用（重複定義しない）。

---

## 6. マスタ型（ドメイン内部・Q3=A）

`domain/assessment/types.ts` と `constants/*` に定義。**すべてプレースホルダ代表値**であり、各定数に出典コメントを付す。

### 6.1 6区分閾値テーブル `DamageLevelThreshold[]`（@source FR-24, 確定値）

```text
DamageLevelThreshold = {
  level: DamageLevel
  minInclusive: number        // 下限（包含）。partial は -Infinity 相当（下限なし → 0 起点）
  maxExclusive: number | null // 上限（排他）。totalCollapse は null（上限なし）
}
// 値: [50,null]=totalCollapse, [40,50]=largeScaleHalf, [30,40]=mediumScaleHalf,
//      [20,30]=half, [10,20]=quasiHalf, [0,10]=partial   ← FR-24 で確定（プレースホルダではない）
```

### 6.2 部位構成比マスタ `PartComposition`（@source FR-23 / **プレースホルダ**）

```text
PartDefinition = {
  part: string                // 部位キー（例: roof/foundation/exteriorWall/ceiling/floor/interiorWall/fixtures/equipment）
  displayName: string         // 日本語表示名（例: 屋根 / 基礎 / 外壁 ...）
}

PartComposition = {
  structureType: StructureType
  parts: { part: string; compositionRatio: number }[]  // 構成比（％）。合計=100（BR-21）
}
// wood / nonWood それぞれにプレースホルダ構成比を定義。合計=100 を満たす代表値。
// 実数値は docs/references（運用指針 水害編・記入の手引き）確定後に差替。
```

### 6.3 浸水深換算表 `InundationDepthBand[]`（@source FR-22 / **プレースホルダ**）

```text
InundationDepthBand = {
  minDepthCm: number          // 浸水深下限（cm, 包含）
  maxDepthCm: number | null   // 浸水深上限（cm, 排他。最上位は null）
  damageRatio: number         // 当該帯の損害割合（％）
}
// 浸水深（床上）が深いほど damageRatio が大きい単調増加のプレースホルダ表。
```

### 6.4 傾斜換算 `TiltBand[]`（@source FR-21 / **プレースホルダ**）

```text
TiltBand = {
  minTilt: number             // 傾斜下限（包含）
  maxTilt: number | null      // 傾斜上限（排他）
  damageRatio: number         // 当該帯の損害割合（％）
}
// 傾斜が大きいほど damageRatio が大きい単調増加のプレースホルダ表。
```

### 6.5 既定階按分 `DEFAULT_FLOOR_RATIO`

```text
DEFAULT_FLOOR_RATIO: FloorRatio[] = [{ floor: 1, ratio: 100 }]   // 入力なし=単一階100%
```

---

## 7. エンティティ関係（概念）

U3c は永続化エンティティを持たない（純粋計算）。論理的な依存関係:

```text
FirstAssessmentInput ──┐
                       ├──> computeFirstAssessment ──┐
(constants: tiltTable, │                              │
 inundationDepthTable) ┘                              │
                                                      ├──> applyFloorRatio ──> AssessmentResult
SecondAssessmentInput ─┐                              │         (basis 構築)
                       ├──> computeSecondAssessment ──┘
(constants:            │
 partComposition) ─────┘

classifyDamageLevel: damageRatio(0–100) ──(DamageLevelThreshold[])──> DamageLevel
```

---

## 8. トレーサビリティ（型 ↔ 要件）

| 要件/ストーリー | 設計要素 |
|---|---|
| FR-20（外力・流失→全壊） | `ExternalForceFlags`, `FirstAssessmentBasis.externalForceApplied` |
| FR-21（傾斜判定） | `TiltBand[]`, `FirstAssessmentBasis.tiltContribution` |
| FR-22（浸水深判定） | `InundationDepthBand[]`, `FirstAssessmentBasis.inundationContribution` |
| FR-23（部位別損傷率×構成比） | `PartComposition`, `SecondAssessmentInput.partDamages`, `PartContributionDetail` |
| FR-24（6区分マッピング） | `DAMAGE_LEVEL_LIST`, `DamageLevelThreshold[]`, `classifyDamageLevel` |
| FR-26（割合＋区分の記録） | `AssessmentResult.{damageRatio, damageLevel}` |
| FR-27（決定論） | 全関数を純粋関数化（副作用なし）。PBT INV-2 |
| FR-28 / US-404（階按分） | `FloorRatio`, `applyFloorRatio`, `FloorApportionmentBasis` |
| US-402（6区分判定） | `classifyDamageLevel` |
| US-403（計算根拠） | `AssessmentBasis`（構造化） |
| US-805 / NFR-04（PBT） | business-rules.md INV-1〜5 |

---

## 9. 後続ユニットへの提供インターフェイス（申し送り）

| 利用ユニット | 提供物 |
|---|---|
| U3a（第1次） | `computeFirstAssessment(FirstAssessmentInput): AssessmentResult` を `assessmentPort.calcFirst` 実装に注入 |
| U3b（第2次） | `computeSecondAssessment(SecondAssessmentInput): AssessmentResult` を `assessmentPort.calcSecond` 実装に注入 |
| U5（検索/一覧） | `DAMAGE_LEVEL_LIST` / `DAMAGE_LEVEL_DISPLAY`（区分フィルタ・表示） |
| U2（既存） | `AssessmentResult` / `DamageLevel` の正準化に伴い `common/types/survey.ts` を参照へ移行（後続調整） |
| 全体 | マスタ実数値の差替（`docs/references` 確定後）。型・ロジック・テストは不変 |
