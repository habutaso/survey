import type { DefineMethods } from 'aspida';
import type { SubmissionPayload, SurveyDetailDto } from 'common/types/survey';

// 提出時一括同期（US-207 / FR-18・19）。冪等・原子的。
export type Methods = DefineMethods<{
  post: {
    reqBody: SubmissionPayload;
    resBody: SurveyDetailDto;
  };
}>;