import { ROLE_NAMES } from 'common/constants';
import { brandedId } from 'common/validators/brandedId';
import { userValidator } from 'common/validators/user';
import { authMethod } from 'domain/user/model/authMethod';
import { userUseCase } from 'domain/user/userUseCase';
import { defineController } from './$relay';

export default defineController(() => ({
  patch: {
    validators: { body: userValidator.assignRolesBody },
    handler: async ({ user, params, body }) => {
      // L1 多層防御（FU-3.1）: API 層でも admin 認可を強制（model でも再度確認）。
      authMethod.assertRole(user, [ROLE_NAMES.admin]);

      return {
        status: 200,
        body: await userUseCase.assignRoles(user, {
          userId: brandedId.user.dto.parse(params.userId),
          roles: body.roles,
        }),
      };
    },
  },
}));
