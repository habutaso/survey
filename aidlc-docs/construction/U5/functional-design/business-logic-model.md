# U5 ビジネスロジックモデル（結果出力・一覧）

**ステージ**: CONSTRUCTION → U5 Functional Design

## 1. アーキテクチャ概観（既存 catapult データフロー準拠）

```
[一覧/検索] Next.js --filter+page--> GET /api/private/surveys
                                         | surveyUseCase.list(actor, filter, pagination)
                                         |   ロールスコープ適用（Q-U5-5=B）
                                         v
                                   surveyQuery.search(tx, scopedFilter, pagination)
                                         | where(AND) + skip/take + count
                                         v
                                   SurveyListResult { items(PII除外), total, page, pageSize }

[PDF 単票] Next.js --firstSurveyId--> GET /api/private/surveys/:surveyId/pdf
                                         | exportUseCase.buildSurveyPdf(actor, firstSurveyId)
                                         |   admin 認可（Q-U5-6=C）→ getHouseResults(detail, PII)
                                         |   → exportFormat.toPdfModel（純粋）→ pdfRenderer（pdfkit, 副作用境界）
                                         |   → s3.putBuffer(exports/pdf/...) → s3.getSignedUrl
                                         v
                                   ExportTicket { url(presigned), filename } ＋監査 export.pdf

[CSV 複数件] Next.js --filter--> GET /api/private/surveys/export/csv
                                         | exportUseCase.buildSurveyCsv(actor, filter)
                                         |   admin 認可（Q-U5-7=A）→ search(detail, PII, 全件)
                                         |   → exportFormat.toCsvRows（純粋）→ csvRenderer（BOM, 副作用境界）
                                         |   → s3.putBuffer(exports/csv/...) → s3.getSignedUrl
                                         v
                                   ExportTicket { url(presigned), filename } ＋監査 export.csv
```

## 2. 検索（surveyQuery 拡張・store 層）
- `surveyQuery.search(tx, filter: SurveyListFilter, pagination: Pagination): Promise<{ items: SurveyDto[]; total: number }>`
  - where 構築（AND）: `status` / `surveyType` / `structureType` / `damageLevel` / `createdBy` / `confirmedOnly→status='confirmed'` / `address: { contains, mode: 'insensitive' }` / `createdAt: { gte: from, lte: to }`。
  - `skip=(page-1)*pageSize`, `take=pageSize`, `orderBy: { createdAt: 'desc' }`。
  - `prisma.$transaction([findMany(include), count(where)])` で items と total を取得。
  - 行は `toSurveyDto`（PII 除外）。
- `surveyQuery.searchDetail(tx, filter): Promise<SurveyDetailDto[]>`（CSV 用・PII 含む・ページングなし・全件）。`findDetailById` と同じ include で `findMany`。

## 3. ユースケース層

### 3.1 一覧・検索（surveyUseCase.list 拡張, Q-U5-9=A）
- 旧 `list(): Promise<SurveyDto[]>` を `list(actor, filter, pagination): Promise<SurveyListResult>` へ拡張。
- **ロールスコープ（Q-U5-5=B / BR-U5-1）**: `surveyPolicy.scopeForList(actor, filter)` を適用。
  - viewer / admin: フィルタそのまま（全件対象）。
  - surveyor（admin でない）: `createdBy` を **actor.id に強制上書き**（クライアント指定 createdBy は無視）。
  - 無ロール: 認可エラー（403, fail-closed）。
- `surveyQuery.search` を呼び `SurveyListResult` を返す。

