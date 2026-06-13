# U1 — コード生成計画（Code Generation Plan: 認証・ユーザー/ロール基盤）

本計画は U1 のコード生成の**単一の真実の源**です。Brownfield のため「生成」は既存ファイルの**修正**を含みます。下部の承認後に Part 2（実行）を行います。

## ユニット・コンテキスト
- **ユニット**: U1 — 認証・ユーザー/ロール基盤
- **ワークスペースルート**: `/root/environment/survey`（Brownfield モノレポ / `server` Fastify + `client` Next.js）
- **責務**: Cognito 認証（既存踏襲）＋ DB を真実の源とするロール（surveyor/admin/viewer・複数可）保持、認可基盤（L1 `api/private/hooks` ＋ L2 Model `assert*`）、初期管理者ブートストラップ、admin 限定ロール管理 API。
- **依存**: U0 完了済み。後続 U-Cross/U2+ が本基盤を利用。
- **担当ストーリー**: US-101, US-102, US-103, US-802
- **設計入力**: `aidlc-docs/construction/U1/functional-design/`（domain-entities / business-logic-model / business-rules）
- **確定判断**: Q1=B, Q3=B, Q4=B, Q5=A, Q6=A, Q7=A, Q8=B, Q9=B/FU-1=B, FU-2=A, FU-3=A, Q11=A

## ステージ評価（U1, 再掲）
| ステージ | 判定 |
|---|---|
| Functional Design | DONE（承認済み） |
| NFR Requirements / NFR Design / Infrastructure Design | SKIP |
| Code Generation | EXECUTE（本計画） |

## 重要な制約（既存コードベース由来）
- **カバレッジ 100% 必須**（`vite.config.ts`: `domain/**`, `common/**`, `api/**/{controller,hooks,validators}.ts` の statements/branches/functions/lines=100）。**追加コードはすべてテストで網羅する**。
- **エラーハンドラ**: `service/app.ts` の `setErrorHandler` は「非GET の例外→403 / GET の例外→404、`CustomError` のみ message 送出」。U1 の `ForbiddenError`/`NotFoundError` は `CustomError` を継承し、PATCH（非GET）で 403 になる。詳細な 401/403/404 整理は U-Cross で精緻化。
- **frourio/aspida**: `index.ts`=`Methods`（`DefineMethods`）、`controller.ts`=`defineController`＋zod validators。`private` 配下は `hooks.ts` で認証済み（`req.user`）。
- **fast-check 未導入**: PBT のため `server` の devDependencies に **`fast-check`（固定版, 例 `3.23.2`）** を追加する（Part 2 Step 0）。
- **Prisma migrate は破壊的**: `Role` enum ＋ `User.roles` 追加のマイグレーション作成・適用は**ユーザー確認のうえ**実行（U0 からの継続保留 ＋ U1 本体）。テストは `prisma migrate reset --force` で再生成。

---

## 生成ステップ（Part 2 で実行）

### Step 0: 依存関係の準備
- [ ] `server/package.json` devDependencies に `fast-check`（固定版）を追加し install。

### Step 1: 共通ロール定数・型（common）
- [ ] `server/common/constants/index.ts`: `ROLE_LIST = ['surveyor','admin','viewer'] as const`、`ROLE_NAMES`（dict）、`ROLE_DISPLAY: Record<Role,string>`（調査員/管理者/閲覧者）を追加。
- [ ] `server/common/types/role.ts`（新規）: `Role = (typeof ROLE_LIST)[number]` を定義。
- [ ] `server/common/types/user.ts`: `UserBase` に `roles: Role[]` を追加（`UserDto`/`UserEntity` は継承で反映）。

### Step 2: 共通バリデータ（common/validators）
- [ ] `server/common/validators/role.ts`（新規）: `roleValidator = z.enum(ROLE_LIST)`。
- [ ] `server/common/validators/user.ts`（新規）: `userValidator.assignRolesBody = z.object({ roles: z.array(roleValidator) })`（重複排除はハンドラ/メソッドで実施、空配列許可）。

### Step 3: ドメイン例外
- [ ] `server/service/customAssert.ts`: `ForbiddenError extends CustomError`、`NotFoundError extends CustomError` を追加（fail closed, Q6=A）。

### Step 4: 認可ヘルパー（auth model, 純粋・L2）
- [ ] `server/domain/user/model/authMethod.ts`（新規）:
  - `hasAnyRole(user, allowed): boolean`（any-match, BR-2 / 空ロールは false, BR-1）
  - `hasRole(user, role): boolean`
  - `assertRole(user, allowed): void`（違反→`ForbiddenError`）
  - `assertOwnerOrRole(user, ownerId, allowed): void`（所有者 or 特権ロール, FR-43/BR-4）
  - `isInitialAdmin(identity, initialAdminIdentifiers): boolean`（FU-2/BR-7）

### Step 5: User エンティティ生成・ロール付与（user model）
- [ ] `server/domain/user/model/userMethod.ts`:
  - `create(jwtUser, cognitoUser, initialAdminIdentifiers)`: `roles` を `isInitialAdmin` 判定で `['admin']` or `[]`（BR-7）。
  - `assignRoles(actor, target, nextRoles): UserEntity`: `assertRole(actor,['admin'])`＋自己ロックガード（BR-6）＋重複排除置換。

### Step 6: Store 拡張（user store）
- [ ] `server/domain/user/store/toUserDto.ts`: `roles` をマッピング。
- [ ] `server/domain/user/store/userCommand.ts`: upsert の create/update に `roles` を追加。
- [ ] `server/domain/user/store/userQuery.ts`: `countByRole(tx, role): Promise<number>` を追加（最後の admin 保護用, BR-6）。

