import type { FloorApportionmentBasis, FloorContribution } from 'common/types/assessment';
import type { FloorRatio } from 'common/types/survey';
import {
  DEFAULT_FLOOR_RATIO,
  FLOOR_RATIO_SUM_TOLERANCE,
} from 'domain/assessment/constants/defaultFloorRatio';
import { clampRatio } from 'domain/assessment/round';
import { ValidationError } from 'service/customAssert';

// 階別床面積比による加重平均（FR-28 / US-404 / Q5=A / BR-20・23・31・32）。
// combinedRatio（按分前の住家損害割合）を各階に一律適用し、床面積比で加重平均する。
// 比率合計100% の場合、結果は combinedRatio と一致する（按分保存則 / INV-5）。
export const applyFloorRatio = (
  combinedRatio: number,
  floorApportionment: FloorRatio[] | null,
): { ratioAfter: number; basis: FloorApportionmentBasis } => {
  const before = clampRatio(combinedRatio);
  const ratios = floorApportionment ?? DEFAULT_FLOOR_RATIO;
  const toFloor = (fr: FloorRatio): FloorContribution => ({
    floor: fr.floor,
    areaRatio: fr.ratio,
    floorDamageRatio: before,
  });

  // 単一階・未指定: 按分なし（BR-23）。
  if (ratios.length <= 1) {
    return {
      ratioAfter: before,
      basis: { applied: false, floors: ratios.map(toFloor), ratioBefore: before, ratioAfter: before },
    };
  }

  // 複数階: 比率合計=100%（許容誤差内）を要求（BR-20）。
  const sum = ratios.reduce((acc, fr) => acc + fr.ratio, 0);
  if (Math.abs(sum - 100) > FLOOR_RATIO_SUM_TOLERANCE) {
    throw new ValidationError(`floor area ratios must sum to 100 (got ${sum})`);
  }

  const weighted = ratios.reduce((acc, fr) => acc + (before * fr.ratio) / 100, 0);
  const after = clampRatio(weighted);
  return {
    ratioAfter: after,
    basis: { applied: true, floors: ratios.map(toFloor), ratioBefore: before, ratioAfter: after },
  };
};