### 3.2 PDF 出力（exportUseCase.buildSurveyPdf, Q-U5-6=C / Q-U5-10=B）
- 入力: `actor`, `firstSurveyId`。
- 認可: `authMethod.assertRole(actor, [admin])`（admin のみ, fail-closed）。
- データ: `surveyQuery.findDetailById(firstSurveyId)` ＋ `listByParent(firstSurveyId)`（= 家屋単位）。第1次が存在しなければ 404。指定が第2次 ID の場合も 404（第1次 ID 必須）。
- 整形（純粋）: `exportFormat.toPdfModel(first, seconds)`。
- 生成（副作用境界）: `pdfRenderer.render(model): Buffer`（pdfkit ＋同梱日本語フォント）。
- 保存・URL: `s3.putBuffer('exports/pdf/{firstSurveyId}-{epoch}.pdf', buf, 'application/pdf')` → `s3.getSignedUrl(key)`。
- 監査: `export.pdf`（対象 firstSurveyId）。
- 戻り: `ExportTicket`。

### 3.3 CSV 出力（exportUseCase.buildSurveyCsv, Q-U5-7=A / Q-U5-2=A）
- 入力: `actor`, `filter`。
- 認可: `authMethod.assertRole(actor, [admin])`（admin のみ）。
- データ: `surveyQuery.searchDetail(filter)`（PII 含む・全件）。
- 整形（純粋）: `exportFormat.toCsvRows(details): SurveyCsvRow[]` → `csvRenderer.render(rows): Buffer`（先頭に UTF-8 BOM、RFC4180 エスケープ）。
- 保存・URL: `s3.putBuffer('exports/csv/{actorId}-{epoch}.csv', buf, 'text/csv')` → presigned GET。
- 監査: `export.csv`（件数）。
- 戻り: `ExportTicket`。0 件でもヘッダ行のみの CSV を返す。

## 4. 整形（純粋関数・domain/export/model）
- `exportFormat.toPdfModel(first, seconds): SurveyPdfModel`（束ねるのみ）。
- `exportFormat.toCsvRows(details): SurveyCsvRow[]`（enum→表示名、epoch→ISO、null→空文字）。
- `csvRenderer.render(rows): Buffer`（ヘッダ＋行、BOM、エスケープ）。フレームワーク非依存・テスト容易。
- `pdfRenderer.render(model): Buffer`（pdfkit。レイアウトは様式参考のセクション構成。副作用は持つが入出力は決定的）。

## 5. サービス拡張（service/s3Client.ts）
- `putBuffer(key, body: Buffer, contentType): Promise<void>`（`PutObjectCommand` で Buffer を保存）。既存 `getSignedUrl`（GET 24h）または短命版を presigned に流用（期限は Infra で確定）。

## 6. API エンドポイント（加法的）
| メソッド/パス | 用途 | 認可 |
|---|---|---|
| `GET /api/private/surveys`（拡張） | 一覧・検索（filter+page、応答 `SurveyListResult`） | 認証（ロールスコープ Q-U5-5=B） |
| `GET /api/private/surveys/:surveyId/pdf` | 家屋単位 PDF（presigned URL を返す） | admin のみ |
| `GET /api/private/surveys/export/csv` | フィルタ該当 CSV（presigned URL を返す） | admin のみ |

> 既存 `GET /api/private/surveys` の応答型が `SurveyDto[]` → `SurveyListResult` へ変わるため、aspida 連動でクライアント型が更新される（U6u はこれに追従）。

## 7. テスト戦略
- 単体（純粋）: `toCsvRows`（enum 表示名・null→空・PII 列）、`csvRenderer`（BOM・エスケープ・0 件ヘッダのみ）、`toPdfModel`、`surveyPolicy.scopeForList`（surveyor は self 強制 / admin・viewer は全件 / 無ロール拒否）。
- 単体 PBT: CSV エスケープの可逆性（カンマ・改行・ダブルクォートを含む値）／ scopeForList の不変条件（surveyor 出力フィルタの createdBy は常に self）。
- API 統合: 検索（各フィルタ・ページング・total）、ロールスコープ（surveyor は他者調査が出ない）、PDF（admin 成功・presigned URL、surveyor/viewer 403、第2次 ID/不存在 404）、CSV（admin 成功・PII 含む・非 admin 403・0 件）。
- 既存 U2 list テスト（「認証者が全件読取」）は Q-U5-5=B に合わせて更新（surveyor は自分のみ）。
