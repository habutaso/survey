import type { DefineMethods } from 'aspida';
import type { DtoId } from 'common/types/brandedId';
import type { SurveyDetailDto } from 'common/types/survey';

// 正式判定（admin, US-606）。第1次に official* を設定。
export type Methods = DefineMethods<{
  post: {
    reqBody: { officialSurveyId: DtoId['survey'] };
    resBody: SurveyDetailDto;
  };
}>;