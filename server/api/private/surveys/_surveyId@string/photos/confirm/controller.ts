import { ROLE_NAMES } from 'common/constants';
import { brandedId } from 'common/validators/brandedId';
import { photoValidator } from 'common/validators/photo';
import { photoUseCase } from 'domain/photo/photoUseCase';
import { authMethod } from 'domain/user/model/authMethod';
import { defineController } from './$relay';

export default defineController(() => ({
  post: {
    validators: { body: photoValidator.confirmBody },
    handler: async ({ user, params, body }) => {
      // L1 多層防御（BR-P2）: API 層でも提出者ロールを強制（UseCase でも再確認）。
      authMethod.assertRole(user, [ROLE_NAMES.surveyor, ROLE_NAMES.admin]);

      return {
        status: 200,
        body: await photoUseCase.confirmUploaded(
          user,
          brandedId.survey.dto.parse(params.surveyId),
          body.photoIds,
        ),
      };
    },
  },
}));
