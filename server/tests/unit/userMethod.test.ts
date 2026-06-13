import type { GetUserCommandOutput } from '@aws-sdk/client-cognito-identity-provider';
import type { Role } from 'common/types/role';
import type { UserDto } from 'common/types/user';
import { brandedId } from 'common/validators/brandedId';
import { userMethod } from 'domain/user/model/userMethod';
import { ForbiddenError } from 'service/customAssert';
import type { JwtUser } from 'service/types';
import { describe, expect, test } from 'vitest';

const makeJwtUser = (email: string, signInName: string): JwtUser => ({
  sub: brandedId.user.dto.parse('jwt-sub'),
  'cognito:username': signInName,
  email,
});

const makeCognitoUser = (
  attributes: { Name: string; Value: string }[],
): GetUserCommandOutput => ({ UserAttributes: attributes }) as GetUserCommandOutput;

const makeUser = (roles: Role[], id = 'user-1'): UserDto => ({
  id: brandedId.user.dto.parse(id),
  signInName: 'sign-in-name',
  displayName: 'display-name',
  email: 'user@example.com',
  createdTime: 0,
  photoUrl: undefined,
  roles,
});

describe('userMethod.create', () => {
  test('初期管理者一致 + 属性ありなら admin ロール・属性反映', () => {
    const entity = userMethod.create(
      makeJwtUser('admin@example.com', 'admin-user'),
      makeCognitoUser([
        { Name: 'name', Value: 'Taro' },
        { Name: 'picture', Value: 'https://example.com/p.png' },
      ]),
      ['admin@example.com'],
    );

    expect(entity.roles).toEqual(['admin']);
    expect(entity.displayName).toBe('Taro');
    expect(entity.photoUrl).toBe('https://example.com/p.png');
  });

  test('初期管理者不一致 + 属性なしなら無ロール・signInName フォールバック', () => {
    const entity = userMethod.create(
      makeJwtUser('user@example.com', 'normal-user'),
      makeCognitoUser([]),
      ['admin@example.com'],
    );

    expect(entity.roles).toEqual([]);
    expect(entity.displayName).toBe('normal-user');
    expect(entity.photoUrl).toBeUndefined();
  });
});

describe('userMethod.assignRoles', () => {
  const admin = makeUser(['admin'], 'admin-1');

  test('admin が他ユーザーへ付与（重複排除）', () => {
    const target = makeUser([], 'target-1');
    const entity = userMethod.assignRoles(admin, target, ['surveyor', 'surveyor', 'viewer']);

    expect(entity.id).toBe('target-1');
    expect(entity.roles).toEqual(['surveyor', 'viewer']);
  });

  test('非 admin の操作者は ForbiddenError', () => {
    const actor = makeUser(['surveyor'], 'actor-1');
    const target = makeUser([], 'target-1');

    expect(() => userMethod.assignRoles(actor, target, ['viewer'])).toThrow(ForbiddenError);
  });

  test('自己ロックガード: 自分から admin を外せない', () => {
    expect(() => userMethod.assignRoles(admin, admin, ['surveyor'])).toThrow(ForbiddenError);
  });

  test('自分自身でも admin を維持するなら許可', () => {
    const entity = userMethod.assignRoles(admin, admin, ['admin', 'surveyor']);

    expect(entity.roles).toEqual(['admin', 'surveyor']);
  });
});
