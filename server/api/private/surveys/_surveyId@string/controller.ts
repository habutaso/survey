import { brandedId } from 'common/validators/brandedId';
import { surveyUseCase } from 'domain/survey/surveyUseCase';
import { defineController } from './$relay';

export default defineController(() => ({
  get: async ({ user, params }) => ({
    status: 200,
    body: await surveyUseCase.get(user, brandedId.survey.dto.parse(params.surveyId)),
  }),
}));