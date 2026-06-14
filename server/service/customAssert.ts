import assert from 'assert';

export class CustomError extends Error {}

// 入力検証失敗（fail closed）。共通エラーハンドラで HTTP 400 に変換される。
export class ValidationError extends CustomError {}

// 認証失敗（トークン無効/失効等）。共通エラーハンドラで HTTP 401 に変換される。
export class UnauthorizedError extends CustomError {}

// 認可違反（fail closed, Q6=A）。共通エラーハンドラで HTTP 403 に変換される。
export class ForbiddenError extends CustomError {}

// 対象リソース不在。共通エラーハンドラで HTTP 404 に変換される（U-Cross で精緻化）。
export class NotFoundError extends CustomError {}

export function customAssert(val: unknown, msg: string): asserts val {
  assert(val, new CustomError(msg));
}
