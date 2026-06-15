import { ROLE_NAMES } from 'common/constants';
import type { SurveyListFilter } from 'common/types/survey';
import { surveyValidator } from 'common/validators/survey';
import { exportUseCase } from 'domain/export/exportUseCase';
import { authMethod } from 'domain/user/model/authMethod';
import { defineController } from './$relay';

export default defineController(() => ({
  get: {
    validators: { query: surveyValidator.csvQuery },
    // L1 多層防御（BR-U5-3）: admin のみ。UseCase でも assertExporter で再確認。
    handler: async ({ user, query }) => {
      authMethod.assertRole(user, [ROLE_NAMES.admin]);

      const { confirmedOnly, ...rest } = query;
      const filter: SurveyListFilter = {
        ...rest,
        confirmedOnly: confirmedOnly === 'true' ? true : undefined,
      };

      return { status: 200, body: await exportUseCase.buildSurveyCsv(user, filter) };
    },
  },
}));
