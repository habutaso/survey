import type { Prisma } from '@prisma/client';
import type { AuditLogDto } from 'common/types/audit';
import type { AuditEvent } from './model/auditMethod';
import { auditMethod } from './model/auditMethod';
import { auditCommand } from './store/auditCommand';

export const auditUseCase = {
  // 監査記録（US-803 / NFR-08）。client は呼出元 tx に参加させる。
  // 失敗記録など tx 文脈の無い場合は prismaClient を渡す（独立 INSERT）。
  record: (client: Prisma.TransactionClient, event: AuditEvent): Promise<AuditLogDto> =>
    auditCommand.save(client, auditMethod.create(event)),
};
