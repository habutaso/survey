import type { ConversionBand } from 'domain/assessment/types';

// 床上浸水深(cm)→損害割合(%) 換算表（第1次, FR-22）。浸水深が深いほど損害割合が大きい単調増加。
// @source FR-22（運用指針 水害編）。
// 【重要 / Q3=A】出典確定までの代表値プレースホルダ。実数値は docs/references 確定後に差し替える。
// lower(cm) 包含・upper(cm) 排他。最上位帯の upper は null（上限なし）。
export const INUNDATION_DEPTH_TABLE: ConversionBand[] = [
  { lower: 0, upper: 100, damageRatio: 10 },
  { lower: 100, upper: 180, damageRatio: 25 },
  { lower: 180, upper: 300, damageRatio: 45 },
  { lower: 300, upper: null, damageRatio: 60 },
];
