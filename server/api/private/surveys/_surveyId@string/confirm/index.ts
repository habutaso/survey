import type { DefineMethods } from 'aspida';
import type { SurveyDetailDto } from 'common/types/survey';

// 確定（admin / approved→confirmed, US-504）。既 confirmed は no-op 成功（冪等）。
export type Methods = DefineMethods<{
  post: {
    resBody: SurveyDetailDto;
  };
}>;