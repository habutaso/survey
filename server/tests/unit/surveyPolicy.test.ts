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

  test('assertExporter: admin 通過・他は拒否（U5 / BR-U5-2/3）', () => {
    expect(() => surveyPolicy.assertExporter(makeUser(['admin']))).not.toThrow();
    expect(() => surveyPolicy.assertExporter(makeUser(['surveyor']))).toThrow(ForbiddenError);
    expect(() => surveyPolicy.assertExporter(makeUser(['viewer']))).toThrow(ForbiddenError);
  });

  test('scopeForList: 無ロールは ForbiddenError', () => {
    expect(() => surveyPolicy.scopeForList(makeUser([]), {})).toThrow(ForbiddenError);
  });

  test('scopeForList: admin は filter 不変（全件）', () => {
    expect(surveyPolicy.scopeForList(makeUser(['admin'], 'admin-1'), { status: 'submitted' })).toEqual({
      status: 'submitted',
    });
  });

  test('scopeForList: viewer は filter 不変（全件）', () => {
    expect(surveyPolicy.scopeForList(makeUser(['viewer'], 'viewer-1'), {})).toEqual({});
  });

  test('scopeForList: surveyor は createdBy を自分に強制上書き（他者指定を無視）', () => {
    const surveyor = makeUser(['surveyor'], 'surveyor-1');
    const scoped = surveyPolicy.scopeForList(surveyor, { createdBy: makeUser([], 'other').id });

    expect(scoped.createdBy).toBe(surveyor.id);
  });

  test('scopeForList: admin かつ surveyor は admin 扱い（createdBy 上書きしない）', () => {
    expect(surveyPolicy.scopeForList(makeUser(['surveyor', 'admin'], 'both-1'), {}).createdBy).toBeUndefined();
  });
});
