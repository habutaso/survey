import { ROLE_NAMES } from 'common/constants';
import type { DtoId } from 'common/types/brandedId';
import type { PhotoDto, PhotoView } from 'common/types/photo';
import type { UserDto } from 'common/types/user';
import { auditUseCase } from 'domain/audit/auditUseCase';
import { photoMethod } from 'domain/photo/model/photoMethod';
import { photoCommand } from 'domain/photo/store/photoCommand';
import { photoQuery } from 'domain/photo/store/photoQuery';
import { authMethod } from 'domain/user/model/authMethod';
import { prismaClient, transaction } from 'service/prismaClient';
import { s3 } from 'service/s3Client';
import { depend } from 'velona';

// 写真ユースケース（U4）。確認（pending→uploaded）と閲覧 URL 取得。
export const photoUseCase = {
  // アップロード確認（BR-P8）。submitter 認可＋所属検証＋冪等遷移＋監査。
  confirmUploaded: depend(
    { now: (): number => Date.now() },
    (
      { now },
      actor: UserDto,
      surveyId: DtoId['survey'],
      photoIds: DtoId['photo'][],
    ): Promise<PhotoDto[]> =>
      transaction('RepeatableRead', async (tx) => {
        // L2 認可（多層防御 / BR-P2 fail closed）。
        authMethod.assertRole(actor, [ROLE_NAMES.surveyor, ROLE_NAMES.admin]);

        const found = await photoQuery.findByIds(tx, surveyId, photoIds);

        photoMethod.assertAllFound(found, photoIds); // 所属外・不在は 404（BR-P10）

        const at = now();
        const pendingIds = found
          .filter((photo) => photo.status === 'pending')
          .map((photo) => photo.id);

        await photoCommand.markUploaded(tx, pendingIds, new Date(at));

        await auditUseCase.record(tx, {
          actorUserId: actor.id,
          action: 'photo.uploadConfirmed',
          targetType: 'survey',
          targetId: surveyId,
          summary: `写真アップロード確認 ${found.length} 件`,
        });

        return found.map((photo) => photoMethod.markUploaded(photo, at));
      }),
  ),

  // 閲覧 URL 取得（BR-P2/P9）。閲覧権限のあるロールのみ。uploaded のみ presigned GET（24h）を発行。
  listForSurvey: depend(
    { signGet: s3.getSignedUrl },
    ({ signGet }, actor: UserDto, surveyId: DtoId['survey']): Promise<PhotoView[]> => {
      authMethod.assertRole(actor, [ROLE_NAMES.surveyor, ROLE_NAMES.admin, ROLE_NAMES.viewer]);

      return photoQuery.listBySurvey(prismaClient, surveyId).then((photos) =>
        Promise.all(
          photoMethod.selectViewable(photos).map(async (photo) => ({
            photoId: photo.id,
            getUrl: await signGet(photo.s3Key),
            fileName: photo.fileName,
            part: photo.part,
            step: photo.step,
          })),
        ),
      );
    },
  ),
};
