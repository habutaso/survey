# U6f フロントエンド構成（headless フック/サービス契約）

**ステージ**: CONSTRUCTION → U6f Functional Design
**性質**: U6f は **可視 UI を持たない headless 基盤**。本書は U6u が利用する公開フック/サービスの契約（props/state/相互作用/API 統合点）を定義する。

---

## 1. 公開単位の階層

```text
features/localFirst/
├─ hooks/                       … React 統合（U6u が直接利用）
│   ├─ useLocalDraft            … 単一下書きの読込・自動保存・写真追加
│   ├─ useDraftList             … 下書き一覧（未提出/失敗）
│   ├─ useSyncOnSubmit          … 提出トリガ・同期状態
│   └─ useNetworkStatus         … オンライン/オフライン状態
├─ service/                     … 非 React（組成・テスト・hooks 内部）
│   ├─ syncService              … 3段同期オーケストレーション
│   └─ networkStatus            … ネットワーク監視シングルトン
├─ store/  localDraftStore      … IndexedDB CRUD（暗号封入/開封）
└─ crypto/ draftCrypto + sessionKeyProvider(port)
```

> 状態管理: 既存方針に合わせ軽量に。フック内 `useState`/`useEffect` ＋必要に応じ `jotai`（既存依存）でセッション鍵状態を共有。新規グローバル状態ライブラリは導入しない。

---

## 2. フック契約

### 2.1 `useLocalDraft(draftId?: LocalDraftId)`
単一下書きの編集基盤（U6u のウィザード各ステップが利用）。

- **State（返り値）**
  - `draft: LocalDraft | null` — 復号済み下書き（locked 時は null）
  - `loading: boolean`、`locked: boolean`、`error: string | null`
- **Actions**
  - `create(surveyType, parentSurveyId?): Promise<LocalDraftId>`
  - `update(patch): Promise<void>` — `DraftInput` 部分＋`progress` をマージ自動保存（BR-U6f-5）
  - `addPhoto(file: File, meta): Promise<LocalPhotoId>` — `image/*` 検証（BR-U6f-12）→ 暗号保存
  - `removePhoto(photoId): Promise<void>`、`remove(): Promise<void>`
- **相互作用**: 入力変更（U6u 側でデバウンス）→ `update`。撮影/選択 → `addPhoto`。
- **API 統合点**: なし（提出までサーバ通信しない＝ローカルファースト）。

### 2.2 `useDraftList(filter?)`
未提出/失敗の下書き一覧（U6u の「再開」画面）。

- **State**: `drafts: LocalDraftSummary[]`（id/surveyType/syncState/updatedAt のみ・PII 非含有）、`loading`
- **Actions**: `reload()`
- **API 統合点**: なし。

### 2.3 `useSyncOnSubmit()`
提出と同期状態（U6u の提出ボタン・進捗表示）。

- **State**: `syncing: boolean`、`status(draftId): DraftSyncState`、`lastError(draftId): string | null`
- **Actions**: `submit(draftId): Promise<void>`、`retry(draftId): Promise<void>`
- **相互作用**: 提出ボタン → `submit`（オンラインなら即時 3 段同期、オフラインならキュー登録し復帰時自動）。失敗バナーの「再試行」→ `retry`。
- **API 統合点（syncService 経由）**:
  - `POST /api/private/surveys/submission`（`SubmissionPayload` → `SubmissionResultDto`）
  - `PUT {putUrl}`（S3 presigned・画像バイナリ直送）
  - `POST /api/private/surveys/{surveyId}/photos/confirm`（`{ photoIds }`）

### 2.4 `useNetworkStatus()`
- **State**: `online: boolean`
- **相互作用**: U6u がオフラインバナー表示等に利用。復帰時のキュー再開は U6f 内部で自動。

---

## 3. フォーム検証の責務分担

- **U6f**: 提出ペイロードの整形 `toSubmissionPayload`（区分排他・第2次の parentSurveyId 必須 = BR-U6f-11）、画像 `contentType=image/*`（BR-U6f-12）。
- **U6u**: 各入力フィールドの UI バリデーション（必須/範囲/形式表示）。最終的な境界検証はサーバ（U2 zod / U-Cross BR-9）が行う（多層）。
- 共通の値検証は `common/validators/survey.ts`（`surveyValidator`）を U6u/U6f から再利用可能。

---

## 4. ログアウト連携（Q9=A）

- U6u のログアウト導線は、サインアウト前に `localDraftStore.clearAll()`（必要時）を呼ぶ。
- 呼ばない場合も、セッション終了で鍵が再導出不能となり既存データは復号不能（BR-U6f-4）。

---

## 5. 組成（DI 配線）

```text
sessionKeyProvider（Cognito セッション由来）
        │ inject
        ▼
draftCrypto ── inject ──> localDraftStore ── inject ──> syncService
                                                  ▲ inject
                                          apiClient（aspida）+ s3PutFn（fetch/axios PUT）
networkStatus（singleton）── subscribe ──> syncService.drainQueue
```

- 本番組成は `features/localFirst/compose.ts`（U6f 提供）で既定依存を束ね、フックが利用。
- テストは各ポート（`sessionKeyProvider`/`apiClient`/`s3PutFn`/`networkStatus`）をスタブ注入（velona `depend`）。

---

## 6. U6u への提供インターフェイス要約

| 提供物 | 種別 | U6u 用途 |
|---|---|---|
| `useLocalDraft` | hook | ウィザード各ステップの入力保持・写真追加 |
| `useDraftList` | hook | 下書き再開一覧 |
| `useSyncOnSubmit` | hook | 提出・同期進捗・再試行 |
| `useNetworkStatus` | hook | オフライン表示 |
| `localDraftStore.clearAll` | fn | ログアウト時クリア |
| `toSubmissionPayload` / 型 | util/type | 結果プレビュー・送信整形 |
