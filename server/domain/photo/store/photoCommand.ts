import type { Prisma } from '@prisma/client';
import type { PhotoEntity } from '../model/photoType';

export const photoCommand = {
  // 写真メタの作成（status=pending, BR-P7）。
  create: async (tx: Prisma.TransactionClient, e: PhotoEntity): Promise<void> => {
    await tx.photo.create({
      data: {
        id: e.id,
        surveyId: e.surveyId,
        part: e.part,
        step: e.step,
        fileName: e.fileName,
        contentType: e.contentType,
        s3Key: e.s3Key,
        status: e.status,
        createdBy: e.createdBy,
        createdAt: new Date(e.createdAt),
        // create は常に pending（uploadedAt=null）で作成する（BR-P7 / photoMethod.create 不変条件）。
        // uploaded への遷移は markUploaded のみが行う（INV-P1）。
        uploadedAt: null,
      },
    });
  },

  // pending のみ uploaded へ遷移（冪等, INV-P1 / BR-P8）。空配列は no-op。
  markUploaded: async (
    tx: Prisma.TransactionClient,
    ids: string[],
    uploadedAt: Date,
  ): Promise<void> => {
    if (ids.length === 0) return;

    await tx.photo.updateMany({
      where: { id: { in: ids }, status: 'pending' },
      data: { status: 'uploaded', uploadedAt },
    });
  },
};
