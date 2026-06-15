import dotenv from 'dotenv';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defaultExclude, defineConfig } from 'vitest/config';
import { S3_BUCKET } from './service/envValues';

dotenv.config();

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    env: {
      S3_BUCKET: `${S3_BUCKET}-test`,
      DATABASE_URL: process.env.DATABASE_URL?.replace(/[^/]+$/, 'test') ?? '',
    },
    setupFiles: ['tests/setup.ts'],
    includeSource: ['**/*.ts'],
    exclude: [...defaultExclude, 'scripts/*.ts'],
    // include: ['**/index.test.ts'],
    poolOptions: { forks: { singleFork: true } },
    hookTimeout: 10000,
    // 結合テスト（magnito Cognito エミュレータ）はフルスイートの連続負荷下でレイテンシが
    // 累積し、稀に 15s を超える（単体実行では各 ~2.3s）。ロジック不具合は全リトライで決定論的に
    // 失敗するため本値の緩和では隠蔽されない。スイート成長（U4 で写真結合テスト +4）に伴い余裕を確保。
    testTimeout: 30000,
    // Cognito エミュレータ（magnito）が連続的なユーザー作成/認証の負荷下で内部的に
    // 一過性エラーを返すことがあるため、結合テストの transient 失敗を吸収する小さなリトライ。
    // ロジックの不具合は全リトライで決定論的に失敗するため、本設定で隠蔽されない。
    retry: 2,
    coverage: {
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
      include: ['api/**/{controller,hooks,validators}.ts', 'common/**', 'domain/**'],
    },
  },
});
