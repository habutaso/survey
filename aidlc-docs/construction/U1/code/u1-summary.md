# U1 コード生成サマリ（認証・ユーザー/ロール基盤）

- **ユニット**: U1 — 認証・ユーザー/ロール基盤
- **担当ストーリー**: US-101, US-102, US-103, US-802
- **実行日時**: 2026-06-13T22:40+09:00
- **計画**: `aidlc-docs/construction/plans/U1-code-generation-plan.md`（Steps 0–14）
- **確定判断**: Q1=B, Q3=B, Q4=B, Q5=A, Q6=A, Q7=A, Q8=B, Q9=B/FU-1=B, FU-2=A, FU-3=A, Q11=A
- **再開時確認の回答**: Q-RESUME-1=A（計画承認）, Q-RESUME-2=A（fast-check 固定追加）, Q-RESUME-3=A（prisma migrate dev 実行）

## 実装概要
DB を真実の源とするロール（surveyor / admin / viewer、複数可）と、2 層防御（L1 API hooks/controller ＋ L2 ドメイン Model `assert*`）の認可基盤を構築。初期管理者ブートストラップ（環境変数）と admin 限定のロール管理 API（自己ロック・最後の admin 保護つき）を追加。

## 新規ファイル
| ファイル | 内容 |
|---|---|
| `server/common/types/role.ts` | `Role` 型（`ROLE_LIST` 駆動） |
| `server/common/validators/role.ts` | `roleValidator = z.enum(ROLE_LIST)` |
| `server/common/validators/user.ts` | `userValidator.assignRolesBody`（roles 配列） |
| `server/domain/user/model/authMethod.ts` | `hasAnyRole/hasRole/assertRole/assertOwnerOrRole/isInitialAdmin`（純粋・L2） |
| `server/api/private/users/index.ts` | 中間パスノード（空 Methods） |
| `server/api/private/users/_userId@string/index.ts` | 中間パスノード（空 Methods） |
| `server/api/private/users/_userId@string/validators.ts` | パスパラメータ検証（`params: { userId: string }`） |
| `server/api/private/users/_userId@string/roles/index.ts` | `PATCH` Methods（reqBody `{ roles }` / resBody `UserDto`） |
| `server/api/private/users/_userId@string/roles/controller.ts` | L1 で `assertRole(admin)` → `userUseCase.assignRoles` |
| `server/prisma/migrations/20260613132539_add_user_roles/migration.sql` | `Role` enum ＋ `User.roles`（＋デモ Task 削除・displayName NOT NULL） |
| `server/tests/unit/authMethod.test.ts` | 単体＋PBT（INV-1〜4） |
| `server/tests/unit/userMethod.test.ts` | 単体（bootstrap/assignRoles/自己ロック/重複排除） |
| `server/tests/api/private/users.test.ts` | ロール管理 API 統合テスト（7 ケース） |

## 変更ファイル
| ファイル | 変更点 |
|---|---|
| `server/package.json` | devDependencies に `fast-check@3.23.2`（固定版）追加 |
| `server/common/constants/index.ts` | `ROLE_LIST` / `ROLE_NAMES` / `ROLE_DISPLAY`（日本語表示名）追加 |
| `server/common/types/user.ts` | `UserBase.roles: Role[]` 追加 |
| `server/service/customAssert.ts` | `ForbiddenError` / `NotFoundError`（`CustomError` 継承）追加 |
| `server/domain/user/model/userMethod.ts` | `create` に bootstrap ロール判定、`assignRoles`（自己ロックガード・重複排除）追加 |
| `server/domain/user/store/toUserDto.ts` | `roles` マッピング |
| `server/domain/user/store/userCommand.ts` | upsert create/update に `roles` 追加 |
| `server/domain/user/store/userQuery.ts` | `countByRole`（最後の admin 保護用）追加 |
| `server/domain/user/userUseCase.ts` | `findOrCreateUser` が初期管理者識別子を渡す、`assignRoles`（トランザクション＋NotFound＋最後の admin 保護） |
| `server/service/envValues.ts` | `INITIAL_ADMIN_IDENTIFIERS`（カンマ区切り→`string[]`）追加 |
| `server/.env.example` | `INITIAL_ADMIN_IDENTIFIERS=` 追記 |
| `server/prisma/schema.prisma` | `enum Role` ＋ `User.roles Role[] @default([])` |
| `server/prisma/seed.ts` | `assignInitialAdmins`（identifier 一致ユーザーへ admin 冪等付与） |

