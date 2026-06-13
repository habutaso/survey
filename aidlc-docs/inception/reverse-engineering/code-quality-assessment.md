# Code Quality Assessment

## Test Coverage
- **Overall**: Fair〜Good（サーバー API は統合テストで主要フローを網羅、カバレッジは v8 で計測）。
- **Unit Tests**: ドメイン純粋関数は直接の単体テストよりも API 統合テスト経由で検証される傾向。
- **Integration Tests**: `server/tests/api/` に public / private / tasks / di の統合テスト。各テストで `prisma migrate reset` と S3/Cognito のリセットを実施し独立性を確保。
- **Client Tests**: 最小限（`client/tests/index.test.ts` のみ）。UI コンポーネントのテストは限定的。

## Code Quality Indicators
- **Linting**: 充実（ESLint flat config + typescript-eslint + react/react-hooks、Stylelint、Prettier、prisma format）。
- **Code Style**: 一貫性が高い。関数型・小さな純粋関数・Branded ID・明確なレイヤー分離。
- **Documentation**: README が充実（データフロー図、開発手順、デプロイ）。コード内コメントは最小限だが構造が自己説明的。

## Technical Debt
- `server/prisma/seed.ts` は実質空（`someFn` がプレースホルダ）。
- クライアントテストが薄く、UI 回帰検知が弱い。
- エラーハンドラが「GET=404 / その他=403」と一律で、エラー種別に対する HTTP ステータスの粒度が粗い（意図的な簡素化と思われる）。
- `User.email` などにユニーク制約がスキーマ上はない（認証は Cognito 側が担保）。
- 一部 `eslint-disable`（complexity, prefer-promise-reject-errors）が AuthLoader に存在。

## Patterns and Anti-patterns
- **Good Patterns**:
  - UseCase / Model / Store の明確な3層分離（`server/domain/**`）。
  - velona による全関数 DI でテスト容易性を担保。
  - Branded ID による ID 取り違え防止。
  - zod による境界バリデーション（API 入力・環境変数）。
  - リトライ付きトランザクションヘルパー（P2028/P2034 を指数なし再試行）。
  - HttpOnly/Secure/SameSite=strict Cookie による 3rd Party Cookie レス認証。
  - 端から端までの型安全（frourio + aspida + Prisma + zod）。
- **Anti-patterns / 留意点**:
  - 認可チェックが `assert(user.id === task.author.id)` に依存（例外で 403 化）。明示的な権限モデルではない。
  - タスクの一覧コントローラと個別コントローラで update/delete が重複（API 表面が二重）。
  - シードのプレースホルダ放置。
