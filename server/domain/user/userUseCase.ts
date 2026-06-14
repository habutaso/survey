import assert from 'assert';
import { ROLE_NAMES } from 'common/constants';
import type { DtoId } from 'common/types/brandedId';
import type { Role } from 'common/types/role';
import type { UserDto } from 'common/types/user';
import { cognito } from 'service/cognito';
import { ForbiddenError, NotFoundError } from 'service/customAssert';
import { prismaClient, transaction } from 'service/prismaClient';
import { INITIAL_ADMIN_IDENTIFIERS } from 'service/envValues';
import type { JwtUser } from 'service/types';
import { auditUseCase } from 'domain/audit/auditUseCase';
import { authMethod } from './model/authMethod';
import { userMethod } from './model/userMethod';
import { userCommand } from './store/userCommand';
import { userQuery } from './store/userQuery';

export const userUseCase = {
  findOrCreateUser: (jwtUser: JwtUser, accessToken: string): Promise<UserDto> =>
    transaction('RepeatableRead', async (tx) => {
      const user = await userQuery.findById(prismaClient, jwtUser.sub).catch(() => null);

      // 既存ユーザーの roles は不変（bootstrap 判定は新規作成時のみ, BR-7）。
      if (user !== null) return user;

      const cognitoUser = await cognito.getUser(accessToken);
      const newUser = userMethod.create(jwtUser, cognitoUser, INITIAL_ADMIN_IDENTIFIERS);

      return await userCommand.save(tx, newUser);
    }),
  confirmEmail: (user: UserDto, accessToken: string, code: string): Promise<UserDto> =>
    transaction('RepeatableRead', async (tx) => {
      await cognito.verifyEmail({ accessToken, code });

      const cognitoUser = await cognito.getUser(accessToken);
      const emailAttr = cognitoUser.UserAttributes?.find((attr) => attr.Name === 'email');

      assert(emailAttr?.Value);

      const confirmedUser = userMethod.updateEmail(user, emailAttr.Value);

      return await userCommand.save(tx, confirmedUser);
    }),
  // ロール割当（FU-3）。admin 限定 + 自己ロック（model）+ 最後の admin 保護（ここで DB 件数依存）。
  assignRoles: (actor: UserDto, payload: { userId: DtoId['user']; roles: Role[] }): Promise<UserDto> =>
    transaction('RepeatableRead', async (tx) => {
      const target = await userQuery
        .findById(tx, payload.userId)
        .catch(() => Promise.reject(new NotFoundError('対象ユーザーが見つかりません')));

      // 最後の admin 保護（BR-6）: admin を 0 人にする変更は拒否。
      if (
        authMethod.hasRole(target, ROLE_NAMES.admin) &&
        !payload.roles.includes(ROLE_NAMES.admin) &&
        (await userQuery.countByRole(tx, ROLE_NAMES.admin)) === 1
      ) {
        throw new ForbiddenError('最後の管理者から管理者権限を外すことはできません');
      }

      const entity = userMethod.assignRoles(actor, target, payload.roles);
      const saved = await userCommand.save(tx, entity);

      // ロール変更を監査記録（同一 tx で原子的, NFR-08/SECURITY-13）。roles は非 PII のためマスク不要。
      await auditUseCase.record(tx, {
        actorUserId: actor.id,
        action: 'user.roles.change',
        targetType: 'user',
        targetId: payload.userId,
        outcome: 'success',
        summary: 'ロール変更',
        changes: [{ field: 'roles', before: target.roles.join(','), after: saved.roles.join(',') }],
      });

      return saved;
    }),
};
