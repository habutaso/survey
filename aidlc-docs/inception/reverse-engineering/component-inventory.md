# Component Inventory

## Application Packages
- `client` - Next.js フロントエンド（App Router, Amplify 認証, aspida クライアント, SWR）。
- `server` - Fastify バックエンド（frourio API, ドメイン層, service 層）。

## Infrastructure Packages
- なし（CDK/Terraform/CloudFormation 未使用）。インフラはローカル `compose.yml` と本番 `Dockerfile` で表現。

## Shared Packages
- `server/common` - DTO 型・zod バリデータ・Branded ID・定数。client から symlink (`client/common`) で共有。
- 生成物: `server/$server` (frourio), `client/api/$api` (aspida) を symlink (`client/api`) で共有。

## Test Packages
- `server/tests` - API 統合テスト（public, private/index, private/tasks, private/di）+ setup（DB/S3/Cognito リセット）。
- `client/tests` - 最小限のテスト（index.test.ts）。

## Total Count
- **Total Packages**: 2 アプリ（client, server） + 1 共有領域（server/common）
- **Application**: 2
- **Infrastructure**: 0（IaCなし）
- **Shared**: 1（server/common）
- **Test**: 2（server/tests, client/tests）

## ローカル開発インフラ（compose.yml）
- `magnito` - Cognito エミュレータ（5050-5052）
- `inbucket` - 仮想 SMTP/メール UI（2500/2501）
- `minio` + `mc` - S3 互換ストレージとバケット初期化（9000/9001）
- `postgres` - PostgreSQL 16（5432）
