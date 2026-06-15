import { brandedId } from 'common/validators/brandedId';
import { photoUseCase } from 'domain/photo/photoUseCase';
import { defineController } from './$relay';

export default defineController(() => ({
  // 閲覧権限の確認は photoUseCase.listForSurvey（L2）で実施（uploaded のみ URL 発行）。
  get: async ({ user, params }) => ({
    status: 200,
    body: await photoUseCase.listForSurvey(user, brandedId.survey.dto.parse(params.surveyId)),
  }),
}));
