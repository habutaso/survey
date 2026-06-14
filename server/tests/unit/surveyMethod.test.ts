import { ROLE_LIST, SURVEY_STATUS_LIST } from 'common/constants';
import type { SurveyStatus } from 'common/types/survey';
import { surveyMethod } from 'domain/survey/model/surveyMethod';
import type { TransitionAction } from 'domain/survey/model/surveyMethod';
import fc from 'fast-check';
import { ForbiddenError, ValidationError } from 'service/customAssert';
import { describe, expect, test } from 'vitest';
import { firstPayload, makeDetail, makeUser, minimalFirstPayload, secondPayload, sid } from './surveyFixtures';

const admin = makeUser(['admin']);
const surveyor = makeUser(['surveyor']);

describe('surveyMethod.createFromSubmission', () => {
  test('第1次: status=submitted, first 非 null/second null, PII/任意項目反映', () => {
    const entity = surveyMethod.createFromSubmission(surveyor, firstPayload('s-1'));

    expect(entity.status).toBe('submitted');
    expect(entity.surveyType).toBe('first');
    expect(entity.first).not.toBeNull();
    expect(entity.second).toBeNull();
    expect(entity.victimName).toBe('被災 太郎');
    expect(entity.buildingName).toBe('B棟');
    expect(entity.createdBy).toBe(surveyor.id);
    expect(entity.submittedAt).toBe(entity.createdTime);
  });

  test('最小ペイロード: 任意項目は null', () => {
    const entity = surveyMethod.createFromSubmission(surveyor, minimalFirstPayload('s-2'));

    expect(entity.victimName).toBeNull();
    expect(entity.buildingName).toBeNull();
    expect(entity.floors).toBeNull();
    expect(entity.latitude).toBeNull();
    expect(entity.first?.floorApportionment).toBeNull();
  });

  test('第2次: parentSurveyId 反映・second 非 null/first null', () => {
    const entity = surveyMethod.createFromSubmission(surveyor, secondPayload('s-3', 's-1'));

    expect(entity.surveyType).toBe('second');
    expect(entity.parentSurveyId).toBe('s-1');
    expect(entity.first).toBeNull();
    expect(entity.second).not.toBeNull();
  });

  test('INV-4: 区分排他（first XOR second）', () => {
    const f = surveyMethod.createFromSubmission(surveyor, firstPayload('s-1'));
    const s = surveyMethod.createFromSubmission(surveyor, secondPayload('s-3', 's-1'));

    expect((f.first === null) !== (f.second === null)).toBe(true);
    expect((s.first === null) !== (s.second === null)).toBe(true);
  });
});

describe('surveyMethod.applyAssessment', () => {
  test('判定結果を反映', () => {
    const entity = surveyMethod.createFromSubmission(surveyor, firstPayload('s-1'));
    const applied = surveyMethod.applyAssessment(entity, {
      damageRatio: 55,
      damageLevel: 'halfDestroyed',
      basis: { path: 'x' },
    });

    expect(applied.damageRatio).toBe(55);
    expect(applied.damageLevel).toBe('halfDestroyed');
    expect(applied.assessmentBasis).toEqual({ path: 'x' });
  });
});

describe('surveyMethod.assertMutable', () => {
  test('confirmed は ForbiddenError', () => {
    expect(() => surveyMethod.assertMutable({ status: 'confirmed' })).toThrow(ForbiddenError);
  });

  test('confirmed 以外は通過', () => {
    expect(() => surveyMethod.assertMutable({ status: 'approved' })).not.toThrow();
  });
});

describe('surveyMethod.assertReexaminationAllowed', () => {
  test('first かつ confirmed は通過', () => {
    expect(() =>
      surveyMethod.assertReexaminationAllowed({ surveyType: 'first', status: 'confirmed' }),
    ).not.toThrow();
  });

  test('first 以外は ValidationError', () => {
    expect(() =>
      surveyMethod.assertReexaminationAllowed({ surveyType: 'second', status: 'confirmed' }),
    ).toThrow(ValidationError);
  });

  test('未確定は ForbiddenError', () => {
    expect(() =>
      surveyMethod.assertReexaminationAllowed({ surveyType: 'first', status: 'approved' }),
    ).toThrow(ForbiddenError);
  });
});

