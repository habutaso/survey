import type { DefineMethods } from 'aspida';
import type { SurveyDto } from 'common/types/survey';

// 調査一覧（認証者は全件読取, Q19=A / PII 除外）。本格検索/ページングは U5。
export type Methods = DefineMethods<{
  get: {
    resBody: SurveyDto[];
  };
}>;