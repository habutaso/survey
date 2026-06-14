import type { AuditAction, AuditOutcome, FieldChange } from 'common/types/audit';
import type { DtoId } from 'common/types/brandedId';
import { brandedId } from 'common/validators/brandedId';
import { ulid } from 'ulid';
import type { AuditLogEntity } from './auditType';

// 監査記録イベント（記録呼出の入力）。occurredAt/id は付与しない。
export type AuditEvent = {
  actorUserId: DtoId['user'] | null;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  outcome?: AuditOutcome;
  summary: string;
  changes?: FieldChange[] | null;
};

// 監査モデル（純粋・L2）。PII マスク・変更抽出・エンティティ生成。
export const auditMethod = {
  // PII 値のマスク（BR-4）。email は形を残し、その他は伏字化。
  maskValue: (value: string): string => (value.includes('@') ? '***@***' : '***'),

  // 変更フィールドのみ抽出。PII フィールドはマスク、非 PII は実値（BR-4）。
  toFieldChanges: (
    entries: { field: string; before: string; after: string; pii: boolean }[],
  ): FieldChange[] =>
    entries
      .filter((entry) => entry.before !== entry.after)
      .map((entry) => ({
        field: entry.field,
        before: entry.pii ? auditMethod.maskValue(entry.before) : entry.before,
        after: entry.pii ? auditMethod.maskValue(entry.after) : entry.after,
      })),

  // 監査エンティティ生成（ID 採番・発生時刻・既定値補完）。
  create: (event: AuditEvent): AuditLogEntity => ({
    id: brandedId.auditLog.entity.parse(ulid()),
    occurredAt: Date.now(),
    actorUserId: event.actorUserId,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId ?? null,
    outcome: event.outcome ?? 'success',
    summary: event.summary,
    changes: event.changes ?? null,
  }),
};
