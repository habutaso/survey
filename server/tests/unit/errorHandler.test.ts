import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from 'service/customAssert';
import { GENERIC_ERROR_MESSAGE, resolveBody, resolveHttpStatus } from 'service/errorHandler';
import { describe, expect, test } from 'vitest';

describe('resolveHttpStatus（INV-B: 型→HTTP の網羅）', () => {
  test('例外型ごとに一意な HTTP ステータス', () => {
    expect(resolveHttpStatus(new UnauthorizedError())).toBe(401);
    expect(resolveHttpStatus(new ForbiddenError())).toBe(403);
    expect(resolveHttpStatus(new NotFoundError())).toBe(404);
    expect(resolveHttpStatus(new ValidationError())).toBe(400);
    expect(resolveHttpStatus({ validation: [{ message: 'bad' }] })).toBe(400);
    expect(resolveHttpStatus(new Error('boom'))).toBe(500);
  });
});

describe('resolveBody（INV-C: fail closed・詳細秘匿）', () => {
  test('CustomError は安全な message を送出', () => {
    expect(resolveBody(new ForbiddenError('権限がありません'), 403)).toBe('権限がありません');
  });

  test('500 は一般メッセージのみ（内部詳細を秘匿）', () => {
    expect(resolveBody(new Error('stack trace leak'), 500)).toBe(GENERIC_ERROR_MESSAGE);
  });

  test('非 CustomError（fastify 検証等）は一般メッセージ', () => {
    expect(resolveBody({ validation: [{ message: 'bad' }] }, 400)).toBe(GENERIC_ERROR_MESSAGE);
  });
});
