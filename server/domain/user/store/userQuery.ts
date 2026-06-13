import type { Prisma } from '@prisma/client';
import type { Role } from 'common/types/role';
import type { UserDto } from 'common/types/user';
import { toUserDto } from './toUserDto';

export const userQuery = {
  findById: (tx: Prisma.TransactionClient, id: string): Promise<UserDto> =>
    tx.user.findUniqueOrThrow({ where: { id } }).then(toUserDto),
  // 最後の admin 保護（BR-6）用。指定ロールを保有するユーザー数を返す。
  countByRole: (tx: Prisma.TransactionClient, role: Role): Promise<number> =>
    tx.user.count({ where: { roles: { has: role } } }),
};
