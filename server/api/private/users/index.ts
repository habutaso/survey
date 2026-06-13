import type { DefineMethods } from 'aspida';

// 中間パスノード（エンドポイントなし）。実エンドポイントは配下の _userId@string/roles に定義。
// ユーザー一覧/検索 API は U6u（管理 UI 併設）で追加予定。
export type Methods = DefineMethods<Record<string, never>>;
