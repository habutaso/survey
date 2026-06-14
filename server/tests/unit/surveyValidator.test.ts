import { surveyValidator } from 'common/validators/survey';
import { describe, expect, test } from 'vitest';

const noForce = {
  houseWashedAway: false,
  groundScour: false,
  foundationWashout: false,
  fullCeilingInundation: false,
};

const baseFirst = {
  survey: { id: 's1', surveyType: 'first', address: 'a', houseNumber: '1', structureType: 'wood' },
  firstSurvey: { externalForceFlags: noForce },
};

const baseSecond = {
  survey: {
    id: 's2',
    surveyType: 'second',
    parentSurveyId: 's1',
    address: 'a',
    houseNumber: '1',
    structureType: 'wood',
  },
  secondSurvey: { partDamages: [{ part: 'roof', damageRatio: 10 }] },
};

const ok = (body: unknown): boolean => surveyValidator.submissionBody.safeParse(body).success;

describe('surveyValidator.submissionBody（区分排他・親 ID）', () => {
  test('有効な第1次/第2次は通過', () => {
    expect(ok(baseFirst)).toBe(true);
    expect(ok(baseSecond)).toBe(true);
  });

  test('第1次: 第1次入力欠落・第2次入力混在・親 ID 指定は不可', () => {
    expect(ok({ survey: baseFirst.survey })).toBe(false);
    expect(ok({ ...baseFirst, secondSurvey: { partDamages: [] } })).toBe(false);
    expect(ok({ ...baseFirst, survey: { ...baseFirst.survey, parentSurveyId: 'x' } })).toBe(false);
  });

  test('第2次: 第2次入力欠落・第1次入力混在・親 ID 欠落は不可', () => {
    expect(ok({ survey: baseSecond.survey })).toBe(false);
    expect(ok({ ...baseSecond, firstSurvey: { externalForceFlags: noForce } })).toBe(false);
    expect(
      ok({ survey: { ...baseSecond.survey, parentSurveyId: undefined }, secondSurvey: baseSecond.secondSurvey }),
    ).toBe(false);
  });
});

describe('surveyValidator 階按分合計（BR-20）', () => {
  test('合計=100 は通過・空配列も通過', () => {
    expect(ok({ ...baseFirst, firstSurvey: { externalForceFlags: noForce, floorApportionment: [{ floor: 1, ratio: 100 }] } })).toBe(true);
    expect(ok({ ...baseFirst, firstSurvey: { externalForceFlags: noForce, floorApportionment: [] } })).toBe(true);
  });

  test('合計≠100 は不可（first / second 双方）', () => {
    expect(ok({ ...baseFirst, firstSurvey: { externalForceFlags: noForce, floorApportionment: [{ floor: 1, ratio: 50 }] } })).toBe(false);
    expect(ok({ ...baseSecond, secondSurvey: { partDamages: [], floorApportionment: [{ floor: 1, ratio: 40 }] } })).toBe(false);
  });
});

describe('surveyValidator.chooseOfficialBody', () => {
  test('officialSurveyId 必須', () => {
    expect(surveyValidator.chooseOfficialBody.safeParse({ officialSurveyId: 'x' }).success).toBe(true);
    expect(surveyValidator.chooseOfficialBody.safeParse({}).success).toBe(false);
  });
});
