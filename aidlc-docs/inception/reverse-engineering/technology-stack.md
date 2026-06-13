# Technology Stack

## Programming Languages
- TypeScript - ^5.7 - フロント/バック/スクリプト全体。

## Frameworks
- Next.js - ^15.5 - フロントエンド（App Router, React 18）。
- Fastify - ^5.2 - バックエンド HTTP サーバー。
- frourio - ^1.3 - 型安全ルーティング（サーバー）。
- aspida (+ @aspida/axios, @aspida/swr) - ^1.14 - 型安全 HTTP クライアント。
- React - ^18.3 - UI。
- Prisma - ^5.22 - ORM。
- AWS Amplify (+ @aws-amplify/ui-react) - ^6.x - クライアント認証 UI/フロー。
- jotai - ^2.10 - クライアント状態管理。
- SWR - ^2.2 - データ取得/キャッシュ。
- zod - ^3.23 - バリデーション。
- velona - ^0.8 - 依存性注入。

## Infrastructure
- PostgreSQL - 16 - 主データストア。
- AWS Cognito - 認証（ローカルは magnito エミュレータ）。
- S3 / Cloudflare R2 / MinIO - オブジェクトストレージ（画像）。
- Inbucket - ローカル仮想メール。
- Docker / Docker Compose - ローカル環境と本番デプロイ（単一コンテナー）。

## Build Tools
- npm + npm-run-all (run-p/run-s) - モノレポのスクリプト並列/直列実行。
- esbuild (+ esbuild-register, esbuild-node-externals) - ^0.24 - サーバービルド。
- frourio CLI / aspida CLI / pathpida / aspida2openapi / happy-css-modules - コード/型/OpenAPI/CSS型生成。
- prisma CLI - マイグレーション/クライアント生成。
- notios - ^0.5 - 開発ターミナル制御。
- node-dev - サーバーのホットリロード。

## Testing Tools
- Vitest - ^2.1 - テストランナー（client/server）。
- @vitest/coverage-v8 - カバレッジ。
- inbucket-js-client - テストでのメール検証コード取得。
- axios - テスト用 HTTP クライアント。

## Linting / Formatting
- ESLint ^9 (typescript-eslint, eslint-plugin-react, react-hooks) - flat config。
- Prettier ^3 (+ organize-imports)。
- Stylelint ^16 (standard, recess-order)。
- `prisma format`（server lint）。
