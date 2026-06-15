# U6f ビジネスロジックモデル（ローカルファースト基盤 / headless）

**ステージ**: CONSTRUCTION → U6f Functional Design
**設計判断**: 計画 Q1〜Q9＝すべて A

> headless 基盤の振る舞いを定義する。UI（U6u）は本基盤の公開フック/サービスを呼ぶだけで、暗号・永続化・同期の詳細を意識しない。

---

## 1. モジュール構成（実装マップ・予定）

```text
client/features/localFirst/
├── model/
│   ├── localDraft.ts        # LocalDraft 純粋ロジック（生成・更新・toSubmissionPayload）
│   ├── localPhoto.ts        # LocalPhoto 純粋ロジック（toPhotoMeta・状態遷移）
│   ├── syncJob.ts           # SyncJob 純粋ロジック（段階遷移・バックオフ算出）
│   └── backoff.ts           # 指数バックオフ算出（純粋）
├── crypto/
│   └── draftCrypto.ts       # Web Crypto AES-GCM ラッパ（encrypt/decrypt/deriveKey）+ sessionKeyProvider ポート
├── store/
│   └── localDraftStore.ts   # idb ラッパ（drafts/photos/syncQueue/meta CRUD・暗号封筒の封入/開封）
├── service/
│   ├── syncService.ts       # 提出時3段オーケストレーション（velona DI）
│   └── networkStatus.ts     # navigator.onLine + online/offline 監視
└── hooks/
    ├── useLocalDraft.ts      # 下書き CRUD/自動保存フック（U6u 利用）
    ├── useSyncOnSubmit.ts    # 提出トリガ＋同期状態フック（U6u 利用）
    └── useNetworkStatus.ts   # オンライン状態フック
```

- **純粋ロジック**（`model/`・`crypto` の変換部・`backoff`）は副作用なし＝100% カバレッジ対象（Q8=A）。
- **副作用境界**（IndexedDB・Web Crypto・fetch・`navigator`）は store/service/crypto に隔離し、velona `depend` でテスト時にスタブ注入。

---

## 2. 暗号ロジック（`draftCrypto` / BR-11・SECURITY-01）

### 2.1 鍵導出（`deriveKey` / Q2=A）
```text
deriveKey(keyMaterial: ArrayBuffer, salt: Uint8Array): Promise<CryptoKey>
  1. importKey(keyMaterial) を HKDF ベースキーとして取り込む
  2. AES-GCM 256 を deriveKey（info ラベル固定・salt 適用）
  3. 返す CryptoKey は extractable=false（メモリのみ・取り出し不可）
```
- `keyMaterial` は `sessionKeyProvider.getKeyMaterial()`（ポート）が返すセッション由来の秘匿バイト列。
  - **契約**: セッション有効中は安定（同一値を返す）／ログアウト後は取得不能（reject）。
  - 既定バインドは U6u/組成で注入（Cognito セッション由来）。U6f はポート契約のみ定義し、テストはスタブを注入。
- `salt` は初回ランダム生成し `meta` store に永続化（再読込後も同一鍵を再導出。salt は非機微）。

### 2.2 暗号化 / 復号
```text
encryptJson(key, value): EncryptedRecord
  iv = randomBytes(12); ct = AES-GCM.encrypt(key, iv, utf8(JSON.stringify(value)))
  → { v:1, iv, ciphertext: ct }

decryptJson<T>(key, rec): T
  pt = AES-GCM.decrypt(key, rec.iv, rec.ciphertext) → JSON.parse(utf8(pt))

encryptBlob(key, blob): EncryptedRecord   // 画像（Blob→ArrayBuffer）
decryptBlob(key, rec, contentType): Blob
```
- IV はレコード毎に `crypto.getRandomValues` で新規生成（BR-11 / INV-U6f-1）。
- 復号失敗（鍵不一致・改ざん）は例外 → 呼び出し側で「復号不能」として扱う（BR-U6f-9）。

---

## 3. 下書きライフサイクル（`localDraft` + `localDraftStore` / US-204）

