import { AUDIT_ACTION_LIST, AUDIT_OUTCOME_LIST } from 'common/constants';
import { z } from 'zod';

// 監査アクション/結果のバリデータ（境界検証・後続ユニット利用）。
export const auditActionValidator = z.enum(AUDIT_ACTION_LIST);

export const auditOutcomeValidator = z.enum(AUDIT_OUTCOME_LIST);
