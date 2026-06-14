import { Prisma } from '@prisma/client';
import type { AuditLogDto } from 'common/types/audit';
import type { AuditLogEntity } from '../model/auditType';
import { toAuditLogDto } from './toAuditLogDto';

export const auditCommand = {
  // 追記専用（INSERT のみ, BR-1）。UPDATE/DELETE は提供しない。
  save: (tx: Prisma.TransactionClient, entity: AuditLogEntity): Promise<AuditLogDto> =>
    tx.auditLog
      .create({
        data: {
          id: entity.id,
          occurredAt: new Date(entity.occurredAt),
          actorUserId: entity.actorUserId,
          action: entity.action,
          targetType: entity.targetType,
          targetId: entity.targetId,
          outcome: entity.outcome,
          summary: entity.summary,
          changes:
            entity.changes === null ? Prisma.JsonNull : (entity.changes as Prisma.InputJsonValue),
        },
      })
      .then(toAuditLogDto),
};