```text
[新規作成] createDraft(surveyType, parentSurveyId?)
   → LocalDraft{ syncState:'editing', input:{}, progress:初期, photoIds:[] } を drafts に封入保存

[自動保存] updateDraft(id, patch)         # U6u の入力変更ごと（デバウンスは U6u）
   → input/progress をマージ → updatedAt 更新 → 暗号封入して上書き保存

[復元] getDraft(id) / listDrafts()        # 再読込・端末スリープ跨ぎ（FR-18）
   → drafts から読込 → enc を開封（復号）して LocalDraft を返す
   → 鍵 locked のときは listDrafts はメタのみ（input は null マスク, BR-U6f-9）

[列挙] listDrafts(filter?)                 # 自分の未提出/失敗下書き一覧（U6u）
[削除] deleteDraft(id)                     # 明示破棄 or 同期成功後の自動消去
```

状態遷移（`DraftSyncState`）:
```text
editing ──(提出)──> queued ──(処理開始)──> syncing ──(全段成功)──> synced ──(消去)──> [削除]
   ^                                           │
   └───────────────(失敗・上限到達)────────────┘ failed → (手動再試行) → queued
```

---

## 4. 提出時一括同期オーケストレーション（`syncService` / Q4=A・US-207・FR-19）

3 段を冪等・段階再開可能に実行。各段は `SyncJob.stage` で再開点を管理。

```text
submit(draftId):
  1. draft = getDraft(draftId)（復号）
  2. payload = toSubmissionPayload(draft)         # PII 含む・U2 契約へ整形
  3. job = SyncJob{ stage:'submission', attempts:0 } を syncQueue に永続化
  4. draft.syncState = 'queued' で保存
  5. processJob(job)（オンラインなら即時 / オフラインなら復帰時）

processJob(job):  # 各段は前段の完了を前提に冪等再実行可
  ┌ stage=submission:
  │   res = POST /api/private/surveys/submission (payload)   # SubmissionResultDto
  │   job.uploadTickets = res.photoUploadTickets
  │   job.stage = 'photos-put'; 保存
  ├ stage=photos-put:
  │   for each ticket(photoId,putUrl) 未送信:
  │       blob = decrypt(localPhoto by 突合)               # serverPhotoId 突合 or 順序対応
  │       PUT putUrl (blob, contentType)                    # S3 直アップロード
  │       localPhoto.status='uploaded'; serverPhotoId=photoId 保存
  │   job.stage = 'confirm'; 保存
  ├ stage=confirm:
  │   photoIds = uploaded 済みの serverPhotoId 群
  │   POST /api/private/surveys/{surveyId}/photos/confirm { photoIds }  # 冪等
  │   job.confirmedPhotoIds = photoIds; job.stage='done'; 保存
  └ stage=done:
      draft.syncState='synced'
      purgeLocal(draftId)   # FR-19: PII（draft）+ 画像（photos）を消去
      job 削除
```

- **成功確認後消去（FR-19 / SECURITY-01）**: `stage='done'` 到達まではローカルを保持。途中失敗では消去しない（喪失防止 / BR-U6f-6）。
- **写真ゼロ**: `photos-put`/`confirm` は no-op で `done` へ。
- **冪等性**: submission は同一 ULID 再送をサーバが upsert（U2 BR-15）。confirm は pending→uploaded 冪等（U4）。PUT は同一キー上書き。途中再開で二重実行されても安全。

---

## 5. 再試行・キュー・ネットワーク監視

### 5.1 バックオフ（`backoff` / Q6=A）
```text
nextDelayMs(attempts):  # 指数バックオフ + 上限
  base=1000ms, factor=2, cap=30000ms, jitter=±20%
  delay = min(cap, base * 2^attempts) * (1 ± jitter)
maxAttempts = 5
```
- 失敗時: `attempts++`、`nextAttemptAt = now + nextDelayMs(attempts)`、`stage` は据置（段階再開）。
- `attempts >= maxAttempts`: `draft.syncState='failed'`、`lastError` 設定、自動再試行停止 → 手動 `retry(draftId)` で `attempts=0` リセットし再投入（BR-U6f-7）。

### 5.2 ネットワーク監視（`networkStatus` / Q7=A）
```text
networkStatus.subscribe(cb):  navigator.onLine 初期値 + 'online'/'offline' イベント購読
on 'online':  due な SyncJob（nextAttemptAt<=now）を順次 processJob
```
- オフライン時に `submit` された job は `syncQueue` に残り、オンライン復帰で自動再開（Q5=A）。