describe('surveyMethod.assertOfficialTarget', () => {
  const first = makeDetail('confirmed', { id: sid('survey-1') });
  const second = makeDetail('confirmed', { id: sid('survey-2'), parentSurveyId: sid('survey-1') }, 'second');

  test('当該第1次が confirmed なら通過', () => {
    expect(() => surveyMethod.assertOfficialTarget(first, [second], first.id)).not.toThrow();
  });

  test('第2次群のいずれかなら通過', () => {
    expect(() => surveyMethod.assertOfficialTarget(first, [second], second.id)).not.toThrow();
  });

  test('対象外 ID は ValidationError', () => {
    expect(() => surveyMethod.assertOfficialTarget(first, [second], sid('survey-9'))).toThrow(
      ValidationError,
    );
  });

  test('未確定対象は ForbiddenError', () => {
    const draftSecond = makeDetail('approved', { id: sid('survey-2'), parentSurveyId: sid('survey-1') }, 'second');

    expect(() => surveyMethod.assertOfficialTarget(first, [draftSecond], draftSecond.id)).toThrow(
      ForbiddenError,
    );
  });
});

describe('surveyMethod.approve / confirm / applyOfficial', () => {
  test('approve: submitted→approved（admin, approvedBy/At 設定）', () => {
    const entity = surveyMethod.approve(admin, makeDetail('submitted'));

    expect(entity.status).toBe('approved');
    expect(entity.approvedBy).toBe(admin.id);
    expect(entity.approvedAt).not.toBeNull();
  });

  test('confirm: approved→confirmed（admin, confirmedBy/At 設定）', () => {
    const entity = surveyMethod.confirm(admin, makeDetail('approved'));

    expect(entity.status).toBe('confirmed');
    expect(entity.confirmedBy).toBe(admin.id);
  });

  test('applyOfficial: official* 設定', () => {
    const first = makeDetail('confirmed', { id: sid('survey-1') });
    const entity = surveyMethod.applyOfficial(admin, first, first.id);

    expect(entity.officialSurveyId).toBe('survey-1');
    expect(entity.officialChosenBy).toBe(admin.id);
    expect(entity.officialChosenAt).not.toBeNull();
  });
});

// INV-1: 状態遷移健全性（PBT-06）。許可表どおりに成功/拒否し、confirmed は終端。
const transitionActions: TransitionAction[] = ['approve', 'confirm', 'reject'];
const validTransitions: Record<string, SurveyStatus> = {
  'submitted:approve': 'approved',
  'approved:confirm': 'confirmed',
  'submitted:reject': 'draft',
  'approved:reject': 'draft',
};

test('INV-1: 全 {状態×action×ロール} で許可表に一致するときのみ遷移（PBT）', () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...SURVEY_STATUS_LIST),
      fc.constantFrom(...transitionActions),
      fc.subarray([...ROLE_LIST]),
      (status, action, roles) => {
        const actor = makeUser(roles);
        const expected = validTransitions[`${status}:${action}`];
        const run = (): SurveyStatus => surveyMethod.assertTransition(status, action, actor);

        if (expected === undefined) expect(run).toThrow(ValidationError);
        else if (roles.includes('admin')) expect(run()).toBe(expected);
        else expect(run).toThrow(ForbiddenError);
      },
    ),
  );
});

test('INV-1: confirmed は終端（あらゆる action が ValidationError）', () => {
  for (const action of transitionActions) {
    const run = (): SurveyStatus => surveyMethod.assertTransition('confirmed', action, admin);

    expect(run).toThrow(ValidationError);
  }
});
