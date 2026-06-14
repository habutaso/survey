import { ROLE_NAMES } from 'common/constants';
import { brandedId } from 'common/validators/brandedId';
import { surveyUseCase } from 'domain/survey/surveyUseCase';
import { authMethod } from 'domain/user/model/authMethod';
import { defineController } from './$relay';

export default defineController(() => ({
  post: async ({ user, params }) => {
    // L1 多層防御（BR-11）: admin 認可を強制（UseCase でも再確認）。
    authMethod.assertRole(user, [ROLE_NAMES.admin]);

    return {
      status: 200,
      body: await surveyUseCase.approve(user, brandedId.survey.dto.parse(params.surveyId)),
    };
  },
}));