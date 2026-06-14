import type { FloorRatio } from 'common/types/survey';

// 既定の階按分（FR-28 / US-404）。入力なし＝単一階100%扱い（BR-23）。
export const DEFAULT_FLOOR_RATIO: FloorRatio[] = [{ floor: 1, ratio: 100 }];

// 階按分比率合計の許容誤差（BR-20）。浮動小数の正規化を考慮。
export const FLOOR_RATIO_SUM_TOLERANCE = 0.1;
