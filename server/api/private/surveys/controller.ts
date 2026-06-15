import { DEFAULT_PAGE_SIZE } from 'common/constants';
import type { SurveyListFilter } from 'common/types/survey';
import { surveyValidator } from 'common/validators/survey';
import { surveyUseCase } from 'domain/survey/surveyUseCase';
import { defineController } from './$relay';

export default defineController(() => ({
  get: {
    validators: { query: surveyValidator.listQuery },
    handler: async ({ user, query }) => {
      const { page, pageSize, confirmedOnly, ...rest } = query;
      // confirmedOnly は 'true' のときのみ status=confirmed 相当として有効化（BR-U5-7）。
      const filter: SurveyListFilter = {
        ...rest,
        confirmedOnly: confirmedOnly === 'true' ? true : undefined,
      };
      // 認可スコープ（Q-U5-5=B）は useCase 内 scopeForList で適用。
      return {
        status: 200,
        body: await surveyUseCase.list(user, filter, {
          page: page ?? 1,
          pageSize: pageSize ?? DEFAULT_PAGE_SIZE,
        }),
      };
    },
  },
}));