### 5.3 キュー処理ドライバ
```text
drainQueue():  # オンライン時・復帰時・アプリ起動時に起動
  jobs = syncQueue where stage!='done' and nextAttemptAt<=now, by nextAttemptAt
  for job: processJob(job)（直列・1件ずつ・例外は捕捉して次へ）
```

---

## 6. 公開フック/サービス契約（U6u 利用 / §8 計画）

```ts
// 下書き（US-204）
useLocalDraft(draftId?): {
  draft: LocalDraft | null;
  loading: boolean;
  locked: boolean;                       // 鍵未導出
  create(surveyType, parentSurveyId?): Promise<LocalDraftId>;
  update(patch: Partial<DraftInput> & { progress?: DraftProgress }): Promise<void>;
  addPhoto(file: File, meta: { part?: string; step?: string }): Promise<LocalPhotoId>;
  removePhoto(photoId: LocalPhotoId): Promise<void>;
  remove(): Promise<void>;
};

useDraftList(filter?): { drafts: LocalDraftSummary[]; loading: boolean; reload(): void };

// 提出同期（US-207）
useSyncOnSubmit(): {
  submit(draftId): Promise<void>;
  retry(draftId): Promise<void>;
  status(draftId): DraftSyncState;
  syncing: boolean;
};

useNetworkStatus(): { online: boolean };

// 非フック（サービス層・組成/テスト用）
syncService:      { submit; retry; drainQueue; processJob }     // velona depend
localDraftStore:  { open; getDraft; listDrafts; putDraft; deleteDraft; putPhoto; getPhoto; listPhotos; deletePhoto; enqueue; listJobs; putJob; deleteJob; purgeLocal; clearAll }
draftCrypto:      { deriveKey; encryptJson; decryptJson; encryptBlob; decryptBlob }
networkStatus:    { online; subscribe }
sessionKeyProvider: { getKeyMaterial(): Promise<ArrayBuffer> }  // ポート（組成で注入）
```

- `clearAll()`（全 store 物理削除）は U6u のログアウト導線が呼ぶ（Q9=A）。U6f はクリア手段を提供。

---

## 7. データフロー図

```text
 U6u (UI)
   │ create/update/addPhoto                 submit/retry
   ▼                                          ▼
 useLocalDraft ─────► localDraftStore ◄──── useSyncOnSubmit ─► syncService
                          │  ▲                                    │
            encrypt/decrypt│  │封入/開封                          │ 3段
                          ▼  │                                    ▼
                      draftCrypto ◄─ key ─ DraftKeyState     ┌───────────────┐
                          ▲                  ▲               │ POST submission│─► U2 API
            getKeyMaterial│                  │re-derive      │ PUT presigned  │─► S3
                  sessionKeyProvider     (reload/session)    │ POST confirm   │─► U4 API
                          │                                  └───────────────┘
                  Cognito session                                  │ done
                                                                    ▼
                                                            purgeLocal (FR-19)
            IndexedDB(survey-local): drafts / photos / syncQueue / meta
            networkStatus(navigator.onLine) ─► drainQueue on 'online'
```

---

## 8. テスト戦略（Q8=A / PBT Full enforcement）

- 実行環境: `fake-indexeddb`（IndexedDB エミュレート）＋ Node `webcrypto`（`globalThis.crypto`）。
- **PBT（fast-check）**: 暗号往復（`decryptJson(deriveKey, encryptJson(v)) === v`・任意 JSON / 任意バイナリ）= INV-U6f-1/8。IV 一意性（連続 encrypt の iv が衝突しない）。
- **単体**: `localDraft`/`localPhoto`/`syncJob`/`backoff` 純粋ロジック、`syncService` の 3 段オーケストレーション（fetch/PUT/store をスタブ注入し各段の冪等・段階再開・失敗バックオフ・done 後 purge を検証）、`localDraftStore`（fake-indexeddb で CRUD＋封入/開封）、`networkStatus`（イベント発火スタブ）。
- カバレッジ: client に vitest coverage を導入し、`features/localFirst/{model,crypto,store,service}/**` に 100% を課す。React フック（hooks/**）は U6u の結合で扱い coverage include 対象外。
