# U4 ドメインエンティティ（画像管理）

**ステージ**: CONSTRUCTION → U4 Functional Design
**担当ストーリー**: US-304 / US-305（FR-12, FR-13, FR-14 / SECURITY-01）
**設計判断**: Q-U4-1=A（署名付き PUT URL）/ Q-U4-2=A（非公開バケット・presigned のみ）/ Q-U4-3=C（調査＋部位＋ステップ）/ Q-U4-4=B（確認方式 pending→uploaded）/ Q-U4-5=A（キー=`surveys/{surveyId}/{photoId}`、GET 24h / PUT 15分）

## 1. Photo エンティティ

調査に紐づく写真メタデータ。バイナリ本体は S3 に保持し、DB はメタと S3 キー・アップロード状態のみを持つ。

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | `DtoId['photo']`（ULID, 新規ブランド） | 写真識別子。S3 キーにも使用。 |
| `surveyId` | `DtoId['survey']` | 所属調査（FK, onDelete: Cascade）。 |
| `part` | `string \| null` | 部位（第2次 `PartDamage.part` と整合。全体写真は null）。Q-U4-3=C。 |
| `step` | `string \| null` | 撮影手順ステップ識別子（任意, 自由文字列）。Q-U4-3=C。 |
| `fileName` | `string` | クライアント由来の元ファイル名（表示用, PII 非該当）。 |
| `contentType` | `string` | MIME タイプ（`image/jpeg` 等）。 |
| `s3Key` | `string` | S3 オブジェクトキー＝`surveys/{surveyId}/{photoId}`（Q-U4-5=A）。 |
| `status` | `'pending' \| 'uploaded'` | アップロード確認状態（Q-U4-4=B）。初期 `pending`、確認 API で `uploaded`。 |
| `createdBy` | `DtoId['user']` | 登録実施者（監査）。 |
| `createdAt` | `number`（epoch ms） | 登録日時。 |
| `uploadedAt` | `number \| null` | アップロード確認日時。`status=uploaded` 時のみ非 null。 |

### 不変条件（INV）
- **INV-P1**: `status='uploaded'` ⇔ `uploadedAt !== null`（確認の整合）。
- **INV-P2**: `s3Key` は `surveys/{surveyId}/{id}` の形（決定論的・衝突なし）。
- **INV-P3**: `status='pending'` の写真は閲覧 URL を発行しない（Q-U4-4=B / fail-closed）。
- **INV-P4**: `part`/`step` は任意。全体写真は両方 null も可。

## 2. 型定義（common/types/photo.ts 新規）

```ts
export type PhotoStatus = 'pending' | 'uploaded';

export type PhotoMeta = {        // 提出ペイロード/登録要求（クライアント由来メタ）
  fileName: string;
  contentType: string;
  part: string | null;
  step: string | null;
};

export type PhotoBase = {
  surveyId: DtoId['survey'];
  part: string | null;
  step: string | null;
  fileName: string;
  contentType: string;
  s3Key: string;
  status: PhotoStatus;
  createdBy: DtoId['user'];
  createdAt: number;
  uploadedAt: number | null;
};

export type PhotoDto = PhotoBase & { id: DtoId['photo'] };

// presigned URL 発行結果
export type PhotoUploadTicket = { photoId: DtoId['photo']; putUrl: string };  // 提出応答（PUT, 15分）
export type PhotoView = { photoId: DtoId['photo']; getUrl: string; fileName: string; part: string | null; step: string | null }; // 閲覧（GET, 24h）
```

> 注: 既存 `common/types/survey.ts` の `PhotoMeta = { fileName, contentType }` を上記へ拡張（`part`/`step` 追加）し、`common/types/photo.ts` へ移設。`SubmissionPayload.photos` は新 `PhotoMeta[]` を参照。

## 3. Prisma モデル（加法的マイグレーション）

```prisma
// 調査写真（U4）。バイナリは S3、DB はメタ＋S3キー＋アップロード状態。
model Photo {
  id         String   @id
  surveyId   String
  survey     Survey   @relation(fields: [surveyId], references: [id], onDelete: Cascade)
  part       String?
  step       String?
  fileName   String
  contentType String
  s3Key      String
  status     String   // 'pending' | 'uploaded'（アプリ層 zod 検証）
  createdBy  String
  createdAt  DateTime
  uploadedAt DateTime?

  @@index([surveyId])
}
```

`Survey` に `photos Photo[]` リレーションを加法的に追加。enum は既存方針どおり String カラム＋アプリ層 zod 検証（enum churn 回避）。

## 4. branded id 追加

`common/constants/index.ts` の `ID_NAME_LIST` に `'photo'` を追加（`['user', 'auditLog', 'survey', 'photo']`）。
