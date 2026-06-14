import type { DefineMethods } from 'aspida';
import type { SurveyDetailDto } from 'common/types/survey';

// 調査詳細取得（PII は surveyor/admin のみ・viewer はマスク, BR-13 / US-605）。
export type Methods = DefineMethods<{
  get: {
    resBody: SurveyDetailDto;
  };
}>;