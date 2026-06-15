# U6f ドメインエンティティ（ローカルファースト基盤 / headless）

**ステージ**: CONSTRUCTION → U6f Functional Design
**担当ストーリー**: US-204（下書き保存・再開）/ US-207（オフライン入力と提出時同期, クライアント側）
**関連要件**: FR-18・FR-19 / NFR-02 / SECURITY-01
**設計判断**: 計画 `construction/plans/U6f-functional-design-plan.md`（Q1〜Q9 すべて A）

> 本ユニットは **headless 基盤**（IndexedDB store / 暗号ラッパ / 同期サービス / フック）。可視 UI は U6u。
> ドメインは技術非依存に近いが、クライアント実行環境（ブラウザ Web Crypto / IndexedDB）に固有の概念を含む。

---

## 1. エンティティ一覧

| エンティティ | 役割 | 永続化先（store） | 暗号化 |
|---|---|---|---|
| `LocalDraft` | 調査入力内容＋進捗＋メタ（再開可能な下書き） | `drafts` | ペイロード（直列化 JSON）を暗号化（Q3=A） |
| `LocalPhoto` | 撮影画像バイナリ＋メタ（提出前のローカル保持） | `photos` | Blob 本体を個別暗号化（Q3=A） |
| `SyncJob` | 提出時一括同期のキュー要素（再試行状態を含む） | `syncQueue` | 機微なし（draftId 参照のみ・PII 非保持） |
| `EncryptedRecord` | 暗号化封筒（iv + ciphertext）。上記の保存表現 | （各 store の値の形） | — |
| `DraftKeyState` | セッション派生鍵の状態（メモリのみ） | 永続化しない | — |

---

## 2. `LocalDraft`

再開可能な調査下書き。1 件の調査（第1次 or 第2次）に対応。`SubmissionPayload`（U2 契約）へ変換可能な入力を保持する。

```ts
// ドメイン表現（複合・平文。メモリ内でのみ平文として存在）
export type LocalDraftId = string; // = SubmissionPayload.survey.id（クライアント採番 ULID）

export type DraftSyncState = 'editing' | 'queued' | 'syncing' | 'synced' | 'failed';

export type LocalDraft = {
  id: LocalDraftId;             // survey.id（ULID, クライアント採番）
  surveyType: 'first' | 'second';
  // 提出ペイロードの素材（U2 SubmissionPayload に整形可能な入力）。
  input: DraftInput;            // §2.1
  // 進捗（U6u のウィザード復元用, US-204）。
  progress: DraftProgress;      // §2.2
  // ローカル写真の参照（実体は LocalPhoto / photos store）。
  photoIds: LocalPhotoId[];
  // 同期状態（FR-19）。
  syncState: DraftSyncState;
  lastError: string | null;     // 直近同期失敗の安全なメッセージ（秘匿済み）
  // メタ。
  createdAt: number;            // epoch ms
  updatedAt: number;            // epoch ms（自動保存ごとに更新）
};
```

### 2.1 `DraftInput`
`SubmissionPayload`（`common/types/survey.ts`）の素材。提出時に `toSubmissionPayload(draft)` で確定形へ変換する。下書き中は全フィールド任意（部分入力を許容）。

```ts
export type DraftInput = {
  survey: Partial<{
    address: string; houseNumber: string; structureType: StructureType;
    buildingName: string; floors: number;
    victimName: string; victimContact: string; victimAddress: string; // PII
    latitude: number; longitude: number;
    parentSurveyId: DtoId['survey'];
  }>;
  firstSurvey?: Partial<{
    externalForceFlags: ExternalForceFlags;
    tiltRatio: number; inundationDepthCm: number;
    floorApportionment: FloorRatio[];
  }>;
  secondSurvey?: Partial<{
    partDamages: PartDamage[];
    floorApportionment: FloorRatio[];
  }>;
};
```

### 2.2 `DraftProgress`
ウィザード再開用の進捗（U6u が解釈、U6f は不透明に保持・復元）。

```ts
export type DraftProgress = {
  currentStep: string;          // U6u のステップキー（U6f は値を解釈しない）
  completedSteps: string[];
  updatedAt: number;
};
```

---

## 3. `LocalPhoto`

提出前にローカル保持する撮影画像。実体（Blob）は暗号化して保存し、同期成功確認後に消去（FR-19 / SECURITY-01）。

```ts
export type LocalPhotoId = string; // クライアント採番 ULID（ローカル一意。サーバ photoId とは別）

export type LocalPhotoStatus =
  | 'local'      // ローカル保持のみ（未送信）
  | 'uploading'  // presigned PUT 実行中
  | 'uploaded'   // PUT 成功（confirm 前）
  | 'confirmed'; // photos/confirm 済み（消去対象）

export type LocalPhoto = {
  id: LocalPhotoId;
  draftId: LocalDraftId;
  // 提出メタ（U4 PhotoMeta に整形）。
  fileName: string;
  contentType: string;          // image/* 限定（BR-P15 / U4）
  part: string | null;
  step: string | null;
  // バイナリ（メモリ内では Blob。保存時は暗号化 ArrayBuffer）。
  blob: Blob;
  status: LocalPhotoStatus;
  // 同期で割り当てられるサーバ側 photoId（提出応答 tickets で確定）。
  serverPhotoId: DtoId['photo'] | null;
  createdAt: number;
};
```