> 生成物（`.gitignore` 済・再生成対象）: `$server.ts` / 各 `$relay.ts` / `$api.ts` を frourio＋aspida で更新。
> 注意: `npm run generate`（= prisma + frourio）は `$api.ts`（aspida クライアント）を再生成しないため、クライアント型の再生成には別途 `npx aspida` が必要（dev では `frourio --watch` 経由）。

## ビジネスルール対応
- BR-1（既定拒否）/ BR-2（any-match）: `authMethod.hasAnyRole`、無ロール＝全拒否。
- BR-4（オブジェクト認可）: `assertOwnerOrRole`（所有者 or 特権ロール）。U2 で状態別 allowed を呼び分け。
- BR-5（fail closed）: `assert*` は `ForbiddenError` → 共通ハンドラで現状 HTTP 403。
- BR-6（ロール管理）: admin 限定（L1+L2）、自己ロックガード、最後の admin 保護、roles 置換＋重複排除。
- BR-7（bootstrap）: 新規作成時のみ `isInitialAdmin` で admin 付与。既存ユーザーの roles は不変。seed でも冪等付与。
- BR-8（PBT 不変条件）: INV-1（既定拒否）/ INV-2（マトリクス整合）/ INV-3（any-match 単調性）/ INV-4（所有者許可）を fast-check で検証。INV-5（最後の admin 保護）は API テストで検証。

## 検証結果
- **型チェック**: `npx tsc --noEmit` = **PASS（0 errors）**。
- **テスト**: `npm test`（vitest + coverage）= **34 tests passed / 5 files**。
  - 内訳: unit/authMethod（16）, unit/userMethod（6）, api/private/users（7）, 既存 api/private（2）, 既存 public（3）。
- **カバレッジ**: 対象（`api/**/{controller,hooks,validators}.ts`, `common/**`, `domain/**`）で **statements/branches/functions/lines = 100%**。
- **マイグレーション**: `20260613132539_add_user_roles` を `prisma migrate dev` で**作成・適用済み**（`Role` enum、`User.roles Role[] @default([])`、加えて U0 で保留していたデモ `Task` テーブル削除と `displayName` NOT NULL 化を反映）。
- **エミュレータ**: API テストは docker compose（postgres / magnito / minio / inbucket）で実行。

## 後続ユニットへの公開インターフェイス
- `authMethod.{assertRole, assertOwnerOrRole, hasAnyRole, hasRole}`
- `Role` / `ROLE_LIST` / `ROLE_NAMES` / `ROLE_DISPLAY`、`UserDto.roles`
- `userUseCase.assignRoles(actor, { userId, roles })`
- `ForbiddenError` / `NotFoundError`（U-Cross で 401/403/404 マッピングを精緻化）

## 残作業 / 申し送り（U-Cross 以降）
- **エラー→HTTP の精緻化**: 現状の共通ハンドラは「非GET 例外→403 / GET 例外→404」。U1 の `NotFoundError`（対象不在）も PATCH では 403 になる。U-Cross で `NotFoundError`→404、認証失敗→401 を整理する（API テストの該当ケースに「U-Cross で 404」コメント済み）。
- **監査記録**: `assignRoles` に監査呼出点コメントを設置済み。記録実体は U-Cross（NFR-08 / SECURITY-13）で接続。
- **ユーザー一覧/検索 API**: 管理 UI 併設で U6u にて追加予定（中間パスノードは設置済み）。
- **オブジェクト認可の状態別呼び分け**: `assertOwnerOrRole` の allowed を「下書き＝surveyor/admin、提出後＝admin」で呼び分けるのは U2（Survey 集約）。
- **ローカル環境**: 実行のため `client/.env` / `server/.env`（gitignore 済）を例から生成、docker compose を起動。disk 逼迫時は `npm cache clean --force` で回避した。
