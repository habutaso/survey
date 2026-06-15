import type { DefineMethods } from 'aspida';
import type { SurveyListResult } from 'common/types/survey';
import type { SurveyListQuery } from 'common/validators/survey';

// 調査一覧・検索（U5 / US-703）。フィルタ＋オフセットページング。ロールスコープ（Q-U5-5=B）。
// 応答は SurveyListResult（items は PII 除外＋総件数）。
export type Methods = DefineMethods<{
  get: {
    query: SurveyListQuery;
    resBody: SurveyListResult;
  };
}>;
