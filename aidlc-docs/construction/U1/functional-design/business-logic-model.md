# U1 ビジネスロジックモデル（Functional Design: 認証・ユーザー/ロール基盤）

ロール解決・認可・ロール管理のビジネスロジック（技術非依存）。副作用は Store/Service/UseCase 境界に限定し、Model 層は純粋関数（既存 DDD ガイドライン準拠）。多層防御（AD6=A）: L1=`api/private/hooks`、L2=Model 層 `assert*`。

凡例: `tx: Prisma.TransactionClient`、`actor: UserDto`（操作者）。

---

## 1. 認可ヘルパー（`auth` model, 純粋・L2）

### `hasAnyRole(user: UserDto, allowed: Role[]): boolean`
- `user.roles` と `allowed` の積集合が非空なら true（Q3=B any-match）。
- `user.roles` が空なら常に false（Q4=B 既定拒否）。

### `assertRole(user: UserDto, allowed: Role[]): void`
- `hasAnyRole(user, allowed)` が false なら **`ForbiddenError`（ドメイン例外）** を投げる（Q6=A, fail closed）。
- 機能レベル認可（例: 承認・確定・ロール管理は `['admin']`）。

### `assertOwnerOrRole(user: UserDto, ownerId: DtoId['user'], allowed: Role[]): void`
- 次のいずれかで許可、いずれも不成立なら `ForbiddenError`:
  1. `user.id === ownerId`（所有者本人）、または
  2. `hasAnyRole(user, allowed)`（特権ロール）。
- オブジェクトレベル認可（FR-43）。Q8=B の「下書き相互編集」は U2 で「対象が下書き状態なら `allowed=['surveyor','admin']`、提出後は `['admin']`」のように呼び分けて実現（U1 はヘルパーの意味を確定）。

### `hasRole(user, role): boolean`（補助）
- 単一ロール保有判定。UI 表示分岐等の補助に使用（認可の最終判定は assert* で行う）。

> **失敗時の扱い（Q6=A）**: `assert*` は `ForbiddenError` を投げ、共通エラーハンドラ（U-Cross で整備）が **403** へ変換。詳細・PII は秘匿（fail closed）。U1 ではドメイン例外型と投出箇所を定義し、ハンドラ接続は U-Cross で行う。

---

## 2. ロール解決（DB が真実の源, Q1=B）

ロールは claims から導出せず、**DB の `User.roles`** を使用。`api/private/hooks` で注入される `req.user`（= `findOrCreateUser` の戻り）が `roles` を保持し、以降の認可はこれを参照する。

---

## 3. 初期管理者ブートストラップ（FU-2=A）

### `isInitialAdmin(identity, config): boolean`（model 純粋）
- `config.initialAdminIdentifiers` に `identity.email` または `identity.signInName` が含まれれば true。

### `userMethod.create(jwtUser, cognitoUser, config): UserEntity`（既存拡張）
- 既存の属性マッピングに加え、`roles` を決定:
  - `isInitialAdmin({ email, signInName }, config)` → `['admin']`
  - それ以外 → `[]`（Q4=B 既定無権限）。

### `userUseCase.findOrCreateUser`（既存拡張, UseCase 境界）
- 既存ユーザー: DB の `roles` をそのまま返す（**ブートストラップ判定は新規作成時のみ**、既存ユーザーの roles は上書きしない）。
- 新規ユーザー: `userMethod.create(..., bootstrapConfig)` で roles を決定し保存。

### seed（`server/prisma/seed.ts`, 任意の補助経路）
- 初期管理者 identifier に一致する既存 User があれば `admin` を付与（冪等）。アプリ起動前の運用補助。

---

## 4. ロール管理（FU-3, admin 限定 + 自己ロックガード）

### `userMethod.assignRoles(actor, target, nextRoles): UserEntity`（model 純粋）
1. `assertRole(actor, ['admin'])`（操作者は admin のみ, FU-3.1）。
2. **自己ロックガード（FU-3.2, fail-safe）**:
   - `actor.id === target.id` かつ `nextRoles` に `admin` が含まれない → `ForbiddenError`（自分の admin を外せない）。
3. `nextRoles` を重複排除した集合として `target.roles` を置換。
4. 更新後の `UserEntity` を返す（永続化は Store）。

### `userUseCase.assignRoles(actor, payload)`（UseCase 境界, トランザクション）
- `transaction('RepeatableRead', tx => ...)`:
  1. `target = userQuery.findById(tx, payload.userId)`。
  2. **最後の admin 保護（FU-3.2）**: 変更により admin が 0 人になる場合は `ForbiddenError`。
     - `target` が現在 admin かつ `payload.roles` に admin なし、かつ `userQuery.countByRole(tx, 'admin') === 1` → 拒否。
  3. `entity = userMethod.assignRoles(actor, target, payload.roles)`。
  4. `userCommand.save(tx, entity)` ＋ 監査記録（実施者・対象・前後 roles・日時。記録実体は U-Cross、U1 は呼出ポイントを定義）。
- 戻り: 更新後 `UserDto`。

---

## 5. Store メソッド（`user` store 拡張）
- `userQuery.findById(tx, id): Promise<UserDto>`（既存。`roles` 込みで返すよう `toUserDto` 拡張）。
- `userQuery.countByRole(tx, role: Role): Promise<number>`（★追加。最後の admin 保護用）。
- `userCommand.save(tx, entity): Promise<UserDto>`（既存。`roles` を upsert 対象に追加）。

---

## 6. API レイヤ（プレゼンテーション, L1）
- 認証 hooks（既存 `api/private/hooks`）: `req.user`（roles 込み）注入。変更は roles を含む点のみ。
- **ロール管理エンドポイント（FU-3.3）**: `PATCH /api/private/users/_userId@string/roles`
  - body: `AssignRolesPayload.roles`（validator 適用, SECURITY-05）。
  - controller → `userUseCase.assignRoles(req.user, { userId, roles })`。
  - L1 でも `assertRole(req.user, ['admin'])` を適用（多層防御）。
- （補助）`GET /api/private/users` 一覧: admin のみ（ロール管理 UI 用, U6u）。U1 では最小限 `assignRoles` を必須とし、一覧は U6u で UI と合わせ追加してよい。

---

## 7. データフロー要約
```
[ログイン(既存Cognito)] → hooks.jwtVerify → findOrCreateUser
   ├ 新規: create(+bootstrap判定) → save(roles)
   └ 既存: findById(roles) 返却
→ req.user(roles) を以降の usecase/model で assert* により認可判定（L1+L2）

[ロール変更] admin → PATCH /users/:id/roles → assignRoles
   → assertRole(admin) → 自己ロック/最後のadmin ガード → save + 監査
```
