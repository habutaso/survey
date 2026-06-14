import type { AuditLog } from '@prisma/client';
import type { AuditAction, AuditLogDto, AuditOutcome, FieldChange } from 'common/types/audit';
import { brandedId } from 'common/validators/brandedId';

export const toAuditLogDto = (row: AuditLog): AuditLogDto => ({
  id: brandedId.auditLog.dto.parse(row.id),
  occurredAt: row.occurredAt.getTime(),
  actorUserId: row.actorUserId === null ? null : brandedId.user.dto.parse(row.actorUserId),
  action: row.action as AuditAction,
  targetType: row.targetType,
  targetId: row.targetId,
  outcome: row.outcome as AuditOutcome,
  summary: row.summary,
  changes: row.changes as unknown as FieldChange[] | null,
});
