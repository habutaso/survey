import { DAMAGE_LEVEL_LIST } from 'common/constants';
import { classifyDamageLevel } from 'domain/assessment/classifyDamageLevel';
import { DAMAGE_LEVEL_THRESHOLDS } from 'domain/assessment/constants/damageLevelThresholds';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

// 表に基づく参照実装（テスト独立の真実）。下限包含・上限排他。
const REF_THRESHOLDS = [
  [50, 'totalCollapse'],
  [40, 'largeScaleHalf'],
  [30, 'mediumScaleHalf'],
  [20, 'half'],
  [10, 'quasiHalf'],
  [0, 'partial'],
] as const;

const expectedLevel = (r: number): string => REF_THRESHOLDS.find(([min]) => r >= min)![1];

describe('classifyDamageLevel 境界値（FR-24 / BR-2）', () => {
  test.each([
    [0, 'partial'],
    [9.9, 'partial'],
    [10, 'quasiHalf'],
    [19.9, 'quasiHalf'],
    [20, 'half'],
    [29.9, 'half'],
    [30, 'mediumScaleHalf'],
    [39.9, 'mediumScaleHalf'],
    [40, 'largeScaleHalf'],
    [49.9, 'largeScaleHalf'],
    [50, 'totalCollapse'],
    [100, 'totalCollapse'],
  ])('%f%% → %s', (ratio, level) => {
    expect(classifyDamageLevel(ratio)).toBe(level);
  });

  test('範囲外はクランプ（負→partial, 100超→totalCollapse, BR-4）', () => {
    expect(classifyDamageLevel(-10)).toBe('partial');
    expect(classifyDamageLevel(150)).toBe('totalCollapse');
  });

  test('丸め: 49.95→50.0→全壊 / 49.94→49.9→大規模半壊（Q8）', () => {
    expect(classifyDamageLevel(49.95)).toBe('totalCollapse');
    expect(classifyDamageLevel(49.94)).toBe('largeScaleHalf');
  });
});

describe('classifyDamageLevel PBT（US-805 / NFR-04）', () => {
  test('INV-4: 区分整合（任意 r で参照表と一致）', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), (r) => {
        const rounded = Math.round(r * 10) / 10;
        expect(classifyDamageLevel(r)).toBe(expectedLevel(rounded));
      }),
    );
  });

  test('INV-1: 結果は必ず DAMAGE_LEVEL_LIST に含まれる', () => {
    fc.assert(
      fc.property(fc.double({ min: -50, max: 200, noNaN: true }), (r) => {
        expect(DAMAGE_LEVEL_LIST).toContain(classifyDamageLevel(r));
      }),
    );
  });

  test('INV-2: 決定論（同一入力→同一結果）', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), (r) => {
        expect(classifyDamageLevel(r)).toBe(classifyDamageLevel(r));
      }),
    );
  });
});

describe('閾値マスタ整合（BR-2 / BR-37）', () => {
  test('minInclusive 降順・連続被覆（最下位=0, 隣接帯が連続）', () => {
    const mins = DAMAGE_LEVEL_THRESHOLDS.map((t) => t.minInclusive);
    expect(mins).toEqual([50, 40, 30, 20, 10, 0]);
    DAMAGE_LEVEL_THRESHOLDS.forEach((t, i) => {
      if (i === 0) {
        expect(t.maxExclusive).toBeNull();
      } else {
        const prev = DAMAGE_LEVEL_THRESHOLDS[i - 1]!;
        expect(t.maxExclusive).toBe(prev.minInclusive);
      }
    });
  });
});
