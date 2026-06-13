import type { Prisma } from '@prisma/client';
import { ROLE_NAMES } from 'common/constants';
import { INITIAL_ADMIN_IDENTIFIERS } from 'service/envValues';
import { prismaClient, transaction } from 'service/prismaClient';

// 初期管理者ブートストラップ（補助経路, BR-7）。identifier 一致ユーザーへ admin を冪等付与。
const assignInitialAdmins = async (tx: Prisma.TransactionClient): Promise<void> => {
  if (INITIAL_ADMIN_IDENTIFIERS.length === 0) return;

  const users = await tx.user.findMany({
    where: {
      OR: [
        { email: { in: INITIAL_ADMIN_IDENTIFIERS } },
        { signInName: { in: INITIAL_ADMIN_IDENTIFIERS } },
      ],
    },
  });

  await Promise.all(
    users
      .filter((user) => !user.roles.includes(ROLE_NAMES.admin))
      .map((user) =>
        tx.user.update({
          where: { id: user.id },
          data: { roles: { set: [...new Set([...user.roles, ROLE_NAMES.admin])] } },
        }),
      ),
  );
};

transaction('RepeatableRead', (tx) => assignInitialAdmins(tx))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prismaClient.$disconnect();
  });
