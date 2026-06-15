import type { DtoId, EntityId } from 'common/types/brandedId';
import type { PhotoDto, PhotoMeta } from 'common/types/photo';
import { NotFoundError } from 'service/customAssert';
import type { PhotoEntity } from './photoType';

// 写真ドメインモデル（純粋・L2, BR-P5〜P10）。副作用なし（ID 採番・時刻・署名は port/useCase が注入）。
export const photoMethod = {
  // S3 キー（決定論的, Q-U4-5=A / BR-P5 / INV-P2）。
  buildKey: (surveyId: string, photoId: string): string => `surveys/${surveyId}/${photoId}`,

  // メタから pending 写真エンティティを生成（BR-P7）。
  create: (
    id: EntityId['photo'],
    surveyId: DtoId['survey'],
    meta: PhotoMeta,
    createdBy: DtoId['user'],
    now: number,
  ): PhotoEntity => ({
    id,
    surveyId,
    part: meta.part,
    step: meta.step,
    fileName: meta.fileName,
    contentType: meta.contentType,
    s3Key: photoMethod.buildKey(surveyId, id),
    status: 'pending',
    createdBy,
    createdAt: now,
    uploadedAt: null,
  }),

  // 冪等遷移（INV-P1 / BR-P8）。uploaded は no-op、pending のみ uploadedAt を付与。
  markUploaded: (photo: PhotoDto, now: number): PhotoDto =>
    photo.status === 'uploaded' ? photo : { ...photo, status: 'uploaded', uploadedAt: now },

  // 閲覧可能（uploaded）のみ抽出（INV-P3 / BR-P9 / fail closed）。
  selectViewable: (photos: PhotoDto[]): PhotoDto[] =>
    photos.filter((photo) => photo.status === 'uploaded'),

  // 所属・存在検証（BR-P10）。要求 ID がすべて取得集合（当該 survey 所属）に含まれること。
  assertAllFound: (found: PhotoDto[], requestedIds: DtoId['photo'][]): void => {
    const foundIds = new Set(found.map((photo) => photo.id));

    if (requestedIds.some((id) => !foundIds.has(id))) {
      throw new NotFoundError('指定された写真が見つかりません');
    }
  },
};
