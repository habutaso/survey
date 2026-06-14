import { AUDIT_ACTION_LIST } from 'common/constants';
import { auditMethod } from 'domain/audit/model/auditMethod';
import fc from 'fast-check';
import { describe, expect, test } from 'vitest';

describe('auditMethod.maskValue', () => {
  test('email は形を残してマスク', () => {
    expect(auditMethod.maskValue('user@example.com')).toBe('***@***');
  });

  test('email 以外は伏字化', () => {
    expect(auditMethod.maskValue('東京都...')).toBe('***');
  });
});

describe('auditMethod.toFieldChanges', () => {
  test('変更フィールドのみ抽出し、PII はマスク・非 PII は実値', () => {
    const changes = auditMethod.toFieldChanges([
      { field: 'email', before: 'a@example.com', after: 'b@example.com', pii: true },
      { field: 'status', before: 'draft', after: 'submitted', pii: false },
      { field: 'unchanged', before: 'x', after: 'x', pii: false },
    ]);

    expect(changes).toEqual([
      { field: 'email', before: '***@***', after: '***@***' },
      { field: 'status', before: 'draft', after: 'submitted' },
    ]);
  });

  test('INV-A: PII フィールドの出力に実体が含まれない', () => {
    fc.assert(
      fc.property(fc.emailAddress(), fc.emailAddress(), (before, after) => {
        fc.pre(before !== after);
        const [change] = auditMethod.toFieldChanges([{ field: 'email', before, after, pii: true }]);

        expect(change).toBeDefined();
        expect(change!.before).not.toContain(before);
        expect(change!.after).not.toContain(after);
      }),
    );
  });
});

describe('auditMethod.create', () => {
  test('既定値補完（outcome=success, targetId/changes=null）', () => {
    const entity = auditMethod.create({
      actorUserId: null,
      action: 'auth.failure',
      targetType: 'auth',
      summary: '認証失敗',
    });

    expect(entity.outcome).toBe('success');
    expect(entity.targetId).toBeNull();
    expect(entity.changes).toBeNull();
    expect(entity.id).toBeTruthy();
    expect(entity.occurredAt).toBeGreaterThan(0);
    expect(AUDIT_ACTION_LIST).toContain(entity.action);
  });

  test('指定値を尊重（outcome/targetId/changes）', () => {
    const entity = auditMethod.create({
      actorUserId: null,
      action: 'user.roles.change',
      targetType: 'user',
      targetId: 'user-1',
      outcome: 'failure',
      summary: 'ロール変更',
      changes: [{ field: 'roles', before: 'a', after: 'b' }],
    });

    expect(entity.outcome).toBe('failure');
    expect(entity.targetId).toBe('user-1');
    expect(entity.changes).toEqual([{ field: 'roles', before: 'a', after: 'b' }]);
  });
});