---

## 4. `SyncJob`（提出キュー要素）

「提出」操作で生成され `syncQueue` に永続化（Q5=A）。オフライン/失敗時も喪失しない。PII を保持せず `draftId` 参照のみ（PII は暗号化された `drafts`/`photos` に残る）。

```ts
export type SyncJobId = string; // ULID

export type SyncStage =
  | 'submission'   // POST /surveys/submission（未完了）
  | 'photos-put'   // presigned PUT（一部/全部 未完了）
  | 'confirm'      // POST photos/confirm（未完了）
  | 'done';        // 全段完了

export type SyncJob = {
  id: SyncJobId;
  draftId: LocalDraftId;
  stage: SyncStage;             // 再開ポイント（冪等な段階的再試行）
  attempts: number;             // 試行回数（バックオフ算出）
  nextAttemptAt: number;        // epoch ms（この時刻以降に再試行可）
  // submission 応答で確定する写真チケット（photos-put / confirm 段で使用）。
  uploadTickets: PhotoUploadTicket[]; // { photoId, putUrl }[]
  confirmedPhotoIds: DtoId['photo'][];
  lastError: string | null;     // 安全なメッセージ（秘匿）
  createdAt: number;
  updatedAt: number;
};
```

---

## 5. `EncryptedRecord`（暗号化封筒）

`drafts`・`photos` の値は次の封筒で保存（BR-11 / SECURITY-01）。`iv` はレコード毎にランダム（AES-GCM 12B）。

```ts
export type EncryptedRecord = {
  v: 1;                 // 封筒スキーマバージョン
  iv: Uint8Array;       // 12 byte ランダム（レコード毎）
  ciphertext: ArrayBuffer; // AES-GCM 256 暗号文（認証タグ込み）
};
```

- `drafts` の保存値: `{ id, surveyType, syncState, createdAt, updatedAt, enc: EncryptedRecord }`
  - **平文インデックス可能なのは非機微フィールドのみ**（id/surveyType/syncState/updatedAt）。`input`・`progress`・`photoIds` は `enc` 内（暗号化）。
- `photos` の保存値: `{ id, draftId, status, contentType, fileName, part, step, serverPhotoId, createdAt, enc: EncryptedRecord }`
  - 画像バイナリ（Blob→ArrayBuffer）が `enc` 内。メタは検索/表示のため平文（PII を含まない）。

> **設計理由**: 全文暗号化（Q3=A）だが、同期キュー処理・一覧表示・鍵未取得時の枚数把握のため、PII を含まない最小メタのみ平文インデックスとして残す。氏名・連絡先・住所・座標・画像本体は常に `enc` 内。

---

## 6. `DraftKeyState`（セッション派生鍵・メモリのみ / Q2=A）

```ts
export type DraftKeyState =
  | { status: 'locked' }                 // 鍵未導出（未ログイン or 導出失敗）
  | { status: 'unlocked'; key: CryptoKey }; // 導出済み（メモリ保持・非永続）
```

- `CryptoKey`（AES-GCM 256, `extractable: false`）は **メモリのみ**。IndexedDB/localStorage/sessionStorage に保存しない（BR-U6f-2）。
- 鍵導出の入力（key material）は認証セッションから取得する **ポート**（`sessionKeyProvider`）経由。再読込後はセッション有効中に再導出可能、ログアウトで導出不能＝実質消去（FR-18 と SECURITY-01 §4.3 を両立）。
- 導出時の **salt はランダム生成し `meta` store に永続化**（salt は非機微。鍵そのものではない）。

---

## 7. 永続化（IndexedDB）スキーマ

DB 名: `survey-local`（バージョン 1）。

| object store | keyPath | インデックス | 値 |
|---|---|---|---|
| `drafts` | `id` | `by-syncState`(syncState), `by-updatedAt`(updatedAt) | §5 drafts 保存値 |
| `photos` | `id` | `by-draftId`(draftId), `by-status`(status) | §5 photos 保存値 |
| `syncQueue` | `id` | `by-draftId`(draftId), `by-nextAttemptAt`(nextAttemptAt) | `SyncJob` |
| `meta` | `key` | — | `{ key: 'kdfSalt', value: Uint8Array }` 等の非機微メタ |

- バージョニング: `upgrade(db, oldV, newV)` で store/index を冪等作成（将来のスキーマ進化に備え v 管理）。
- アクセスは `idb`（Q1=A）の薄いラッパ `localDraftStore` 経由（生 API を直接散在させない）。

---

## 8. 関係（ER）

```text
LocalDraft (1) ──< (N) LocalPhoto      [draftId]
LocalDraft (1) ──  (0..1) SyncJob      [draftId; 提出時に1件生成]
SyncJob.uploadTickets ──> LocalPhoto.serverPhotoId  [photoId 突合]
DraftKeyState ── 暗号/復号 ── drafts.enc / photos.enc  [メモリ鍵]
```

- `LocalDraft` 1 件 ↔ サーバ `Survey` 1 件（`id` 共有 = ULID クライアント採番、冪等再送 BR-15 と整合）。
- 第2次下書きは `input.survey.parentSurveyId` で第1次（サーバ確定済み）を参照。
- 同期成功（`SyncJob.stage='done'`）確認後、対応する `LocalDraft`（PII）と `LocalPhoto`（画像）を消去（FR-19）。
