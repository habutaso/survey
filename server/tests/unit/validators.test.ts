import { DEFAULT_STRING_MAX } from 'common/constants';
import { auditActionValidator, auditOutcomeValidator } from 'common/validators/audit';
import { boundedString, epochMs, numberInRange, percentage } from 'common/validators/common';
import { describe, expect, test } from 'vitest';

describe('common validators', () => {
  test('percentage は 0–100 を許可し範囲外を拒否', () => {
    expect(percentage.safeParse(0).success).toBe(true);
    expect(percentage.safeParse(100).success).toBe(true);
    expect(percentage.safeParse(-1).success).toBe(false);
    expect(percentage.safeParse(101).success).toBe(false);
  });

  test('boundedString は既定最大長を適用', () => {
    expect(boundedString().safeParse('a'.repeat(DEFAULT_STRING_MAX)).success).toBe(true);
    expect(boundedString().safeParse('a'.repeat(DEFAULT_STRING_MAX + 1)).success).toBe(false);
    expect(boundedString(3).safeParse('abcd').success).toBe(false);
  });

  test('numberInRange は min/max を適用', () => {
    const depth = numberInRange(0, 10);

    expect(depth.safeParse(5).success).toBe(true);
    expect(depth.safeParse(-1).success).toBe(false);
    expect(depth.safeParse(11).success).toBe(false);
  });

  test('epochMs は非負整数のみ許可', () => {
    expect(epochMs.safeParse(0).success).toBe(true);
    expect(epochMs.safeParse(1.5).success).toBe(false);
    expect(epochMs.safeParse(-1).success).toBe(false);
  });
});

describe('audit validators', () => {
  test('auditActionValidator は既知アクションのみ許可', () => {
    expect(auditActionValidator.safeParse('user.roles.change').success).toBe(true);
    expect(auditActionValidator.safeParse('unknown.action').success).toBe(false);
  });

  test('auditOutcomeValidator は success/failure のみ許可', () => {
    expect(auditOutcomeValidator.safeParse('success').success).toBe(true);
    expect(auditOutcomeValidator.safeParse('failure').success).toBe(true);
    expect(auditOutcomeValidator.safeParse('partial').success).toBe(false);
  });
});
