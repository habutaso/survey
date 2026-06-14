import type { ExternalForceFlags, FloorRatio, PartDamage } from 'common/types/survey';
import { PART_DEFINITIONS } from 'domain/assessment/constants/partComposition';
import fc from 'fast-check';

// 損害割合・損傷率（%, [0,100]）。
export const ratioArb = fc.double({ min: 0, max: 100, noNaN: true });

// 外力フラグ（全組合せ）。
export const externalForceFlagsArb: fc.Arbitrary<ExternalForceFlags> = fc.record({
  houseWashedAway: fc.boolean(),
  groundScour: fc.boolean(),
  foundationWashout: fc.boolean(),
  fullCeilingInundation: fc.boolean(),
});

// 外力非該当（全 false）。
export const noExternalForce: ExternalForceFlags = {
  houseWashedAway: false,
  groundScour: false,
  foundationWashout: false,
  fullCeilingInundation: false,
};

// 合計100% に正規化した階按分（floor=1..n）。
export const floorApportionmentArb: fc.Arbitrary<FloorRatio[]> = fc
  .array(fc.double({ min: 0.01, max: 1, noNaN: true }), { minLength: 1, maxLength: 5 })
  .map((weights) => {
    const sum = weights.reduce((acc, w) => acc + w, 0);
    return weights.map((w, i) => ({ floor: i + 1, ratio: (w / sum) * 100 }));
  });

// マスタ定義部位からの部分集合 ＋ [0,100] 損傷率。
export const partDamagesArb: fc.Arbitrary<PartDamage[]> = fc.uniqueArray(
  fc.record({ part: fc.constantFrom(...PART_DEFINITIONS.map((p) => p.part)), damageRatio: ratioArb }),
  { selector: (pd) => pd.part, maxLength: PART_DEFINITIONS.length },
);
