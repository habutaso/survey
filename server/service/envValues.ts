import { config } from 'dotenv';
import path from 'path';
import { z } from 'zod';

config({ path: '../client/.env' });
config();

const SERVER_PORT = +z.string().regex(/^\d+$/).parse(process.env.NEXT_PUBLIC_SERVER_PORT);
const API_BASE_PATH = z.string().startsWith('/').parse(process.env.NEXT_PUBLIC_API_BASE_PATH);
const COGNITO_ACCESS_KEY = z.string().optional().parse(process.env.COGNITO_ACCESS_KEY);
const COGNITO_SECRET_KEY = z.string().optional().parse(process.env.COGNITO_SECRET_KEY);
const COGNITO_REGION = z.string().optional().parse(process.env.COGNITO_REGION);
const COGNITO_POOL_ENDPOINT = z
  .string()
  .url()
  .optional()
  .parse(process.env.NEXT_PUBLIC_COGNITO_POOL_ENDPOINT);
const COGNITO_USER_POOL_ID = z.string().parse(process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID);
const COGNITO_USER_POOL_CLIENT_ID = z
  .string()
  .parse(process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID);
const S3_ENDPOINT = z.string().default('').parse(process.env.S3_ENDPOINT);
const S3_BUCKET = z.string().default('').parse(process.env.S3_BUCKET);
const S3_PUBLIC_ENDPOINT = z
  .string()
  .url()
  .default(`${S3_ENDPOINT}/${S3_BUCKET}`)
  .parse(process.env.S3_PUBLIC_ENDPOINT);
const S3_ACCESS_KEY = z.string().default('').parse(process.env.S3_ACCESS_KEY);
const S3_SECRET_KEY = z.string().default('').parse(process.env.S3_SECRET_KEY);
const S3_REGION = z.string().default('').parse(process.env.S3_REGION);

// 初期管理者識別子（FU-2/BR-7）。カンマ区切りの email または signInName。未指定なら空配列（自動付与なし）。
const INITIAL_ADMIN_IDENTIFIERS = z
  .string()
  .default('')
  .parse(process.env.INITIAL_ADMIN_IDENTIFIERS)
  .split(',')
  .map((identifier) => identifier.trim())
  .filter((identifier) => identifier.length > 0);

// 同梱日本語フォントのパス（U5 / Q-U5-11=A）。未指定時は server/assets/fonts/ipaexg.ttf。
// cwd=server（npm start / vitest とも server ディレクトリ）。デプロイ環境差異は本 env で上書き可能。
const PDF_FONT_PATH = z
  .string()
  .default(path.join(process.cwd(), 'assets', 'fonts', 'ipaexg.ttf'))
  .parse(process.env.PDF_FONT_PATH);

export {
  API_BASE_PATH,
  COGNITO_ACCESS_KEY,
  COGNITO_POOL_ENDPOINT,
  COGNITO_REGION,
  COGNITO_SECRET_KEY,
  COGNITO_USER_POOL_CLIENT_ID,
  COGNITO_USER_POOL_ID,
  INITIAL_ADMIN_IDENTIFIERS,
  PDF_FONT_PATH,
  S3_ACCESS_KEY,
  S3_BUCKET,
  S3_ENDPOINT,
  S3_PUBLIC_ENDPOINT,
  S3_REGION,
  S3_SECRET_KEY,
  SERVER_PORT,
};
