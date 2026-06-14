import { surveyAudit } from 'domain/survey/model/surveyAudit';
import { describe, expect, test } from 'vitest';
import { makeDetail, makeUser, sid } from './surveyFixtures';

const actor = makeUser(['surveyor']);

describe('surveyAudit.submitEvents', () => {
  test('新規 PII あり: survey.submit + pii.change（INV-5: マスクのみ）', () => {
    const saved = makeDetail('submitted', { victimName: '太郎', victimContact: '090-1111-2222' });
    const events = surveyAudit.submitEvents(actor, null, saved);

    expect(events.map((e) => e.action)).toEqual(['survey.submit', 'pii.change']);

    const serialized = JSON.stringify(events[1]!.changes);

    expect(serialized).not.toContain('太郎');
    expect(serialized).not.toContain('090-1111-2222');
    expect(events[1]!.changes).toContainEqual({ field: 'victimName', before: '***', after: '***' });
  });

  test('PII なし: survey.submit のみ', () => {
    const events = surveyAudit.submitEvents(actor, null, makeDetail('submitted'));

    expect(events).toHaveLength(1);
    expect(events[0]!.changes).toEqual([{ field: 'status', before: '', after: 'submitted' }]);
  });

  test('上書き（before 非 null）: status before 反映', () => {
    const events = surveyAudit.submitEvents(actor, makeDetail('approved'), makeDetail('submitted'));

    expect(events[0]!.changes).toEqual([{ field: 'status', before: 'approved', after: 'submitted' }]);
  });
});

describe('surveyAudit.statusEvent', () => {
  test('approve', () => {
    const ev = surveyAudit.statusEvent(
      actor,
      'survey.approve',
      makeDetail('submitted'),
      makeDetail('approved'),
    );

    expect(ev.action).toBe('survey.approve');
    expect(ev.summary).toBe('調査承認');
    expect(ev.changes).toEqual([{ field: 'status', before: 'submitted', after: 'approved' }]);
  });

  test('confirm', () => {
    const ev = surveyAudit.statusEvent(
      actor,
      'survey.confirm',
      makeDetail('approved'),
      makeDetail('confirmed'),
    );

    expect(ev.summary).toBe('調査確定');
  });
});

describe('surveyAudit.officialEvent', () => {
  test('officialJudgment（before 空→after）', () => {
    const ev = surveyAudit.officialEvent(
      actor,
      makeDetail('confirmed', { id: sid('survey-1') }),
      makeDetail('confirmed', { id: sid('survey-1'), officialSurveyId: sid('survey-1') }),
      'survey-1',
    );

    expect(ev.action).toBe('survey.officialJudgment');
    expect(ev.changes).toEqual([{ field: 'officialSurveyId', before: '', after: 'survey-1' }]);
  });
});
