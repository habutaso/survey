import { ROLE_NAMES } from 'common/constants';
import type { SurveyDetailDto } from 'common/types/survey';
import type { UserDto } from 'common/types/user';
import { authMethod } from 'domain/user/model/authMethod';

// 調査の認可・PII 開示ポリシー（純粋・L2, BR-10/11/13）。authMethod を委譲して fail closed。
export const surveyPolicy = {
  // 提出（surveyor/admin, BR-10）。
  assertSubmitter: (actor: UserDto): void =>
    authMethod.assertRole(actor, [ROLE_NAMES.surveyor, ROLE_NAMES.admin]),

  // 承認・確定・正式判定（admin のみ, BR-11）。
  assertApprover: (actor: UserDto): void => authMethod.assertRole(actor, [ROLE_NAMES.admin]),

  // PII 閲覧可否（surveyor/admin のみ, BR-13）。
  canViewPii: (actor: UserDto): boolean =>
    authMethod.hasAnyRole(actor, [ROLE_NAMES.surveyor, ROLE_NAMES.admin]),

  // 詳細 DTO の PII マスク（viewer 向け, INV-5）。
  maskPii: (detail: SurveyDetailDto): SurveyDetailDto => ({
    ...detail,
    victimName: null,
    victimContact: null,
    victimAddress: null,
  }),
};