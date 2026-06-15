import type { DefineMethods } from 'aspida';
import type { DtoId } from 'common/types/brandedId';
import type { PhotoDto } from 'common/types/photo';

// アップロード確認（US-304/305 / BR-P8）。pending→uploaded。冪等。
export type Methods = DefineMethods<{
  post: {
    reqBody: { photoIds: DtoId['photo'][] };
    resBody: PhotoDto[];
  };
}>;
