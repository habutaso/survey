import { applyFloorRatio } from 'domain/assessment/applyFloorRatio';
import fc from 'fast-check';
import { ValidationError } from 'service/customAssert';
import { describe, expect, test } from 'vitest';
import { floorApportionmentArb } from './assessmentFixtures';

describe('applyFloorRatio（FR-28 / US-404 / BR-20・23・31）', () => {
  test('null（未指定）→ 按分なし・単一階扱い（BR-23）', () => {
    const { ratioAfter, basis } = applyFloorRatio(42, null);

    expect(ratioAfter).toBe(42);
    expect(basis.applied).toBe(false);
    expect(basis.floors).toEqual([{ floor: 1, areaRatio: 100, floorDamageRatio: 42 }]);
    expect(basis.ratioBefore).toBe(42);
  });

  test('単一階指定 → 按分なし', () => {
    const { ratioAfter, basis } = applyFloorRatio(30, [{ floor: 1, ratio: 100 }]);

    expect(ratioAfter).toBe(30);
    expect(basis.applied).toBe(false);
  });

  test('複数階・合計100% → 加重平均（一律適用は恒等, BR-31）', () => {
    const { ratioAfter, basis } = applyFloorRatio(40, [
      { floor: 1, ratio: 60 },
      { floor: 2, ratio: 40 },
    ]);

    expect(ratioAfter).toBeCloseTo(40, 10);
    expect(basis.applied).toBe(true);
    expect(basis.floors).toHaveLength(2);
  });

  test('合計≠100%（許容誤差外）→ ValidationError（BR-20）', () => {
    expect(() =>
      applyFloorRatio(40, [
        { floor: 1, ratio: 60 },
        { floor: 2, ratio: 30 },
      ]),
    ).toThrow(ValidationError);
  });

  test('入力過大は [0,100] にクランプ（BR-22）', () => {
    const { ratioAfter } = applyFloorRatio(150, null);

    expect(ratioAfter).toBe(100);
  });
});

describe('applyFloorRatio PBT（US-805）', () => {
  test('INV-5: 按分保存（合計100%・全階一律 → 按分後＝按分前）', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), floorApportionmentArb, (ratio, floors) => {
        const { ratioAfter } = applyFloorRatio(ratio, floors);

        expect(ratioAfter).toBeCloseTo(ratio, 6);
      }),
    );
  });

  test('INV-1: 結果は [0,100]', () => {
    fc.assert(
      fc.property(fc.double({ min: -50, max: 200, noNaN: true }), floorApportionmentArb, (ratio, floors) => {
        const { ratioAfter } = applyFloorRatio(ratio, floors);

        expect(ratioAfter).toBeGreaterThanOrEqual(0);
        expect(ratioAfter).toBeLessThanOrEqual(100);
      }),
    );
  });

  test('INV-5b: 階の並べ替えで結果不変', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), floorApportionmentArb, (ratio, floors) => {
        const reversed = [...floors].reverse();

        expect(applyFloorRatio(ratio, floors).ratioAfter).toBeCloseTo(
          applyFloorRatio(ratio, reversed).ratioAfter,
          6,
        );
      }),
    );
  });
});
