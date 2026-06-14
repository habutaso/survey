import type { FirstAssessmentInput } from 'common/types/assessment';
import type { ExternalForceFlags } from 'common/types/survey';
import { computeFirstAssessment } from 'domain/assessment/computeFirstAssessment';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';
import { externalForceFlagsArb, floorApportionmentArb, noExternalForce } from './assessmentFixtures';

const anyForce = (flags: ExternalForceFlags): boolean => Object.values(flags).some((v) => v);

const baseInput = (over: Partial<FirstAssessmentInput>): FirstAssessmentInput => ({
  externalForceFlags: noExternalForce,
  tiltRatio: null,
  inundationDepthCm: null,
  floorApportionment: null,
  ...over,
});

describe('computeFirstAssessment（FR-20〜22 / Q10=A）', () => {
  test('外力該当（住家流失）→ 全壊100%（BR-25）', () => {
    const result = computeFirstAssessment(
      baseInput({ externalForceFlags: { ...noExternalForce, houseWashedAway: true } }),
    );

    expect(result.damageRatio).toBe(100);
    expect(result.damageLevel).toBe('totalCollapse');
    expect(result.basis.surveyType).toBe('first');
    if (result.basis.surveyType === 'first') {
      expect(result.basis.externalForceApplied).toBe(true);
      expect(result.basis.externalForceReasons).toContain('houseWashedAway');
      expect(result.basis.floorBasis.applied).toBe(false);
    }
  });

  test('外力非該当・傾斜/浸水深とも未入力 → 0%・一部損壊（BR-27）', () => {
    const result = computeFirstAssessment(baseInput({}));

    expect(result.damageRatio).toBe(0);
    expect(result.damageLevel).toBe('partial');
  });

  test('浸水深のみ（150cm）→ 換算25%・半壊', () => {
    const result = computeFirstAssessment(baseInput({ inundationDepthCm: 150 }));

    expect(result.damageRatio).toBe(25);
    expect(result.damageLevel).toBe('half');
    if (result.basis.surveyType === 'first') {
      expect(result.basis.inundationContribution).toBe(25);
      expect(result.basis.tiltContribution).toBeNull();
    }
  });

  test('傾斜＋浸水深の合算（傾斜0.02→45, 浸水深50→10）= 55% 全壊', () => {
    const result = computeFirstAssessment(baseInput({ tiltRatio: 0.02, inundationDepthCm: 50 }));

    expect(result.damageRatio).toBe(55);
    expect(result.damageLevel).toBe('totalCollapse');
  });

  test('複数階按分（合計100%・一律）→ 損害割合は保存', () => {
    const result = computeFirstAssessment(
      baseInput({
        inundationDepthCm: 150,
        floorApportionment: [
          { floor: 1, ratio: 70 },
          { floor: 2, ratio: 30 },
        ],
      }),
    );

    expect(result.damageRatio).toBe(25);
    if (result.basis.surveyType === 'first') expect(result.basis.floorBasis.applied).toBe(true);
  });
});

describe('computeFirstAssessment PBT（US-805 / NFR-04）', () => {
  test('INV-1: damageRatio∈[0,100] かつ damageLevel 妥当', () => {
    fc.assert(
      fc.property(
        externalForceFlagsArb,
        fc.option(fc.double({ min: 0, max: 0.2, noNaN: true }), { nil: null }),
        fc.option(fc.double({ min: 0, max: 600, noNaN: true }), { nil: null }),
        (flags, tiltRatio, inundationDepthCm) => {
          const result = computeFirstAssessment(
            baseInput({ externalForceFlags: flags, tiltRatio, inundationDepthCm }),
          );

          expect(result.damageRatio).toBeGreaterThanOrEqual(0);
          expect(result.damageRatio).toBeLessThanOrEqual(100);
        },
      ),
    );
  });

  test('INV-2: 決定論', () => {
    fc.assert(
      fc.property(
        fc.option(fc.double({ min: 0, max: 600, noNaN: true }), { nil: null }),
        floorApportionmentArb,
        (inundationDepthCm, floorApportionment) => {
          const input = baseInput({ inundationDepthCm, floorApportionment });

          expect(computeFirstAssessment(input)).toEqual(computeFirstAssessment(input));
        },
      ),
    );
  });

  test('INV-3: 浸水深↑ → damageRatio 非減少（外力非該当・傾斜固定）', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 600, noNaN: true }),
        fc.double({ min: 0, max: 600, noNaN: true }),
        (a, b) => {
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          const rLo = computeFirstAssessment(baseInput({ inundationDepthCm: lo })).damageRatio;
          const rHi = computeFirstAssessment(baseInput({ inundationDepthCm: hi })).damageRatio;

          expect(rHi).toBeGreaterThanOrEqual(rLo);
        },
      ),
    );
  });

  test('INV-6: 外力いずれか true → 必ず totalCollapse', () => {
    fc.assert(
      fc.property(
        externalForceFlagsArb,
        fc.option(fc.double({ min: 0, max: 600, noNaN: true }), { nil: null }),
        (flags, inundationDepthCm) => {
          if (anyForce(flags)) {
            const result = computeFirstAssessment(baseInput({ externalForceFlags: flags, inundationDepthCm }));
            expect(result.damageLevel).toBe('totalCollapse');
            expect(result.damageRatio).toBe(100);
          }
        },
      ),
    );
  });
});
