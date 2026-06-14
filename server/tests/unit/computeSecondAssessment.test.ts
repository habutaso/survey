import type { PartContributionDetail, SecondAssessmentInput } from 'common/types/assessment';
import { computeSecondAssessment } from 'domain/assessment/computeSecondAssessment';
import { PART_COMPOSITION, PART_DEFINITIONS } from 'domain/assessment/constants/partComposition';
import fc from 'fast-check';
import { ValidationError } from 'service/customAssert';
import { describe, expect, test } from 'vitest';
import { floorApportionmentArb, partDamagesArb } from './assessmentFixtures';

const allParts = (damageRatio: number): { part: string; damageRatio: number }[] =>
  PART_DEFINITIONS.map((p) => ({ part: p.part, damageRatio }));

const sumContributions = (breakdown: PartContributionDetail[]): number =>
  breakdown.reduce((acc, d) => acc + d.contribution, 0);

const compositionSum = (structureType: 'wood' | 'nonWood'): number =>
  PART_COMPOSITION[structureType]!.parts.reduce((acc, p) => acc + p.compositionRatio, 0);

const partKeys = PART_DEFINITIONS.map((p) => p.part);

const baseInput = (over: Partial<SecondAssessmentInput>): SecondAssessmentInput => ({
  structureType: 'wood',
  partDamages: [],
  floorApportionment: null,
  ...over,
});

describe('computeSecondAssessment（FR-23 / Q4=A）', () => {
  test('単一部位（屋根50%, 木造構成比15%）→ 寄与7.5%・一部損壊', () => {
    const result = computeSecondAssessment(baseInput({ partDamages: [{ part: 'roof', damageRatio: 50 }] }));

    expect(result.damageRatio).toBe(7.5);
    expect(result.damageLevel).toBe('partial');
    if (result.basis.surveyType === 'second') {
      expect(result.basis.partBreakdown[0]?.contribution).toBeCloseTo(7.5, 10);
    }
  });

  test('INV-7: 全部位100% → 損害割合100%・全壊（構成比合計=100）', () => {
    expect(computeSecondAssessment(baseInput({ partDamages: allParts(100) })).damageRatio).toBe(100);
    expect(computeSecondAssessment(baseInput({ structureType: 'nonWood', partDamages: allParts(100) })).damageRatio).toBe(100);
  });

  test('未定義部位 → ValidationError（BR-26）', () => {
    expect(() =>
      computeSecondAssessment(baseInput({ partDamages: [{ part: 'unknownPart', damageRatio: 50 }] })),
    ).toThrow(ValidationError);
  });

  test('損傷率範囲外 → ValidationError（BR-29）', () => {
    expect(() => computeSecondAssessment(baseInput({ partDamages: [{ part: 'roof', damageRatio: 150 }] }))).toThrow(
      ValidationError,
    );
    expect(() => computeSecondAssessment(baseInput({ partDamages: [{ part: 'roof', damageRatio: -1 }] }))).toThrow(
      ValidationError,
    );
  });

  test('木造/非木造で構成比マスタが切替（同入力でも結果が異なりうる, Q4=A）', () => {
    const parts = [{ part: 'foundation', damageRatio: 100 }];
    const wood = computeSecondAssessment(baseInput({ structureType: 'wood', partDamages: parts })).damageRatio;
    const nonWood = computeSecondAssessment(baseInput({ structureType: 'nonWood', partDamages: parts })).damageRatio;

    expect(wood).toBe(15); // 木造 foundation 構成比
    expect(nonWood).toBe(20); // 非木造 foundation 構成比
  });
});

describe('構成比マスタ整合（BR-21）', () => {
  test.each(['wood', 'nonWood'] as const)('%s の構成比合計=100%', (structureType) => {
    expect(compositionSum(structureType)).toBe(100);
  });
});

describe('computeSecondAssessment PBT（US-805 / NFR-04）', () => {
  test('INV-1: damageRatio∈[0,100]', () => {
    fc.assert(
      fc.property(fc.constantFrom('wood' as const, 'nonWood' as const), partDamagesArb, (structureType, partDamages) => {
        const result = computeSecondAssessment(baseInput({ structureType, partDamages }));

        expect(result.damageRatio).toBeGreaterThanOrEqual(0);
        expect(result.damageRatio).toBeLessThanOrEqual(100);
      }),
    );
  });

  test('INV-2: 決定論', () => {
    fc.assert(
      fc.property(partDamagesArb, floorApportionmentArb, (partDamages, floorApportionment) => {
        const input = baseInput({ partDamages, floorApportionment });

        expect(computeSecondAssessment(input)).toEqual(computeSecondAssessment(input));
      }),
    );
  });

  test('INV-8: basis.partBreakdown の contribution 合計 ＝ combinedRatio', () => {
    fc.assert(
      fc.property(partDamagesArb, (partDamages) => {
        const result = computeSecondAssessment(baseInput({ partDamages }));
        if (result.basis.surveyType === 'second') {
          expect(result.basis.combinedRatio).toBeCloseTo(sumContributions(result.basis.partBreakdown), 6);
        }
      }),
    );
  });

  test('INV-3: 単一部位の損傷率↑ → damageRatio 非減少', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...partKeys),
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (part, a, b) => {
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          const rLo = computeSecondAssessment(baseInput({ partDamages: [{ part, damageRatio: lo }] })).damageRatio;
          const rHi = computeSecondAssessment(baseInput({ partDamages: [{ part, damageRatio: hi }] })).damageRatio;

          expect(rHi).toBeGreaterThanOrEqual(rLo);
        },
      ),
    );
  });
});
