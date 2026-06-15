import { ROLE_NAMES } from 'common/constants';
import { brandedId } from 'common/validators/brandedId';
import { exportUseCase } from 'domain/export/exportUseCase';
import { authMethod } from 'domain/user/model/authMethod';
import { defineController } from './$relay';

export default defineController(() => ({
  // L1 多層防御（BR-U5-2）: admin のみ。UseCase でも assertExporter で再確認。
  get: async ({ user, params }) => {
    authMethod.assertRole(user, [ROLE_NAMES.admin]);

    return {
      status: 200,
      body: await exportUseCase.buildSurveyPdf(user, brandedId.survey.dto.parse(params.surveyId)),
    };
  },
}));
