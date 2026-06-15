import { brandedId } from 'common/validators/brandedId';
import { buildSurveyWhere } from 'domain/survey/store/surveyQuery';
import { ulid } from 'ulid';
import { describe, expect, test } from 'vitest';

describe('buildSurveyWhere（U5 / BR-U5-7）', () => {
  test('空フィルタは空 where', () => {
    expect(buildSurveyWhere({})).toEqual({});
  });

  test('status 明示はそのまま、confirmedOnly より優先', () => {
    expect(buildSurveyWhere({ status: 'submitted', confirmedOnly: true }).status).toBe('submitted');
  });

  test('confirmedOnly=true は status 未指定時に confirmed へ展開', () => {
    expect(buildSurveyWhere({ confirmedOnly: true }).status).toBe('confirmed');
  });

  test('confirmedOnly=false は status を設定しない', () => {
    expect(buildSurveyWhere({ confirmedOnly: false }).status).toBeUndefined();
  });

  test('surveyType / structureType / damageLevel / createdBy を反映', () => {
    const createdBy = brandedId.user.dto.parse(ulid());
    const where = buildSurveyWhere({
      surveyType: 'second',
      structureType: 'nonWood',
      damageLevel: 'half',
      createdBy,
    });

    expect(where.surveyType).toBe('second');
    expect(where.structureType).toBe('nonWood');
    expect(where.damageLevel).toBe('half');
    expect(where.createdBy).toBe(createdBy);
  });

  test('address は大文字小文字無視の部分一致', () => {
    expect(buildSurveyWhere({ address: '東京' }).address).toEqual({
      contains: '東京',
      mode: 'insensitive',
    });
  });

  test('createdFrom のみ → gte のみ', () => {
    expect(buildSurveyWhere({ createdFrom: 1000 }).createdAt).toEqual({ gte: new Date(1000) });
  });

  test('createdTo のみ → lte のみ', () => {
    expect(buildSurveyWhere({ createdTo: 2000 }).createdAt).toEqual({ lte: new Date(2000) });
  });

  test('createdFrom と createdTo 両方 → gte/lte', () => {
    expect(buildSurveyWhere({ createdFrom: 1000, createdTo: 2000 }).createdAt).toEqual({
      gte: new Date(1000),
      lte: new Date(2000),
    });
  });
});
