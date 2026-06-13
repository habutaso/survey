# API Documentation

ベースパス: `/api`（`NEXT_PUBLIC_API_BASE_PATH`）。frourio によるファイルベースルーティング。
認証は `private/` 配下で Cookie の idToken を検証（HttpOnly, Secure, SameSite=strict）。
注: GET 以外のエラーは 403、GET は 404 を返すエラーハンドラ設定（`service/app.ts`）。認証失敗時は 401。

## REST/RPC APIs

### Health Check
- **Method**: GET
- **Path**: `/api/health`
- **Purpose**: DB / S3 / Cognito の死活確認。
- **Request**: なし
- **Response**: `"ok"`（いずれか失敗時は CustomError メッセージ）

### Session 作成
- **Method**: POST
- **Path**: `/api/session`
- **Purpose**: idToken/accessToken を HttpOnly Cookie に設定。
- **Request**: `{ idToken: string, accessToken: string }`
- **Response**: `{ status: 'success' }`（Cookie 有効期限は idToken の exp）

### Session 削除
- **Method**: DELETE
- **Path**: `/api/session`
- **Purpose**: 認証 Cookie をクリア（ログアウト）。
- **Request**: なし
- **Response**: `{ status: 'success' }`

### 自分の情報取得
- **Method**: GET
- **Path**: `/api/private/me`
- **Purpose**: ログインユーザー (UserDto) を取得。
- **Request**: なし（Cookie 認証）
- **Response**: `UserDto`

### メールアドレス確認
- **Method**: POST
- **Path**: `/api/private/me/email`
- **Purpose**: 検証コードで Cognito のメール属性を確定し DB に反映。
- **Request**: `{ code: string }`
- **Response**: `UserDto`

### タスク一覧取得
- **Method**: GET
- **Path**: `/api/private/tasks`
- **Purpose**: ログインユーザーのタスクを作成日時降順で取得。
- **Request**: query `{ limit?: number }`
- **Response**: `TaskDto[]`

### タスク作成
- **Method**: POST
- **Path**: `/api/private/tasks`
- **Purpose**: タスク作成（任意の画像添付）。
- **Request**: multipart `{ label: string(1..20), image?: File }`
- **Response**: `TaskDto`

### タスク更新（一覧コントローラ）
- **Method**: PATCH
- **Path**: `/api/private/tasks`
- **Purpose**: 完了状態の更新。
- **Request**: `{ taskId: MaybeId['task'], done: boolean }`
- **Response**: `TaskDto`

### タスク削除（一覧コントローラ）
- **Method**: DELETE
- **Path**: `/api/private/tasks`
- **Purpose**: タスク削除。
- **Request**: `{ taskId: MaybeId['task'] }`
- **Response**: `TaskDto`

### 個別タスク更新
- **Method**: PATCH
- **Path**: `/api/private/tasks/:taskId`
- **Purpose**: 指定タスクの完了状態更新。
- **Request**: params `taskId`, body `{ done: boolean }`
- **Response**: `TaskDto`

### 個別タスク削除
- **Method**: DELETE
- **Path**: `/api/private/tasks/:taskId`
- **Purpose**: 指定タスクの削除。
- **Request**: params `taskId`
- **Response**: `TaskDto`

## Internal APIs (ドメイン)

### userUseCase
- **findOrCreateUser(jwtUser, accessToken): Promise<UserDto>** — DB に存在すれば返却、なければ Cognito 属性から作成。
- **confirmEmail(user, accessToken, code): Promise<UserDto>** — メール検証 → DB 反映。

### taskUseCase
- **create(user, payload): Promise<TaskDto>**
- **update(user, body): Promise<TaskDto>**
- **delete(user, body): Promise<TaskDto>**

### taskQuery / taskCommand
- **listByAuthorId(tx, user, query?)**, **findById(tx, user, taskId)**
- **save(tx, user, entity, image?)**, **delete(tx, user, entity)**

## Data Models

### User
- **Fields**: id(String, PK), email, signInName, displayName, photoUrl?(String), createdAt(DateTime)
- **Relationships**: tasks: Task[]
- **Validation**: id は Branded ID。

### Task
- **Fields**: id(String, PK), label, done(Boolean), imageKey?(String), createdAt(DateTime), authorId(FK→User)
- **Relationships**: Author: User
- **Validation**: label 1〜20文字。操作は作成者本人のみ（taskMethod の assert）。

### DTO 表現
- **UserDto**: id(DtoId['user']), email, signInName, displayName, photoUrl?, createdTime(number)
- **TaskDto**: id(DtoId['task']), label, done, createdTime(number), author{id, signInName}, image?{ url, s3Key }
