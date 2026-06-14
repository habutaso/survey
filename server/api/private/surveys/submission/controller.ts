import { ROLE_NAMES } from 'common/constants';
import { surveyValidator } from 'common/validators/survey';
import { surveyUseCase } from 'domain/survey/surveyUseCase';
import { authMethod } from 'domain/user/model/authMethod';
import { defineController } from './$relay';

export default defineController(() => ({
  post: {
    validators: { body: surveyValidator.submissionBody },
    handler: async ({ user, body }) => {
      // L1 多層防御（BR-10）: API 層でも提出者ロールを強制（UseCase でも再確認）。
      authMethod.assertRole(user, [ROLE_NAMES.surveyor, ROLE_NAMES.admin]);

      return { status: 200, body: await surveyUseCase.ingestSubmission(user, body) };
    },
  },
}));