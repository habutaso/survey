# System Architecture

## System Overview

CATAPULT は単一の Docker コンテナーでデプロイ可能な FullStack TypeScript アプリケーションです。Next.js (client) と Fastify (server) のモノレポ構成で、本番環境では Fastify が Next.js の前段に立ち、`/api` 以外のリクエストを内部の Next.js サーバーへプロキシします。型安全性は aspida（HTTPクライアント型生成）と frourio（ルーティング型生成）、Prisma（DB型生成）で端から端まで担保されます。

## Architecture Diagram

```mermaid
flowchart TB
  subgraph client["client (Next.js :PORT+1)"]
    pages["App Router pages"]
    amplify["AWS Amplify Auth UI"]
    apiclient["aspida apiClient (axios + SWR)"]
  end

  subgraph server["server (Fastify :PORT)"]
    proxy["http-proxy (本番のみ)"]
    jwt["fastify-jwt 検証"]
    api["frourio API ($server)"]
    domain["domain層 (user / task)"]
    svc["service層 (cognito/s3/prisma)"]
  end

  cognito["AWS Cognito"]
  s3["S3 / R2 / MinIO"]
  db[("PostgreSQL")]

  pages --> apiclient
  amplify --> cognito
  apiclient -->|"/api/*"| api
  proxy -->|"非API"| pages
  api --> jwt
  api --> domain
  domain --> svc
  svc --> cognito
  svc --> s3
  svc --> db
```

## Component Descriptions

### client
- **Purpose**: Web UI とクライアントサイド認証フロー。
- **Responsibilities**: Amplify 認証、Cookie セッション確立、タスク操作 UI、SWR データ取得。
- **Dependencies**: server の `/api`、AWS Cognito（Amplify 経由）。
- **Type**: Application (Frontend)

### server
- **Purpose**: API サーバーおよび本番時の Next.js プロキシ。
- **Responsibilities**: 認証検証、ビジネスロジック、永続化、外部サービス連携。
- **Dependencies**: PostgreSQL、Cognito、S3。
- **Type**: Application (Backend)

### server/domain
- **Purpose**: ドメインロジック（関数型 + DI）。
- **Responsibilities**: UseCase / model / store の3層でタスク・ユーザーの整合性を保つ。
- **Dependencies**: service層（prisma/cognito/s3）。
- **Type**: Application (Domain)

### server/service
- **Purpose**: 外部リソースのクライアントとアプリ初期化。
- **Responsibilities**: Fastify 構築、Prisma/Cognito/S3 クライアント、環境変数の検証 (zod)。
- **Dependencies**: AWS SDK、Prisma、Fastify プラグイン。
- **Type**: Infrastructure (Application-level)

## Data Flow

### データ取得（タスク一覧）

```mermaid
sequenceDiagram
  participant C as Next.js Client
  participant A as GET /api/private/tasks
  participant H as private/hooks (認証)
  participant Q as taskQuery
  participant DB as PostgreSQL
  C->>A: $get (Cookie: idToken)
  A->>H: onRequest jwtVerify + findOrCreateUser
  H->>Q: listByAuthorId(user)
  Q->>DB: findMany(authorId)
  DB-->>Q: rows
  Q-->>A: TaskDto[]
  A-->>C: TaskDto[]
```

### データ更新（タスク作成）

```mermaid
sequenceDiagram
  participant C as Next.js Client
  participant A as POST /api/private/tasks
  participant U as taskUseCase.create
  participant M as taskMethod.create
  participant Cmd as taskCommand.save
  participant S3 as S3
  participant DB as PostgreSQL
  C->>A: $post (label, image)
  A->>U: create(user, payload)
  U->>M: create(user, payload) → TaskEntity
  U->>Cmd: save(tx, user, entity, image)
  Cmd->>S3: put(image)
  Cmd->>DB: upsert(task)
  DB-->>Cmd: row
  Cmd-->>U: TaskDto
  U-->>A: TaskDto
  A-->>C: TaskDto
```

## Integration Points

- **External APIs**:
  - AWS Cognito Identity Provider — 認証、ユーザー属性取得、メール検証。
- **Databases**:
  - PostgreSQL — User / Task の永続化（Prisma 経由、RepeatableRead トランザクション）。
- **Third-party Services**:
  - S3 / Cloudflare R2 / MinIO（ローカル）— タスク添付画像のオブジェクトストレージ。
  - Inbucket（ローカル）— 仮想メール受信（検証コード）。
  - magnito（ローカル）— Cognito エミュレータ。

## Infrastructure Components

- **CDK Stacks**: なし（IaC は未使用）。
- **Deployment Model**: 単一 Dockerfile（node:20-alpine）。`npm run build` 後 `npm start` で client/server を同時起動。本番は Fastify が Next.js を内部プロキシ。
- **Networking**: 単一プロセス/コンテナー。Fastify が外部公開ポート、Next.js は `PORT+1` で内部待受。
- **Local Dev (compose.yml)**: magnito(5050-5052), inbucket(2500/2501), minio(9000/9001), postgres(5432)。
