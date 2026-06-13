import type { Role } from 'common/types/role';
import { prismaClient } from 'service/prismaClient';
import { expect, test } from 'vitest';
import { createCognitoUser, createUserClient, noCookieClient } from '../apiClient';
import { PATCH } from '../utils';

type UserClient = ReturnType<typeof createUserClient>;

// 認証済みユーザーを作成し /private/me を叩いて DB に登録（roles は既定 []）。
const createUser = async (): Promise<{ client: UserClient; id: string }> => {
  const tokens = await createCognitoUser();
  const client = createUserClient(tokens);
  const me = await client.private.me.get();

  return { client, id: me.body.id };
};

// テスト準備用に DB のロールを直接更新（INITIAL_ADMIN_IDENTIFIERS は test 環境で空のため）。
const setRoles = (id: string, roles: Role[]): Promise<unknown> =>
  prismaClient.user.update({ where: { id }, data: { roles } });

// createUserClient はエラーを Error(JSON.stringify(toJSON())) に変換するため status を取り出す。
const expectRejectedStatus = async (promise: Promise<unknown>, status: number): Promise<void> => {
  await promise.then(
    () => Promise.reject(new Error('リクエストは失敗するはずでした')),
    (e: Error) => {
      expect(JSON.parse(e.message).status).toBe(status);
    },
  );
};

const rolesApi = noCookieClient.private.users._userId('userId').roles;

test(`${PATCH(rolesApi)} admin が他ユーザーへロール付与`, async () => {
  const admin = await createUser();
  const target = await createUser();

  await setRoles(admin.id, ['admin']);

  const res = await admin.client.private.users._userId(target.id).roles.patch({
    body: { roles: ['surveyor', 'viewer'] },
  });

  expect(res.status).toBe(200);
  expect(res.body.roles).toEqual(['surveyor', 'viewer']);

  // GET /private/me に roles が含まれること。
  const adminMe = await admin.client.private.me.get();

  expect(adminMe.body.roles).toEqual(['admin']);
});

test(`${PATCH(rolesApi)} 非 admin は 403`, async () => {
  const surveyor = await createUser();
  const noRole = await createUser();
  const target = await createUser();

  await setRoles(surveyor.id, ['surveyor']);

  await expectRejectedStatus(
    surveyor.client.private.users._userId(target.id).roles.patch({ body: { roles: ['viewer'] } }),
    403,
  );
  await expectRejectedStatus(
    noRole.client.private.users._userId(target.id).roles.patch({ body: { roles: ['viewer'] } }),
    403,
  );
});

test(`${PATCH(rolesApi)} 自己ロックガード（admin 2名・自分の admin 除去）は 403`, async () => {
  const admin1 = await createUser();
  const admin2 = await createUser();

  await setRoles(admin1.id, ['admin']);
  await setRoles(admin2.id, ['admin']);

  await expectRejectedStatus(
    admin1.client.private.users._userId(admin1.id).roles.patch({ body: { roles: ['surveyor'] } }),
    403,
  );
});

test(`${PATCH(rolesApi)} 最後の admin 保護は 403`, async () => {
  const admin = await createUser();

  await setRoles(admin.id, ['admin']);

  await expectRejectedStatus(
    admin.client.private.users._userId(admin.id).roles.patch({ body: { roles: ['viewer'] } }),
    403,
  );
});

test(`${PATCH(rolesApi)} 対象ユーザー不在（U1 は 403, U-Cross で 404 に精緻化）`, async () => {
  const admin = await createUser();

  await setRoles(admin.id, ['admin']);

  await expectRejectedStatus(
    admin.client.private.users
      ._userId('non-existent-user-id')
      .roles.patch({ body: { roles: ['viewer'] } }),
    403,
  );
});

test(`${PATCH(rolesApi)} 不正なロール値はバリデーションで拒否（403）`, async () => {
  const admin = await createUser();
  const target = await createUser();

  await setRoles(admin.id, ['admin']);

  await expectRejectedStatus(
    admin.client.private.users._userId(target.id).roles.patch({
      body: { roles: ['superadmin'] as unknown as Role[] },
    }),
    403,
  );
});

test(`${PATCH(rolesApi)} admin ロール遷移（維持・他admin除去）`, async () => {
  const admin1 = await createUser();
  const admin2 = await createUser();

  await setRoles(admin1.id, ['admin']);
  await setRoles(admin2.id, ['admin']);

  // 対象が admin かつ付与後も admin を維持（最後の admin 条件の !includes(admin)=false 分岐）。
  const res1 = await admin1.client.private.users._userId(admin2.id).roles.patch({
    body: { roles: ['admin', 'viewer'] },
  });

  expect(res1.status).toBe(200);
  expect(res1.body.roles).toEqual(['admin', 'viewer']);

  // admin が 2 名のため admin2 から admin を外せる（countByRole !== 1 分岐の成功）。
  const res2 = await admin1.client.private.users._userId(admin2.id).roles.patch({
    body: { roles: ['viewer'] },
  });

  expect(res2.status).toBe(200);
  expect(res2.body.roles).toEqual(['viewer']);

  // 自分自身でも admin を維持するなら許可（自己ロックガードの分岐: admin を含む）。
  const res3 = await admin1.client.private.users._userId(admin1.id).roles.patch({
    body: { roles: ['admin', 'surveyor'] },
  });

  expect(res3.status).toBe(200);
  expect(res3.body.roles).toEqual(['admin', 'surveyor']);
});
