import type { DefineMethods } from 'aspida';
import type { ExportTicket } from 'common/types/export';
import type { SurveyCsvQuery } from 'common/validators/survey';

// 複数件 CSV エクスポート（U5 / US-702）。フィルタ該当全件。admin のみ（Q-U5-7=A・PII 含む）。
// 生成物は S3 に保存し presigned GET URL を ExportTicket で返す（Q-U5-8=B）。
export type Methods = DefineMethods<{
  get: {
    query: SurveyCsvQuery;
    resBody: ExportTicket;
  };
}>;
