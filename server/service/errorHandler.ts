import type { FastifyError } from 'fastify';
import { ZodError } from 'zod';
import {
  CustomError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from './customAssert';

// 利用者向けの一般メッセージ（内部詳細・スタックを秘匿, fail closed）。
export const GENERIC_ERROR_MESSAGE = '予期しないエラーが発生しました';

// エラー型 → HTTP ステータス（BR-7）。
export const resolveHttpStatus = (err: unknown): number => {
  if (err instanceof UnauthorizedError) return 401;
  if (err instanceof ForbiddenError) return 403;
  if (err instanceof NotFoundError) return 404;
  // 入力検証失敗（手動 ValidationError / zod 由来 / fastify schema 検証）。
  if (err instanceof ValidationError) return 400;
  if (err instanceof ZodError) return 400;
  if ((err as FastifyError).validation !== undefined) return 400;
  return 500;
};

// 応答ボディ。500 は一般メッセージのみ。CustomError は安全な message を送出、
// その他（fastify 検証エラー等）は一般メッセージで詳細を秘匿。
export const resolveBody = (err: unknown, status: number): string => {
  if (status === 500) return GENERIC_ERROR_MESSAGE;
  if (err instanceof CustomError) return err.message;

  return GENERIC_ERROR_MESSAGE;
};
