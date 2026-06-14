import type { Role } from 'common/types/role';
import { prismaClient } from 'service/prismaClient';
import { expect, test } from 'vitest';
import { createCognitoUser, createUserClient, noCookieClient } from '../apiClient';

const createUser = async (): Promise<{
  client: ReturnType<typeof createUserClient>;
  id: string;
}> => {
  const tokens = await createCognitoUser();
  const client = createUserClient(tokens);
  const me = await client.private.me.get();

  return { client, id: me.body.id };
};

const setRoles = (id: string, roles: Role[]): Promise<unknown> =>
  prismaClient.user.update({ where: { id }, data: { roles } });

test('ロール変更で user.roles.change が success 記録される（NFR-08）', async () => {
  const admin = await createUser();
  const target = await createUser();

  await setRoles(admin.id, ['admin']);
  await admin.client.private.users._userId(target.id).roles.patch({ body: { roles: ['surveyor'] } });

  const logs = await prismaClient.auditLog.findMany({ where: { action: 'user.roles.change' } });

  expect(logs.length).toBe(1);
  expect(logs[0]!.outcome).toBe('success');
  expect(logs[0]!.actorUserId).toBe(admin.id);
  expect(logs[0]!.targetId).toBe(target.id);
  // roles は非 PII のため実値、空→surveyor の差分を記録。
  expect(logs[0]!.changes).toEqual([{ field: 'roles', before: '', after: 'surveyor' }]);
});

test('認可失敗で authz.failure が failure 記録される（SECURITY-13）', async () => {
  const surveyor = await createUser();
  const target = await createUser();

  await setRoles(surveyor.id, ['surveyor']);
  await surveyor.client.private.users
    ._userId(target.id)
    .roles.patch({ body: { roles: ['viewer'] } })
    .catch(() => undefined);

  const logs = await prismaClient.auditLog.findMany({ where: { action: 'authz.failure' } });

  expect(logs.length).toBe(1);
  expect(logs[0]!.outcome).toBe('failure');
});

test('認証失敗で auth.failure が failure 記録される（actor 不明）', async () => {
  await noCookieClient.private.get().catch(() => undefined);

  const logs = await prismaClient.auditLog.findMany({ where: { action: 'auth.failure' } });

  expect(logs.length).toBe(1);
  expect(logs[0]!.outcome).toBe('failure');
  expect(logs[0]!.actorUserId).toBeNull();
  expect(logs[0]!.changes).toBeNull();
});
