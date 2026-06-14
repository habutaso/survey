import { ROLE_NAMES } from 'common/constants';
import { brandedId } from 'common/validators/brandedId';
import { surveyValidator } from 'common/validators/survey';
import { surveyUseCase } from 'domain/survey/surveyUseCase';
import { authMethod } from 'domain/user/model/authMethod';
import { defineController } from './$relay';

export default defineController(() => ({
  post: {
    validators: { body: surveyValidator.chooseOfficialBody },
    handler: async ({ user, params, body }) => {
      authMethod.assertRole(user, [ROLE_NAMES.admin]);

      return {
        status: 200,
        body: await surveyUseCase.chooseOfficial(
          user,
          brandedId.survey.dto.parse(params.surveyId),
          body.officialSurveyId,
        ),
      };
    },
  },
}));