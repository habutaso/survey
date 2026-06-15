import type { PHOTO_STATUS_LIST } from 'common/constants';
import type { DtoId } from './brandedId';

// 写真アップロード状態（U4 / Q-U4-4=B）。値の真実の源は common/constants の PHOTO_STATUS_LIST。
export type PhotoStatus = (typeof PHOTO_STATUS_LIST)[number];

// 画像メタ（提出ペイロード/登録要求のクライアント由来メタ, Q-U4-3=C）。
// 実体（バイナリ）は S3 に保持し、サーバはメタ＋S3キー＋状態のみ管理する（photoPort=U4）。
export type PhotoMeta = {
  fileName: string;
  contentType: string;
  part: string | null;
  step: string | null;
};

// 写真の永続化基底（DTO・エンティティで共有）。
export type PhotoBase = {
  surveyId: DtoId['survey'];
  part: string | null;
  step: string | null;
  fileName: string;
  contentType: string;
  s3Key: string;
  status: PhotoStatus;
  createdBy: DtoId['user'];
  createdAt: number;
  uploadedAt: number | null;
};

// 写真 DTO。
export type PhotoDto = PhotoBase & { id: DtoId['photo'] };

// 提出応答に同梱する presigned PUT URL チケット（クライアントの直アップロード先, 15分）。
export type PhotoUploadTicket = { photoId: DtoId['photo']; putUrl: string };

// 閲覧用（presigned GET URL, 24h）。uploaded のみ発行（INV-P3）。
export type PhotoView = {
  photoId: DtoId['photo'];
  getUrl: string;
  fileName: string;
  part: string | null;
  step: string | null;
};
