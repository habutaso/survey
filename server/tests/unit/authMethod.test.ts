import { ROLE_LIST } from 'common/constants';
import type { Role } from 'common/types/role';
import type { UserDto } from 'common/types/user';
import { brandedId } from 'common/validators/brandedId';
import { authMethod } from 'domain/user/model/authMethod';
import fc from 'fast-check';
import { ForbiddenError } from 'service/customAssert';
import { describe, expect, test } from 'vitest';

const makeUser = (roles: Role[], id = 'user-1'): UserDto => ({
  id: brandedId.user.dto.parse(id),
  signInName: 'sign-in-name',
  displayName: 'display-name',
  email: 'user@example.com',
  createdTime: 0,
  photoUrl: undefined,
  roles,
});

const roleArb = fc.constantFrom<Role>(...ROLE_LIST);
const rolesArb = fc.uniqueArray(roleArb);

describe('authMethod.hasAnyRole', () => {
  test('any-match: 積集合が非空なら true', () => {
    expect(authMethod.hasAnyRole(makeUser(['admin']), ['admin'])).toBe(true);
    expect(authMethod.hasAnyRole(makeUser(['admin', 'surveyor']), ['surveyor'])).toBe(true);
  });

  test('積集合が空なら false', () => {
    expect(authMethod.hasAnyRole(makeUser(['surveyor']), ['admin'])).toBe(false);
  });

  test('無ロールは常に false（既定拒否）', () => {
    expect(authMethod.hasAnyRole(makeUser([]), ['admin', 'surveyor', 'viewer'])).toBe(false);
  });
});

describe('authMethod.hasRole', () => {
  test('保有ロールは true、非保有は false', () => {
    const user = makeUser(['admin']);

    expect(authMethod.hasRole(user, 'admin')).toBe(true);
    expect(authMethod.hasRole(user, 'surveyor')).toBe(false);
  });
});

describe('authMethod.assertRole', () => {
  test('許可ロール保有なら例外を投げない', () => {
    expect(() => authMethod.assertRole(makeUser(['admin']), ['admin'])).not.toThrow();
  });

  test('未保有なら ForbiddenError', () => {
    expect(() => authMethod.assertRole(makeUser(['surveyor']), ['admin'])).toThrow(ForbiddenError);
  });
});

describe('authMethod.assertOwnerOrRole', () => {
  const ownerId = brandedId.user.dto.parse('owner-1');

  test('所有者本人なら allowed に依らず許可', () => {
    const owner = makeUser([], 'owner-1');

    expect(() => authMethod.assertOwnerOrRole(owner, ownerId, [])).not.toThrow();
  });

  test('非所有者でも特権ロール保有なら許可', () => {
    const admin = makeUser(['admin'], 'other');

    expect(() => authMethod.assertOwnerOrRole(admin, ownerId, ['admin'])).not.toThrow();
  });

  test('非所有者かつ未保有なら ForbiddenError', () => {
    const viewer = makeUser(['viewer'], 'other');

    expect(() => authMethod.assertOwnerOrRole(viewer, ownerId, ['admin'])).toThrow(ForbiddenError);
  });
});

describe('authMethod.isInitialAdmin', () => {
  test('email 一致で true', () => {
    expect(
      authMethod.isInitialAdmin({ email: 'a@example.com', signInName: 'x' }, ['a@example.com']),
    ).toBe(true);
  });

  test('signInName 一致で true（email 不一致）', () => {
    expect(authMethod.isInitialAdmin({ email: 'a@example.com', signInName: 'x' }, ['x'])).toBe(true);
  });

  test('いずれも不一致なら false', () => {
    expect(authMethod.isInitialAdmin({ email: 'a@example.com', signInName: 'x' }, ['y'])).toBe(
      false,
    );
  });
});

describe('authMethod PBT 不変条件（BR-8）', () => {
  test('INV-1: 無ロールは任意の allowed に対し拒否', () => {
    fc.assert(
      fc.property(rolesArb, (allowed) => {
        const user = makeUser([]);

        expect(authMethod.hasAnyRole(user, allowed)).toBe(false);
        expect(() => authMethod.assertRole(user, allowed)).toThrow(ForbiddenError);
      }),
    );
  });

  test('INV-2: hasAnyRole は積集合非空と一致', () => {
    fc.assert(
      fc.property(rolesArb, rolesArb, (roles, allowed) => {
        const expected = roles.some((role) => allowed.includes(role));

        expect(authMethod.hasAnyRole(makeUser(roles), allowed)).toBe(expected);
      }),
    );
  });

  test('INV-3: ロール追加で許可→拒否に転じない（単調性）', () => {
    fc.assert(
      fc.property(rolesArb, roleArb, rolesArb, (roles, extra, allowed) => {
        if (authMethod.hasAnyRole(makeUser(roles), allowed)) {
          expect(authMethod.hasAnyRole(makeUser([...roles, extra]), allowed)).toBe(true);
        }
      }),
    );
  });

  test('INV-4: 所有者は allowed に依らず許可', () => {
    fc.assert(
      fc.property(rolesArb, rolesArb, (roles, allowed) => {
        const user = makeUser(roles, 'owner');
        const ownerId = brandedId.user.dto.parse('owner');

        expect(() => authMethod.assertOwnerOrRole(user, ownerId, allowed)).not.toThrow();
      }),
    );
  });
});
