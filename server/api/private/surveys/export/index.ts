import type { DefineMethods } from 'aspida';

// グルーピング用パスセグメント（/api/private/surveys/export）。直下にエンドポイントは無く、
// 子ルート（csv）のみ。frourio は各ディレクトリに index.ts を要求するため空 Methods を定義。
export type Methods = DefineMethods<Record<string, never>>;
