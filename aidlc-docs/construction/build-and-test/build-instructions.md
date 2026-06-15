# Build Instructions（CATAPULT / 住家被害認定調査アプリ）

全ユニット（U0〜U6u）のビルド手順。モノレポ（ルート / `client` / `server`）。

## 前提
- **ビルドツール**: npm（Node.js **v24 以上**, `engines.node >=24.0.0`）。`run-p`/`run-s`（npm-run-all）でモノレポ並走。
- **ローカル依存**: Docker / Docker Compose（PostgreSQL・Cognito エミュレータ magnito・MinIO(S3)・Inbucket(メール)）。
- **パッケージ**: `package.json` は 3 つ（ルート / client / server）。
- **コード生成系**: Prisma・frourio(`$server`)・aspida(`$api`)・pathpida(`$path`)・happy-css-modules(hcm `*.module.css.d.ts`)。

## 必要な環境変数（デプロイ / 実行時）
`client/.env`・`server/.env`（`.env.example` をコピー）。本番 Dockerfile デプロイ時:
```
NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=  NEXT_PUBLIC_COGNITO_USER_POOL_ID=  NEXT_PUBLIC_COGNITO_POOL_ENDPOINT=
COGNITO_ACCESS_KEY=  COGNITO_SECRET_KEY=  COGNITO_REGION=
DATABASE_URL=
S3_ACCESS_KEY=  S3_BUCKET=  S3_ENDPOINT=  S3_REGION=  S3_SECRET_KEY=
PDF_FONT_PATH=（任意・既定 cwd/assets/fonts/ipaexg.ttf, U5）
PORT=（任意）
```

## ビルド手順

### 1. 依存インストール
```bash
npm i
npm i --prefix client
npm i --prefix server
```
> U6f で client に追加: `idb@8.0.0`（依存）, `fast-check@3.23.2`・`fake-indexeddb@6.0.0`（devDep, pinned）。

### 2. 環境設定（ローカル）
```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
docker compose up -d        # postgres / magnito / minio / inbucket
```

### 3. コード生成 ＋ マイグレーション
```bash
npm run generate            # prisma + frourio($server) + aspida($api) + pathpida($path) + hcm
npm run migrate:deploy --prefix server   # prisma migrate deploy + seed（初期 admin 等）
```
> 適用済みマイグレーション: `add_user_roles` / `add_audit_log` / `add_survey` / `add_photo` / `add_survey_search_indexes`。

### 4. 全ユニットのビルド
```bash
npm run build               # build:client(next build) + build:server(esbuild, 内部で generate+migrate:deploy)
```

### 5. ビルド成功の確認
- **client**: `.next/` 生成、`next build` がエラーなく完了。
- **server**: `index.js`（esbuild バンドル）生成。
- **生成物**: `client/utils/$path.ts`・`client/api/$api.ts`・`server/api/$server.ts`・Prisma Client・`*.module.css.d.ts`。
- **デプロイ**: ルート `Dockerfile` で単一コンテナ化（client を server の `@fastify/http-proxy` 配下で配信）。ヘルスチェック `/api/health`。

## デプロイ前の必須インフラ設定
- **S3 バケット CORS（U4 申し送り）**: クライアント直アップロード（presigned PUT）のため `AllowedMethods=[PUT,GET]`・`AllowedOrigins=[フロントオリジン]`・必要ヘッダを許可。ローカル MinIO / 本番双方で設定。
- **S3 既定 SSE・パブリックアクセスブロック**（at-rest 暗号化・非公開, U4/U5 Infra）。
- TLS は配信層（通信時暗号化, SECURITY-01/NFR-05）。

## トラブルシューティング
- **依存エラー / ディスク逼迫**: `npm cache clean --force`。3 つの package.json すべてに `npm i`。
- **client typecheck が `utils/$path` で失敗**: `npm run generate:path --prefix client`（pathpida 生成）。
- **server ビルド/テストが DB 接続で失敗**: `docker compose up -d` と `DATABASE_URL` を確認。`prisma migrate deploy` 未実行ならスキーマ不整合。
- **frourio/aspida 型不一致**: `npm run generate` を再実行（server→client の順で `$server`/`$api` 再生成）。
