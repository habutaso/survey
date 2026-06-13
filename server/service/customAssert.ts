import assert from 'assert';

export class CustomError extends Error {}

// 認可違反（fail closed, Q6=A）。共通エラーハンドラ（非GET）で HTTP 403 に変換される。
export class ForbiddenError extends CustomError {}

// 対象リソース不在。GET 以外の例外として 403、GET では 404 に変換される（U-Cross で精緻化）。
export class NotFoundError extends CustomError {}

export function customAssert(val: unknown, msg: string): asserts val {
  assert(val, new CustomError(msg));
}
