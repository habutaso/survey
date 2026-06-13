# CATAPULT 開発ガイドライン（DDD）

本ドキュメントは、CATAPULT を **ドメイン駆動設計 (DDD)** で開発・拡張するための実践ガイドラインです。
既存コードベース（`server/domain` の UseCase / Model / Store 構造、frourio + aspida による型安全 HTTP-RPC、Prisma、zod、Branded ID、velona による DI）を DDD の概念に対応づけ、追加・変更時に従うべき規約を定めます。

---

## 1. 設計原則

1. **ドメインを中心に置く**: ビジネスルールは `server/domain/{context}/` に集約する。フレームワーク（Fastify/Next.js）や永続化（Prisma/S3/Cognito）はドメインに依存させ、その逆を作らない。
2. **依存方向は内向き**: `api(presentation) → domain(usecase → model) → store(infrastructure)`。model 層は他層・外部 SDK に依存しない純粋関数とする。
3. **型で不変条件を表現する**: Branded ID（公称型）と zod で「不正な状態を表現できない」設計を優先する。
4. **副作用は境界に寄せる**: 永続化・外部 I/O は Store 層と Service 層のみ。Model 層は副作用を持たない。
5. **全関数を差し替え可能に**: velona の `depend` で DI 可能にし、テスト容易性を担保する。

---

## 2. DDD 概念と CATAPULT 実装の対応表

| DDD 概念 | CATAPULT での実装 | 場所 |
|---|---|---|
| 境界づけられたコンテキスト (Bounded Context) | `domain/{context}`（例: `user`, `task`） | `server/domain/` |
| エンティティ (Entity) | `{Context}Entity` 型（Branded EntityId を持つ） | `domain/{ctx}/model/{ctx}Type.ts` |
| 値オブジェクト (Value Object) | Branded ID、`image{ url, s3Key }` 等の不変な複合値 | `common/types`, `common/validators` |
| 集約 (Aggregate) / 集約ルート | `Task`（Author 参照を内包）、`User` | `domain/task`, `domain/user` |
| ドメインサービス / ファクトリ | `{ctx}Method`（create/update/delete でEntityID生成・不変条件チェック） | `domain/{ctx}/model/{ctx}Method.ts` |
| リポジトリ (Repository) | Store 層：`{ctx}Query`（読み取り） + `{ctx}Command`（書き込み） | `domain/{ctx}/store/` |
| アプリケーションサービス (Use Case) | `{ctx}UseCase`（トランザクション境界・オーケストレーション） | `domain/{ctx}/{ctx}UseCase.ts` |
| DTO / 公開モデル | `{Ctx}Dto`、`toXxxDto` 変換 | `common/types`, `domain/{ctx}/store/toXxxDto.ts` |
| 腐敗防止層 (ACL) | `service/{cognito,s3}` が外部 SDK をドメイン語彙へ変換 | `server/service/` |
| プレゼンテーション層 | frourio コントローラ + 認証フック | `server/api/` |

---

## 3. ディレクトリ構造規約

新しいコンテキスト `foo` を追加する場合、既存の `task` / `user` と同じ形を踏襲する:

```text
server/
├── domain/
│   └── foo/
│       ├── fooUseCase.ts            # アプリケーションサービス（トランザクション境界）
│       ├── model/
│       │   ├── fooType.ts           # FooEntity / 入力ペイロード型
│       │   └── fooMethod.ts         # ファクトリ + ドメインルール（純粋関数）
│       └── store/
│           ├── fooQuery.ts          # 読み取り（Repository: Query）
│           ├── fooCommand.ts        # 書き込み（Repository: Command）
│           └── toFooDto.ts          # 永続化モデル → Dto 変換
├── api/
│   └── private/foo/
│       ├── controller.ts            # frourio コントローラ（薄く保つ）
│       └── index.ts                 # Methods 型定義
├── common/
│   ├── types/foo.ts                 # FooBase / FooDto
│   └── validators/foo.ts            # zod バリデータ
└── prisma/schema.prisma             # Foo モデル追加 + マイグレーション
```

- `common/` は client から symlink で共有される。**サーバー専用の実装（Prisma/AWS SDK 依存）を `common/` に置かない**こと。型と zod バリデータのみ。

---

## 4. レイヤー別の責務と規約

