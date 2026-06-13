# U1 ドメインエンティティ（Functional Design: 認証・ユーザー/ロール基盤）

技術非依存のドメインモデル定義。型表現は既存 CATAPULT 規約（`XxxBase`/`XxxDto`/`XxxEntity`、Branded ID、zod validators）に準拠。確定した設計判断（Q1=B, Q3=B, Q4=B, Q5=A, FU-1=B, FU-2=A, FU-3=A）を反映。

## 1. ロール（Role）

### 1.1 値（Q5=A: 英語 enum ＋ 表示名マップ）
| 内部値（enum） | 表示名（日本語） | 説明 |
|---|---|---|
| `surveyor` | 調査員 | 調査の作成・入力・提出 |
| `admin` | 管理者 | 承認・確定・全調査の管理・ロール管理 |
| `viewer` | 閲覧者 | 全調査の参照のみ |

- `ROLE_VALUES = ['surveyor', 'admin', 'viewer'] as const`
- `Role = (typeof ROLE_VALUES)[number]`
- `ROLE_DISPLAY: Record<Role, string> = { surveyor: '調査員', admin: '管理者', viewer: '閲覧者' }`
- 配置: `server/common/constants`（値）＋ `server/common/types`（型）。クライアント表示は共通参照。

### 1.2 多重ロール（Q3=B）
- 1ユーザーは **0〜複数** のロールを保有できる（`roles: Role[]`）。
- 認可判定は **「いずれかのロールが許可集合に含まれれば許可」**（any-match）。
- ロールなし（`roles: []`）= 全操作拒否（Q4=B）。

## 2. User エンティティ（既存 `user` ドメインの拡張）

### 2.1 型（拡張点は roles のみ）
```
UserBase = {
  signInName: string
  displayName: string
  email: string
  createdTime: number
  photoUrl: string | undefined
  roles: Role[]            // ★追加（既定 []、Q4=B）
}
UserDto    = UserBase & { id: DtoId['user'] }
UserEntity = UserBase & { id: EntityId['user'] }
```
- 真実の源は **DB**（Q1=B）。Cognito は認証のみで、ロールは claims から導出しない。
- `roles` は Branded ID 同様、Dto/Entity いずれでも同形（値オブジェクトの配列）。

### 2.2 永続化（Prisma, コード生成段階で migrate）
- 案: Prisma `enum Role { surveyor admin viewer }` ＋ `model User { ... roles Role[] @default([]) }`（PostgreSQL 配列）。
- 既定値 `[]` により新規ユーザーは無権限（Q4=B）。
- `toUserDto` は `prismaUser.roles` を `Role[]` としてマッピング。
- ⚠️ `prisma migrate`（破壊的）は Code Generation 段階でユーザー確認のうえ実行（U0 から継続の保留事項）。

## 3. 認証アイデンティティ（既存踏襲）
- `JwtUser`（既存 `service/types`）＝ Cognito クレーム（`sub`, `email`, `cognito:username` 等）。
- 認証は既存 `api/private/hooks` の `jwtVerify` を踏襲（U1 で変更なし）。
- `sub` を `User.id`（Branded `EntityId['user']`）に対応させる既存方針を維持。

## 4. 初期管理者設定（Bootstrap, FU-2=A）
- 設定値 `INITIAL_ADMIN_IDENTIFIERS`（環境変数, カンマ区切りの `email` または `signInName` の集合）。
- ドメイン値オブジェクト `BootstrapConfig = { initialAdminIdentifiers: string[] }`。
- 判定 `isInitialAdmin(identity: { email; signInName }, config): boolean`（純粋関数）。
- 付与タイミング: `findOrCreateUser` の新規作成時、および seed 実行時（§ business-logic-model 参照）。

## 5. ロール管理操作の入力（FU-3）
- `AssignRolesPayload = { userId: DtoId['user']; roles: Role[] }`（roles 配列を置換）。
- 検証 validator: `userValidator.assignRolesBody`（`roles` は `Role` の重複なし集合、空配列も許可）。

## 6. エンティティ関連図（概念）
```
[CognitoClaims/JwtUser] --authn--> [User(roles: Role[])] --authz--> [Survey 等リソース(U2+)]
                                        ^
                                        | BootstrapConfig(初期admin付与)
                                        | AssignRoles(admin による変更, 自己ロックガード)
```
- User は本ユニットの中核エンティティ。Survey 等のリソース所有/参照認可は U2 以降で User.roles ＋ 所有権により判定（FR-43）。
