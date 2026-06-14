import type { ConversionBand } from 'domain/assessment/types';

// 傾斜(傾斜割合)→損害割合(%) 換算表（第1次, FR-21）。傾斜が大きいほど損害割合が大きい単調増加。
// @source FR-21（運用指針 水害編）。
// 【重要 / Q3=A】出典確定までの代表値プレースホルダ。実数値は docs/references 確定後に差し替える。
// lower 包含・upper 排他。最上位帯の upper は null（上限なし）。値の単位は傾斜割合（例: 1/100=0.01）。
export const TILT_TABLE: ConversionBand[] = [
  { lower: 0, upper: 0.01, damageRatio: 0 },
  { lower: 0.01, upper: 0.017, damageRatio: 15 },
  { lower: 0.017, upper: 0.06, damageRatio: 45 },
  { lower: 0.06, upper: null, damageRatio: 60 },
];
