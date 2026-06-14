import type { AUDIT_ACTION_LIST, AUDIT_OUTCOME_LIST } from 'common/constants';
import type { DtoId } from './brandedId';

// 監査アクション/結果。値の真実の源は common/constants の各リスト。
export type AuditAction = (typeof AUDIT_ACTION_LIST)[number];
export type AuditOutcome = (typeof AUDIT_OUTCOME_LIST)[number];

// 変更系監査の前後値（PII 実体は保存せずマスク値を入れる, BR-4）。
export type FieldChange = {
  field: string;
  before: string;
  after: string;
};

export type AuditLogBase = {
  occurredAt: number; // epoch ms
  actorUserId: DtoId['user'] | null; // 実施者（システム/未認証は null）
  action: AuditAction;
  targetType: string;
  targetId: string | null;
  outcome: AuditOutcome;
  summary: string; // PII を含めない
  changes: FieldChange[] | null; // 変更系のみ（マスク済）
};

export type AuditLogDto = AuditLogBase & { id: DtoId['auditLog'] };
