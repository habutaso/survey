import tsconfigPaths from 'vite-tsconfig-paths';
import { defaultExclude, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    setupFiles: ['tests/localFirst/setup.ts'],
    exclude: [...defaultExclude],
    coverage: {
      // U6f 非 UI ロジックに 100% を課す（Q8=A）。React フック・compose・amplify アダプタは対象外。
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
      include: [
        'features/localFirst/model/**',
        'features/localFirst/crypto/draftCrypto.ts',
        'features/localFirst/store/**',
        'features/localFirst/service/**',
        'features/survey/model/**',
      ],
    },
  },
});
