import type { DefineMethods } from 'aspida';
import type { SurveyDetailDto } from 'common/types/survey';

// 承認（admin / submitted→approved, US-503）。
export type Methods = DefineMethods<{
  post: {
    resBody: SurveyDetailDto;
  };
}>;