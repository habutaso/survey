import type { DtoId } from 'common/types/brandedId';
import type { PhotoMeta } from 'common/types/photo';
import type { LocalPhoto, LocalPhotoId, LocalPhotoStatus } from '../types';

// 画像 contentType 検証（U4 BR-P15 と整合・送信前検証, BR-U6f-12）。
export const isImageType = (contentType: string): boolean => contentType.startsWith('image/');

export const createLocalPhoto = (params: {
  id: LocalPhotoId;
  draftId: string;
  fileName: string;
  contentType: string;
  blob: Blob;
  part: string | null;
  step: string | null;
  now: number;
}): LocalPhoto => ({
  id: params.id,
  draftId: params.draftId,
  fileName: params.fileName,
  contentType: params.contentType,
  part: params.part,
  step: params.step,
  blob: params.blob,
  status: 'local',
  serverPhotoId: null,
  createdAt: params.now,
});

export const toPhotoMeta = (photo: LocalPhoto): PhotoMeta => ({
  fileName: photo.fileName,
  contentType: photo.contentType,
  part: photo.part,
  step: photo.step,
});

export const withStatus = (photo: LocalPhoto, status: LocalPhotoStatus): LocalPhoto => ({
  ...photo,
  status,
});

// presigned PUT 成功時: サーバ photoId を割り当て uploaded へ（BR-U6f-12）。
export const markUploaded = (photo: LocalPhoto, serverPhotoId: DtoId['photo']): LocalPhoto => ({
  ...photo,
  status: 'uploaded',
  serverPhotoId,
});
