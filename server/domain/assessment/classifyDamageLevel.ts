import type { DamageLevel } from 'common/types/assessment';
import { DAMAGE_LEVEL_THRESHOLDS } from 'domain/assessment/constants/damageLevelThresholds';
import { clampRatio, roundRatio } from 'domain/assessment/round';
import { customAssert } from 'service/customAssert';

// 損害割合(%)→被害度6区分（FR-24 / US-402 / BR-1〜4）。
// [0,100] クランプ後に小数第1位丸め（Q8）。閾値表は minInclusive 降順・連続のため、
// 「最初に r >= minInclusive を満たす帯」が該当区分となる（maxExclusive は表整合テストで検証）。
// 最下位帯 partial の minInclusive=0、r>=0 のため必ず該当する。
export const classifyDamageLevel = (damageRatio: number): DamageLevel => {
  const r = roundRatio(clampRatio(damageRatio));
  const band = DAMAGE_LEVEL_THRESHOLDS.find((t) => r >= t.minInclusive);
  customAssert(band, 'damage level thresholds must cover the [0,100] range');
  return band.level;
};
