# U5 ドメインエンティティ（結果出力・一覧）

**ステージ**: CONSTRUCTION → U5 Functional Design
**担当ストーリー**: US-701 / US-702 / US-703
**設計判断**: Q-U5-1=A（pdfkit）/ Q-U5-2=A（CSV のみ・BOM）/ Q-U5-3=B（拡張フィルタ）/ Q-U5-4=A（オフセット＋総件数）/ Q-U5-5=B（ロール別スコープ）/ Q-U5-6=C（PDF admin のみ）/ Q-U5-7=A（CSV admin のみ・PII 含む）/ Q-U5-8=B（S3＋presigned）/ Q-U5-9=A（既存 list 拡張）/ Q-U5-10=B（家屋単位 PDF）/ Q-U5-11=A（日本語フォント同梱）

## 0. 永続化への影響
U5 は **新規 Prisma モデルを追加しない**（読み取り＋生成のみ）。検索性能（NFR-03）のため既存 `Survey` に**インデックス追加**を検討（Infrastructure Design で確定）: `status` / `surveyType` / `createdBy` / `createdAt`。生成した PDF/CSV は S3 の `exports/` に一時保存し presigned URL を返す（DB 非永続）。

## 1. 検索フィルタ・ページング型（common/types/survey.ts へ加法的）

```ts
// 一覧・検索フィルタ（US-703 / Q-U5-3=B）。すべて任意・AND 結合。
export type SurveyListFilter = {
  status?: SurveyStatus;
  surveyType?: SurveyType;
  structureType?: StructureType;
  address?: string;            // 部分一致（contains, 大文字小文字無視）
  damageLevel?: string;        // DAMAGE_LEVEL_LIST 検証
  createdBy?: DtoId['user'];   // 実施者
  confirmedOnly?: boolean;     // status=confirmed 限定の簡易フラグ
  createdFrom?: number;        // epoch ms（作成日時 下限・包含）
  createdTo?: number;          // epoch ms（作成日時 上限・包含）
};

// オフセットページング（Q-U5-4=A）。
export type Pagination = { page: number; pageSize: number }; // page≥1, pageSize 1..100

// 一覧応答（総件数同梱）。items は PII 除外（BR-13 踏襲）。
export type SurveyListResult = {
  items: SurveyDto[];
  total: number;
  page: number;
  pageSize: number;
};
```

## 2. エクスポート型（common/types/export.ts 新規）

```ts
export type ExportFormat = 'pdf' | 'csv';

// 生成物の受け渡し（Q-U5-8=B）。S3 に保存し presigned GET URL を返す。
export type ExportTicket = {
  format: ExportFormat;
  url: string;          // presigned GET（短命）
  filename: string;     // ダウンロード時の表示名
  expiresInSec: number; // URL 有効期限（秒）
};

// PDF データモデル（家屋単位, Q-U5-10=B）。整形済みビュー（純粋変換の出力）。
export type SurveyPdfModel = {
  first: SurveyDetailDto;       // 第1次（PII 含む, admin のみ）
  seconds: SurveyDetailDto[];   // 紐づく第2次群（時系列）
};

// CSV 行（複数件, PII 含む, admin のみ, Q-U5-7=A）。列順は csv 整形で固定。
export type SurveyCsvRow = {
  id: string;
  surveyType: string;        // 表示名
  status: string;            // 表示名
  address: string;
  houseNumber: string;
  structureType: string;     // 表示名
  buildingName: string;
  floors: string;
  victimName: string;        // PII
  victimContact: string;     // PII
  victimAddress: string;     // PII
  damageRatio: string;
  damageLevel: string;       // 表示名
  createdBy: string;
  createdTime: string;       // ISO 文字列
  submittedAt: string;
  approvedAt: string;
  confirmedAt: string;
};
```

## 3. 値の取扱い
- enum（status/surveyType/structureType/damageLevel）は表示時に `*_DISPLAY` マップで日本語化（CSV/PDF）。検索フィルタは英語 enum 値で受け取り zod 検証。
- 日時は内部 epoch ms。CSV/PDF では ISO もしくは `YYYY-MM-DD HH:mm` に整形。
- null は CSV では空文字、PDF では「—」等のプレースホルダ。

## 4. S3 キー名前空間（Infrastructure Design で最終確定）
- 生成物: `exports/pdf/{firstSurveyId}-{epoch}.pdf` / `exports/csv/{actorId}-{epoch}.csv`。非公開バケット・SSE（U-Cross/U4 踏襲）。presigned GET 短命（例 15 分）。孤立オブジェクトの TTL クリーンアップは OPERATIONS。

## 5. 日本語フォント（Q-U5-11=A）
- `server/assets/fonts/` にオープンライセンスフォント（Noto Sans JP もしくは IPAex Gothic）を同梱しリポジトリに含める。pdfkit に `registerFont` で登録。ライセンス表記を `assets/fonts/LICENSE` に保持。
