import type { DefineMethods } from 'aspida';
import type { PhotoView } from 'common/types/photo';

// 調査写真の閲覧 URL 一覧（US-304/305）。uploaded のみ presigned GET（24h）を発行（INV-P3）。
export type Methods = DefineMethods<{
  get: {
    resBody: PhotoView[];
  };
}>;
