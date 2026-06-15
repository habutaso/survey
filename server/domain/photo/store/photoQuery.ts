import type { Prisma } from '@prisma/client';
import type { PhotoDto } from 'common/types/photo';
import { toPhotoDto } from './toPhotoDto';

export const photoQuery = {
  // 当該調査の全写真（作成順）。
  listBySurvey: (tx: Prisma.TransactionClient, surveyId: string): Promise<PhotoDto[]> =>
    tx.photo
      .findMany({ where: { surveyId }, orderBy: { createdAt: 'asc' } })
      .then((rows) => rows.map(toPhotoDto)),

  // 当該調査所属かつ ID 群に一致する写真（所属検証用, BR-P10）。
  findByIds: (
    tx: Prisma.TransactionClient,
    surveyId: string,
    ids: string[],
  ): Promise<PhotoDto[]> =>
    tx.photo.findMany({ where: { surveyId, id: { in: ids } } }).then((rows) => rows.map(toPhotoDto)),
};
