import type { DefineMethods } from 'aspida';
import type { ExportTicket } from 'common/types/export';

// 家屋単位 PDF 出力（U5 / US-701 / Q-U5-10=B）。第1次調査 ID を指定。admin のみ（Q-U5-6=C）。
// 生成物は S3 に保存し presigned GET URL を ExportTicket で返す（Q-U5-8=B）。
export type Methods = DefineMethods<{
  get: {
    resBody: ExportTicket;
  };
}>;
