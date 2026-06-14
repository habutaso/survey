import { DAMAGE_LEVEL_NAMES } from 'common/constants';
import type { DamageLevelThreshold } from 'domain/assessment/types';

// 被害度6区分の損害割合(%)閾値テーブル。
// @source FR-24（内閣府運用指針, 確定値。プレースホルダではない）。
// 区間は下限包含・上限排他。重い順に走査する（classifyDamageLevel）。
export const DAMAGE_LEVEL_THRESHOLDS: DamageLevelThreshold[] = [
  { level: DAMAGE_LEVEL_NAMES.totalCollapse, minInclusive: 50, maxExclusive: null },
  { level: DAMAGE_LEVEL_NAMES.largeScaleHalf, minInclusive: 40, maxExclusive: 50 },
  { level: DAMAGE_LEVEL_NAMES.mediumScaleHalf, minInclusive: 30, maxExclusive: 40 },
  { level: DAMAGE_LEVEL_NAMES.half, minInclusive: 20, maxExclusive: 30 },
  { level: DAMAGE_LEVEL_NAMES.quasiHalf, minInclusive: 10, maxExclusive: 20 },
  { level: DAMAGE_LEVEL_NAMES.partial, minInclusive: 0, maxExclusive: 10 },
];
