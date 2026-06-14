import type { SurveyDetailDto } from 'common/types/survey';
import type { UserDto } from 'common/types/user';
import type { AuditEvent } from 'domain/audit/model/auditMethod';
import { auditMethod } from 'domain/audit/model/auditMethod';

const emptyIfNull = (value: string | null): string => value ?? '';

const statusBefore = (before: SurveyDetailDto | null): string =>
  emptyIfNull(before === null ? null : before.status);

// 監査イベント生成（純粋, BR-23 / NFR-08）。実値の保存は呼出側 auditUseCase.record が行う。
export const surveyAudit = {
  // 提出イベント（survey.submit ＋ PII 変更時の pii.change マスク）。
  submitEvents: (
    actor: UserDto,
    before: SurveyDetailDto | null,
    saved: SurveyDetailDto,
  ): AuditEvent[] => {
    const submit: AuditEvent = {
      actorUserId: actor.id,
      action: 'survey.submit',
      targetType: 'survey',
      targetId: saved.id,
      outcome: 'success',
      summary: '調査提出',
      changes: [{ field: 'status', before: statusBefore(before), after: saved.status }],
    };

    const piiChanges = auditMethod.toFieldChanges([
      {
        field: 'victimName',
        before: emptyIfNull(before === null ? null : before.victimName),
        after: emptyIfNull(saved.victimName),
        pii: true,
      },
      {
        field: 'victimContact',
        before: emptyIfNull(before === null ? null : before.victimContact),
        after: emptyIfNull(saved.victimContact),
        pii: true,
      },
      {
        field: 'victimAddress',
        before: emptyIfNull(before === null ? null : before.victimAddress),
        after: emptyIfNull(saved.victimAddress),
        pii: true,
      },
    ]);

    if (piiChanges.length === 0) return [submit];

    return [
      submit,
      {
        actorUserId: actor.id,
        action: 'pii.change',
        targetType: 'survey',
        targetId: saved.id,
        outcome: 'success',
        summary: '被災者情報の登録/変更',
        changes: piiChanges,
      },
    ];
  },

  // 状態遷移イベント（survey.approve / survey.confirm）。
  statusEvent: (
    actor: UserDto,
    action: 'survey.approve' | 'survey.confirm',
    before: SurveyDetailDto,
    saved: SurveyDetailDto,
  ): AuditEvent => ({
    actorUserId: actor.id,
    action,
    targetType: 'survey',
    targetId: saved.id,
    outcome: 'success',
    summary: action === 'survey.approve' ? '調査承認' : '調査確定',
    changes: [{ field: 'status', before: before.status, after: saved.status }],
  }),

  // 正式判定イベント（survey.officialJudgment）。
  officialEvent: (
    actor: UserDto,
    before: SurveyDetailDto,
    saved: SurveyDetailDto,
    officialSurveyId: string,
  ): AuditEvent => ({
    actorUserId: actor.id,
    action: 'survey.officialJudgment',
    targetType: 'survey',
    targetId: saved.id,
    outcome: 'success',
    summary: '正式判定の選択',
    changes: [
      { field: 'officialSurveyId', before: emptyIfNull(before.officialSurveyId), after: officialSurveyId },
    ],
  }),
};