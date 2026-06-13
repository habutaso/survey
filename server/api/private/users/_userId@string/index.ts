import type { DefineMethods } from 'aspida';

// 中間パスノード（エンドポイントなし）。実エンドポイントは配下の roles に定義。
export type Methods = DefineMethods<Record<string, never>>;
