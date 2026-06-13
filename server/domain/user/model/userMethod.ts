import type { GetUserCommandOutput } from '@aws-sdk/client-cognito-identity-provider';
import assert from 'assert';
import { ROLE_NAMES } from 'common/constants';
import type { Role } from 'common/types/role';
import type { UserDto } from 'common/types/user';
import { brandedId } from 'common/validators/brandedId';
import { ForbiddenError } from 'service/customAssert';
import type { JwtUser } from 'service/types';
import { authMethod } from './authMethod';
import type { UserEntity } from './userType';

export const userMethod = {
  create: (
    jwtUser: JwtUser,
    cognitoUser: GetUserCommandOutput,
    initialAdminIdentifiers: string[],
  ): UserEntity => {
    const attributes = cognitoUser.UserAttributes;

    assert(attributes);

    const signInName = jwtUser['cognito:username'];
    // 新規作成時のみ bootstrap 判定（BR-7）。一致すれば admin、それ以外は無権限（Q4=B）。
    const roles: Role[] = authMethod.isInitialAdmin(
      { email: jwtUser.email, signInName },
      initialAdminIdentifiers,
    )
      ? [ROLE_NAMES.admin]
      : [];

    return {
      id: brandedId.user.entity.parse(jwtUser.sub),
      email: jwtUser.email,
      signInName,
      displayName: attributes.find((attr) => attr.Name === 'name')?.Value ?? signInName,
      photoUrl: attributes.find((attr) => attr.Name === 'picture')?.Value,
      createdTime: Date.now(),
      roles,
    };
  },
  updateEmail: (user: UserDto, email: string): UserEntity => ({
    ...user,
    id: brandedId.user.entity.parse(user.id),
    email,
  }),
  // ロール割当（FU-3 / BR-6, model 純粋）。最後の admin 保護は UseCase 側（DB 件数依存）で行う。
  assignRoles: (actor: UserDto, target: UserDto, nextRoles: Role[]): UserEntity => {
    authMethod.assertRole(actor, [ROLE_NAMES.admin]);

    // 自己ロックガード（BR-6, fail-safe）: 自分自身から admin を外せない。
    if (actor.id === target.id && !nextRoles.includes(ROLE_NAMES.admin)) {
      throw new ForbiddenError('自分自身から管理者権限を外すことはできません');
    }

    return {
      ...target,
      id: brandedId.user.entity.parse(target.id),
      roles: [...new Set(nextRoles)],
    };
  },
};