### 4.1 Model 層（`model/`）— 純粋なドメイン
- **責務**: Entity の生成（ファクトリ）、状態遷移、不変条件の保証。
- **規約**:
  - 副作用なし（DB/S3/Cognito/時刻取得以外の I/O 禁止。`Date.now()` / `ulid()` は許容するが、可能なら UseCase から渡す方向を検討）。
  - 入力は Dto / ペイロード、出力は Entity。
  - 認可・不変条件は `assert` で表明する（例: `assert(user.id === task.author.id)`）。違反は例外として上位で 403 化される。
  - ID は必ず `brandedId.{ctx}.entity.parse(...)` を通して生成する。

```ts
// 例: taskMethod.create（既存実装に準拠）
create: (user: UserDto, payload: CreateTaskPayload): TaskEntity => ({
  id: brandedId.task.entity.parse(ulid()),
  done: false,
  label: payload.label,
  imageKey: payload.image && `tasks/images/${ulid()}.${ext(payload.image)}`,
  createdTime: Date.now(),
  author: { id: brandedId.user.dto.parse(user.id), signInName: user.signInName },
}),
```

### 4.2 Store 層（`store/`）— リポジトリ（CQRS 風）
- **責務**: 永続化と外部ストレージ連携。読み取りは `Query`、書き込みは `Command` に分離する。
- **規約**:
  - 第1引数は `tx: Prisma.TransactionClient` を受け取り、トランザクション内で動作可能にする。
  - 永続化モデル（Prisma 型）は層外へ漏らさない。必ず `toXxxDto` で Dto に変換して返す。
  - 副作用を伴う外部 I/O（S3 put/delete 等）は Command 内で行い、DB 整合と順序を意識する。
  - 公開する読み取り関数は velona `depend` で DI 可能にする（テスト用の差し替えのため）。

```ts
// 例: 読み取りは DI 可能に（taskQuery）
export const taskQuery = {
  listByAuthorId,
  findManyWithDI: depend({ listByAuthorId }, (deps, tx, user) => deps.listByAuthorId(tx, user)),
  findById: async (tx, user, taskId) => /* findUniqueOrThrow → toTaskDto */,
};
```

### 4.3 Use Case 層（`{ctx}UseCase.ts`）— アプリケーションサービス
- **責務**: ユースケースのオーケストレーション、トランザクション境界の確定。
- **規約**:
  - 永続化を伴う操作は `transaction('RepeatableRead', async (tx) => { ... })` で包む（`service/prismaClient.ts` のリトライ付きヘルパーを使用）。
  - 「`Query` で取得 → `Method` で遷移 → `Command` で保存」の流れを基本形とする。
  - 外部サービス（Cognito 等）の呼び出しは Service 層（ACL）経由で行う。

```ts
update: (user, body) => transaction('RepeatableRead', async (tx) => {
  const task = await taskQuery.findById(tx, user, body.taskId);
  const updated = taskMethod.update(user, task, body);
  return await taskCommand.save(tx, user, updated);
}),
```

### 4.4 Presentation 層（`api/`）— frourio コントローラ
- **責務**: HTTP I/O、入力バリデーション、UseCase 呼び出し。**ビジネスロジックを書かない**。
- **規約**:
  - 入力は `validators` に zod スキーマを必ず指定する（`common/validators` を再利用）。
  - 認証が必要なものは `api/private/` 配下に置き、`hooks.ts`（`req.user` 注入）を前提にする。
  - コントローラは「バリデート済み入力を UseCase に渡し、結果を返す」だけの薄さを保つ。
  - エラーは `service/app.ts` のハンドラに委譲（GET=404 / その他=403、`CustomError` はメッセージ送出）。

### 4.5 Service 層（`service/`）— 腐敗防止層 / 基盤
- **責務**: 外部 SDK（AWS Cognito / S3）・Prisma・環境変数を、ドメインが扱いやすい語彙に変換。
- **規約**:
  - 環境変数は `envValues.ts` で zod 検証してからエクスポートする（生 `process.env` をドメインで参照しない）。
  - 外部 SDK の型・例外をドメイン層に漏らさない（必要に応じて `CustomError` へ変換）。

---

## 5. 型と検証の規約

- **Branded ID を徹底する**: 新コンテキストを追加したら `common/constants` の `ID_NAME_LIST` に名前を追加し、`brandedId.{name}.{entity|dto|maybe}` を使う。生文字列の ID を関数間で受け渡さない。
- **三種の ID 表現を使い分ける**:
  - `EntityId`: ドメイン内部（Entity）。
  - `DtoId`: 層をまたいで公開する Dto。
  - `MaybeId`: 外部入力（未検証の ID、例: パスパラメータ）。
