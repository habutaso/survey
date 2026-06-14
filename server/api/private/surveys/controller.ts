import { surveyUseCase } from 'domain/survey/surveyUseCase';
import { defineController } from './$relay';

export default defineController(() => ({
  get: async () => ({ status: 200, body: await surveyUseCase.list() }),
}));