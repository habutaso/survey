import type { Photo } from '@prisma/client';
import type { PhotoDto, PhotoStatus } from 'common/types/photo';
import { brandedId } from 'common/validators/brandedId';

// Prisma 行 → PhotoDto。DateTime→epoch ms、status は zod 駆動の union へナローイング。
export const toPhotoDto = (row: Photo): PhotoDto => ({
  id: brandedId.photo.dto.parse(row.id),
  surveyId: brandedId.survey.dto.parse(row.surveyId),
  part: row.part,
  step: row.step,
  fileName: row.fileName,
  contentType: row.contentType,
  s3Key: row.s3Key,
  status: row.status as PhotoStatus,
  createdBy: brandedId.user.dto.parse(row.createdBy),
  createdAt: row.createdAt.getTime(),
  uploadedAt: row.uploadedAt === null ? null : row.uploadedAt.getTime(),
});
