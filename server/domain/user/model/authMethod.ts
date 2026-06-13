import type { DtoId } from 'common/types/brandedId';
import type { Role } from 'common/types/role';
import type { UserDto } from 'common/types/user';
import { ForbiddenError } from 'service/customAssert';

// 認可ヘルパー（L2 / 純粋関数）。DDD ガイドラインに従い副作用を持たない。
// BR-1（既定拒否）, BR-2（any-match）, BR-4（オブジェクト認可）, BR-7（bootstrap）に対応。
export const authMethod = {
  // any-match: user.roles と allowed の積集合が非空なら true。無ロールは常に false（Q4=B）。
  hasAnyRole: (user: UserDto, allowed: Role[]): boolean =>
    user.roles.some((role) => allowed.includes(role)),

  // 単一ロール保有判定（UI 表示分岐等の補助。最終認可は assert* で行う）。
  hasRole: (user: UserDto, role: Role): boolean => user.roles.includes(role),

  // 機能レベル認可（Q6=A, fail closed）。違反時は ForbiddenError を送出。
  assertRole: (user: UserDto, allowed: Role[]): void => {
    if (!authMethod.hasAnyRole(user, allowed)) throw new ForbiddenError('この操作を行う権限がありません');
  },

  // オブジェクトレベル認可（FR-43 / BR-4）。所有者本人 または 特権ロールで許可。
  assertOwnerOrRole: (user: UserDto, ownerId: DtoId['user'], allowed: Role[]): void => {
    if (user.id !== ownerId && !authMethod.hasAnyRole(user, allowed)) {
      throw new ForbiddenError('この操作を行う権限がありません');
    }
  },

  // 初期管理者判定（FU-2 / BR-7）。email または signInName が初期管理者識別子に一致すれば true。
  isInitialAdmin: (
    identity: { email: string; signInName: string },
    initialAdminIdentifiers: string[],
  ): boolean =>
    initialAdminIdentifiers.includes(identity.email) ||
    initialAdminIdentifiers.includes(identity.signInName),
};