- **バリデーションは境界で**: API 入力・環境変数は zod で検証。`label` のような制約（1〜20文字）は `common/validators` に定義し client/server で共有する。
- **Base 型を共有し Dto/Entity で拡張**: `XxxBase`（共有フィールド）→ `XxxDto`（+ DtoId）/ `XxxEntity`（+ EntityId）の派生パターンを踏襲する。

---

## 6. データフロー（遵守すべき形）

### 取得系
```
Next.js → GET controller → store/xxxQuery → Prisma → (Dto) → controller → Next.js
```

### 更新系
```
Next.js(Body) → POST/PATCH/DELETE controller → xxxUseCase
  → (Query で現状取得) → model/xxxMethod（遷移・検証） → store/xxxCommand（保存・S3）
  → (Dto) → controller → Next.js
```

---

## 7. テスト規約

- **統合テスト優先**: `server/tests/api/` に frourio クライアント経由のシナリオテストを追加する。各テストは `prisma migrate reset` と S3/Cognito リセットで独立性を保つ（`tests/setup.ts` 準拠）。
- **DI でユニット検証**: ドメインの分岐は `controller.inject({...})` または `depend` の差し替えでモックし検証する（`tests/api/private/di.test.ts` 参照）。
- **新機能には必ずテストを追加**: UseCase の正常系 + 認可違反（他ユーザーのリソース操作が拒否される）を最低限カバーする。
- 実行: `npm run test`（ルート） / `npm run test --prefix server`。

---

## 8. コード生成・ビルドのワークフロー

変更後は以下を実行して型整合とビルドを確認する:

```sh
npm run generate    # prisma generate / frourio / aspida / pathpida など
npm run typecheck   # client/server の tsc --noEmit
npm run lint        # eslint / stylelint / prettier / prisma format
npm run test        # vitest
```

- API（controller）を追加・変更したら `npm run generate` を実行し、`$server` / `$api` 型を再生成する。
- Prisma スキーマを変更したら `npm run migrate:dev --prefix server`（または `migrate:dev:createonly`）でマイグレーションを作成する。

---

## 9. 命名規約

- コンテキスト名は単数形・lowerCamel（`task`, `user`）。
- ファイル: `{ctx}UseCase.ts` / `{ctx}Method.ts` / `{ctx}Query.ts` / `{ctx}Command.ts` / `to{Ctx}Dto.ts` / `{ctx}Type.ts`。
- 型: `{Ctx}Base` / `{Ctx}Dto` / `{Ctx}Entity` / `Create{Ctx}Payload` / `Update{Ctx}Body`。
- zod バリデータ: `{ctx}Validator`（`createBody` / `updateBody` / `deleteBody` / `listQuery`）。

---

## 10. セキュリティ・横断的関心事

- **認可**: リソース操作は所有者チェック（`assert(user.id === resource.author.id)`）を Model 層で必ず行う。
- **認証**: 認証必須 API は `api/private/` 配下に置き、Cookie の idToken を `hooks.ts` で検証する。トークンは HttpOnly / Secure / SameSite=strict Cookie に保持し、クライアント JS から触らせない。
- **入力検証**: すべての外部入力を zod で検証してからドメインに渡す。
- **シークレット**: 認証情報は環境変数経由（`envValues.ts`）。コードやリポジトリにハードコードしない。
- **画像アップロード**: 受け入れ拡張子・MIME を検証し、キーは `tasks/images/{ulid}.{ext}` の形式で衝突を避ける。

---

## 付録: 新コンテキスト追加チェックリスト

- [ ] `common/constants` の `ID_NAME_LIST` に新コンテキスト名を追加
- [ ] `common/types/{ctx}.ts`（Base / Dto）と `common/validators/{ctx}.ts` を作成
- [ ] `prisma/schema.prisma` にモデル追加 → マイグレーション作成
- [ ] `domain/{ctx}/model/{ctx}Type.ts` / `{ctx}Method.ts`（純粋関数）
- [ ] `domain/{ctx}/store/{ctx}Query.ts` / `{ctx}Command.ts` / `to{Ctx}Dto.ts`
- [ ] `domain/{ctx}/{ctx}UseCase.ts`（トランザクション境界）
- [ ] `api/private/{ctx}/controller.ts`（薄いコントローラ + zod validators）
- [ ] `npm run generate` で型再生成
- [ ] `server/tests/api/` に正常系 + 認可違反テストを追加
- [ ] `typecheck` / `lint` / `test` がすべて成功
