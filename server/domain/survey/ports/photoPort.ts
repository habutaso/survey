import type { Prisma } from '@prisma/client';
import type { DtoId, EntityId } from 'common/types/brandedId';
import type { PhotoMeta, PhotoUploadTicket } from 'common/types/photo';
import type { UserDto } from 'common/types/user';
import { brandedId } from 'common/validators/brandedId';
import { photoMethod } from 'domain/photo/model/photoMethod';
import { photoCommand } from 'domain/photo/store/photoCommand';
import { s3 } from 'service/s3Client';
import { ulid } from 'ulid';
import { depend } from 'velona';

// 画像永続化ポート（DI 境界 / Q4=A, NFR-09）。U4 で presigned PUT URL 方式の本実装。
// 提出時に Photo(status=pending) を作成し S3 キーを採番、presigned PUT URL（15分）を発行して
// 提出応答に同梱する。バイナリ本体はクライアントが S3 へ直接アップロードする（BR-P1/P7）。
export const photoPort = {
  persist: depend(
    {
      genId: (): EntityId['photo'] => brandedId.photo.entity.parse(ulid()),
      now: (): number => Date.now(),
      signPut: s3.putSignedUrl,
    },
    async (
      { genId, now, signPut },
      tx: Prisma.TransactionClient,
      surveyId: DtoId['survey'],
      metas: PhotoMeta[],
      actor: UserDto,
    ): Promise<PhotoUploadTicket[]> => {
      const tickets: PhotoUploadTicket[] = [];

      for (const meta of metas) {
        const entity = photoMethod.create(genId(), surveyId, meta, actor.id, now());

        await photoCommand.create(tx, entity);

        const putUrl = await signPut(entity.s3Key, entity.contentType);

        tickets.push({ photoId: brandedId.photo.dto.parse(entity.id), putUrl });
      }

      return tickets;
    },
  ),
};
