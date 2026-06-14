import { surveyPolicy } from 'domain/survey/model/surveyPolicy';
import { ForbiddenError } from 'service/customAssert';
import { describe, expect, test } from 'vitest';
import { makeDetail, makeUser } from './surveyFixtures';

describe('surveyPolicy', () => {
  test('assertSubmitter: surveyor/admin 通過・viewer 拒否（BR-10）', () => {
    expect(() => surveyPolicy.assertSubmitter(makeUser(['surveyor']))).not.toThrow();
    expect(() => surveyPolicy.assertSubmitter(makeUser(['admin']))).not.toThrow();
    expect(() => surveyPolicy.assertSubmitter(makeUser(['viewer']))).toThrow(ForbiddenError);
  });

  test('assertApprover: admin 通過・他は拒否（BR-11）', () => {
    expect(() => surveyPolicy.assertApprover(makeUser(['admin']))).not.toThrow();
    expect(() => surveyPolicy.assertApprover(makeUser(['surveyor']))).toThrow(ForbiddenError);
  });

  test('canViewPii: surveyor/admin true・viewer false（BR-13）', () => {
    expect(surveyPolicy.canViewPii(makeUser(['admin']))).toBe(true);
    expect(surveyPolicy.canViewPii(makeUser(['viewer']))).toBe(false);
  });

  test('maskPii: victim* を null 化（INV-5）', () => {
    const masked = surveyPolicy.maskPii(
      makeDetail('submitted', { victimName: 'x', victimContact: 'y', victimAddress: 'z' }),
    );

    expect(masked.victimName).toBeNull();
    expect(masked.victimContact).toBeNull();
    expect(masked.victimAddress).toBeNull();
  });
});
