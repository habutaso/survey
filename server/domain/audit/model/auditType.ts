import type { EntityId } from 'common/types/brandedId';
import type { AuditLogBase } from 'common/types/audit';

export type AuditLogEntity = AuditLogBase & { id: EntityId['auditLog'] };