### Step 7: UseCase 拡張（user usecase）
- [ ] `server/domain/user/userUseCase.ts`:
  - `findOrCreateUser`: `INITIAL_ADMIN_IDENTIFIERS` を `userMethod.create` に渡す（既存ユーザーの roles は不変, BR-7）。
  - `assignRoles(actor, payload)`: `transaction('RepeatableRead')` 内で `findById`→最後の admin 保護→`assignRoles`→`save`（監査呼出点コメント, NFR-08）。対象不在は `NotFoundError`。

### Step 8: 環境変数（service）
- [ ] `server/service/envValues.ts`: `INITIAL_ADMIN_IDENTIFIERS`（カンマ区切り→`string[]`、既定 `[]`）を追加・export。
- [ ] `server/.env.example`: `INITIAL_ADMIN_IDENTIFIERS=` を追記（ドキュメント）。

### Step 9: API レイヤ（ロール管理エンドポイント, FU-3.3）
- [ ] `server/api/private/users/_userId@string/roles/index.ts`（新規）: `Methods` = `patch`（reqBody `{ roles: Role[] }`, resBody `UserDto`）。
- [ ] `server/api/private/users/_userId@string/roles/controller.ts`（新規）: `defineController`、`validators.body = userValidator.assignRolesBody`、`assertRole(user,['admin'])`（L1 多層）→ `userUseCase.assignRoles(user, { userId, roles })`。
- [ ] 注: 既存 `GET /api/private/me` は `UserDto` を返すため `roles` が自動的に含まれる（変更不要）。ユーザー一覧/検索 API は U6u（UI 併設）へ委譲。

### Step 10: Prisma スキーマ＋マイグレーション
- [ ] `server/prisma/schema.prisma`: `enum Role { surveyor admin viewer }`、`model User { ... roles Role[] @default([]) }` を追加。
- [ ] `server/prisma/seed.ts`: 初期管理者 identifier 一致ユーザーへ `admin` 付与（冪等, 任意経路, BR-7）。
- [ ] マイグレーション作成・適用（`prisma migrate dev`）は**ユーザー確認のうえ**実行（破壊的）。確認が取れない場合は schema 編集のみで停止し、型生成は `prisma generate` で対応。

### Step 11: 業務ロジック単体テスト＋PBT（Q11=A / BR-8）
- [ ] `server/tests/unit/authMethod.test.ts`（新規, サーバ不要の純粋テスト）:
  - 例示: 各ロール×代表 `allowed` の許可/拒否、所有者許可、isInitialAdmin。
  - PBT（fast-check）: INV-1（既定拒否）, INV-2（マトリクス整合）, INV-3（any-match 単調性）, INV-4（所有者許可）。
- [ ] `server/tests/unit/userMethod.test.ts`（新規）: `create` のロール付与（bootstrap 真/偽）、`assignRoles` の自己ロックガード（INV-5 の一部）、重複排除。

### Step 12: API レイヤ統合テスト（カバレッジ 100% 担保）
- [ ] `server/tests/api/private/users.test.ts`（新規, 実サーバ＋DB）:
  - admin による他ユーザーのロール付与成功（PATCH→200, 返却 roles 反映）。
  - 非 admin（surveyor/viewer/空）による PATCH → 403。
  - 自己ロックガード（自分の admin 除去）→ 403。
  - 最後の admin 保護（admin 1名状態で admin 除去）→ 403。
  - バリデーション不正（不正 role 値）→ エラー。
  - 対象ユーザー不在 → 404。
  - `GET /api/private/me` が `roles` を含むこと。
  - ロール準備はテスト内で `prismaClient` により直接更新（admin 化）して用意。

### Step 13: ドキュメント生成（サマリ）
- [ ] `aidlc-docs/construction/U1/code/u1-summary.md`: 変更/新規ファイル一覧、検証結果（typecheck/coverage）、残作業（migrate 実行有無）を記録。

### Step 14: 型・健全性確認
- [ ] `server`: `npm run generate`（prisma/frourio）＋ `tsc --noEmit` = PASS を確認。
- [ ] 可能なら `npm test`（vitest + coverage）を実行（要 DB/Cognito/S3/Inbucket エミュレータ）。実行環境が無い場合はテスト資産生成までとし、Build and Test フェーズで実行。

---

## ストーリー・トレーサビリティ
| ストーリー | 内容 | ステップ |
|---|---|---|
| US-101/102/103 | 認証・ロール別アクセス基盤 | Step 1,4,5,7,9 |
| US-802 | サーバ側認可（機能/オブジェクト） | Step 4,5,11,12 |

## 依存・インターフェイス（後続ユニット向け）
- 公開: `authMethod.{assertRole, assertOwnerOrRole, hasAnyRole, hasRole}`、`Role`/`ROLE_LIST`/`ROLE_DISPLAY`、`UserDto.roles`、`userUseCase.assignRoles`。
- U-Cross: `ForbiddenError`/`NotFoundError` を共通エラーハンドラで 401/403/404 に精緻化、認可失敗の監査記録を接続。
- U2+: リソース操作で `assertOwnerOrRole` を状態に応じて呼び分け（BR-3/BR-4）。

## 安全性・備考
- `prisma migrate`（破壊的）は実行前にユーザー確認。テスト DB は `migrate reset` 前提。
- Brownfield 規約: 既存ファイルは in-place 修正（コピー作成しない）。
- `fast-check` は固定版で追加（サプライチェーン配慮）。
