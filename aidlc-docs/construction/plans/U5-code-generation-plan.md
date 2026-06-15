# U5 コード生成プラン（結果出力・一覧 / Code Generation Part 1）

**ステージ**: CONSTRUCTION → U5 Code Generation（Part 1: Planning）
**作成日時**: 2026-06-15T12:45+09:00
**担当ストーリー**: US-701（家屋単位 PDF）/ US-702（CSV）/ US-703（一覧・検索）
**設計**: `construction/U5/functional-design/*`、`construction/U5/infrastructure-design/infrastructure-design.md`
**設計判断**: Q-U5-1=A（pdfkit）/ Q-U5-2=A（CSV・BOM）/ Q-U5-3=B（拡張フィルタ）/ Q-U5-4=A（オフセット＋total）/ Q-U5-5=B（ロールスコープ: surveyor=自分のみ）/ Q-U5-6=C（PDF admin のみ）/ Q-U5-7=A（CSV admin のみ・PII）/ Q-U5-8=B（S3＋presigned）/ Q-U5-9=A（既存 list 拡張）/ Q-U5-10=B（家屋単位）/ Q-U5-11=A（フォント同梱）

## ゴール
検索（フィルタ＋オフセットページング＋ロールスコープ）、家屋単位 PDF（admin・PII・pdfkit）、CSV（admin・PII・BOM）をサーバ生成し S3 保存＋presigned URL で返す。生成物の副作用境界（pdfkit/S3）は `service/` に隔離し、ドメインは純粋＋DI で 100% カバレッジを維持する。

## カバレッジ方針
- `service/**` はカバレッジ include 対象外（既存 s3Client と同様）。**pdfkit 描画は `service/pdfRenderer.ts` に隔離**。
- `domain/**`・`common/**`・`api/**/{controller,validators}.ts` は 100% 必須。`csvRenderer`/`exportFormat`/`exportUseCase`/`surveyPolicy.scopeForList`/`surveyQuery.search` は純粋 or DI で完全カバー。

## 実装ステップ（チェックボックス）

### A. 依存・アセット
- [x] 1. `pdfkit` を pinned で追加（`npm i -E pdfkit` ＋ `npm i -D -E @types/pdfkit`）。CSV は自前生成（依存追加なし）。
- [x] 2. 日本語フォント（IPAex Gothic もしくは Noto Sans JP, オープンライセンス）を `server/assets/fonts/` に同梱＋`LICENSE` 配置（Q-U5-11=A）。

### B. 型・定数・バリデータ
- [x] 3. `common/types/survey.ts`: `SurveyListFilter` / `Pagination` / `SurveyListResult` を加法的に追加（domain-entities §1）。
- [x] 4. `common/types/export.ts`（新規）: `ExportFormat` / `ExportTicket` / `SurveyPdfModel` / `SurveyCsvRow`（§2）。
- [x] 5. `common/constants/index.ts`: `AUDIT_ACTION_LIST` に `'export.pdf'` / `'export.csv'` を追加。検索の既定（`DEFAULT_PAGE_SIZE=20`, `MAX_PAGE_SIZE=100`）を定義。
- [x] 6. `common/validators/survey.ts`: `listQuery`（query 用 zod, `z.coerce` で page/pageSize/createdFrom/createdTo を数値化、`confirmedOnly` は `z.enum(['true','false']).transform`、enum 値検証、`address` 境界付き、page≥1・1≤pageSize≤100、from≤to）。`csvQuery`（同フィルタ）。出力は `SurveyListFilter`＋`Pagination` に整合。

### C. Prisma
- [x] 7. `prisma/schema.prisma`: `Survey` に `@@index([status])`/`@@index([surveyType])`/`@@index([createdBy])`/`@@index([createdAt])` を加法的に追加。
- [x] 8. マイグレーション `prisma migrate dev --name add_survey_search_indexes`（加法的・非破壊）。

### D. S3 サービス
- [x] 9. `service/s3Client.ts`: `putBuffer(key, body: Buffer, contentType): Promise<void>`（`PutObjectCommand`）追加。presigned GET は既存 `getSignedUrl` を流用（期限は 15 分版を `getSignedUrl(key, expiresIn?)` で引数化、既定 24h 維持・後方互換）。

### E. PDF レンダラ（service/・カバレッジ対象外）
- [x] 10. `service/pdfRenderer.ts`: `renderSurveyPdf(model: SurveyPdfModel): Promise<Buffer>`（pdfkit、同梱フォント登録、様式参考セクション: 家屋識別/被災者/区分/入力/損害割合/被害度区分/実施者・日時, BR-U5-13）。決定的入出力・副作用は内部に隔離。

### F. domain/survey 拡張
- [x] 11. `domain/survey/model/surveyPolicy.ts`: `scopeForList(actor, filter): SurveyListFilter`（Q-U5-5=B: admin/viewer はそのまま、surveyor は `createdBy=actor.id` 強制、無ロールは authMethod で 403）。`assertExporter(actor)`（admin のみ, BR-U5-2/3 = `authMethod.assertRole([admin])`）。
- [x] 12. `domain/survey/store/surveyQuery.ts`: `search(tx, filter, pagination): Promise<{ items: SurveyDto[]; total: number }>`（where AND 構築、skip/take、`$transaction([findMany, count])`）。`searchDetail(tx, filter): Promise<SurveyDetailDto[]>`（PII 含む・全件・ページングなし）。where 構築は純粋ヘルパー `buildSurveyWhere(filter)` に分離（テスト容易）。
- [x] 13. `domain/survey/surveyUseCase.ts`: `list(actor, filter, pagination): Promise<SurveyListResult>` へ拡張（旧 `list()` 全件を置換）。`scopeForList` 適用 → `search` → `SurveyListResult`。

### G. domain/export（新規モジュール・純粋＋DI）
- [x] 14. `domain/export/model/exportFormat.ts`: `toPdfModel(first, seconds): SurveyPdfModel`（束ね）／`toCsvRows(details: SurveyDetailDto[]): SurveyCsvRow[]`（enum→表示名、epoch→ISO、null→空文字）。純粋。
- [x] 15. `domain/export/model/csvRenderer.ts`: `render(rows: SurveyCsvRow[]): Buffer`（UTF-8 BOM＋ヘッダ＋RFC4180 エスケープ、0 件はヘッダのみ）。純粋。
- [x] 16. `domain/export/exportUseCase.ts`: `buildSurveyPdf(actor, firstSurveyId): Promise<ExportTicket>` ／ `buildSurveyCsv(actor, filter): Promise<ExportTicket>`。velona `depend({ now, genKey?, renderPdf, renderCsv, putBuffer, signGet })` で副作用注入（単体でスタブ可）。admin 認可（`assertExporter`）→ Query（detail, PII）→ 整形 → render → `putBuffer(exports/...)` → `signGet`（15分）→ 監査 `export.pdf`/`export.csv` → `ExportTicket`。PDF は `findDetailById(first)`＋`listByParent`（家屋単位, BR-U5-11、第1次不在/第2次ID は 404）。

### H. API エンドポイント（frourio）
- [x] 17. `api/private/surveys/index.ts`＋`controller.ts`（拡張）: `get` の `query: SurveyListFilter & Pagination` 風、`resBody: SurveyListResult`。controller は `validators: { query: surveyValidator.listQuery }`＋`{ user, query }` → `surveyUseCase.list(user, filter, pagination)`。
- [x] 18. `api/private/surveys/_surveyId@string/pdf/index.ts`＋`controller.ts`（新規）: `get` `resBody: ExportTicket`。L1 で admin 強制＋`exportUseCase.buildSurveyPdf(user, firstSurveyId)`。
- [x] 19. `api/private/surveys/export/csv/index.ts`＋`controller.ts`（新規・静的パス）: `get` `query` フィルタ、`resBody: ExportTicket`。`validators: { query: surveyValidator.csvQuery }`＋L1 admin 強制＋`exportUseCase.buildSurveyCsv(user, filter)`。
- [x] 20. `npm run generate`（prisma + frourio `$server` + aspida `$api`）で型・ルート再生成（server/client 双方）。

### I. テスト（カバレッジ100%・PBT 維持）
- [x] 21. 単体（純粋）: `buildSurveyWhere`（各フィルタ→where 構造）、`scopeForList`（surveyor=self 強制／admin・viewer=不変／無ロール 403）、`exportFormat.toCsvRows`（表示名・null→空・PII 列）、`exportFormat.toPdfModel`、`csvRenderer.render`（BOM・エスケープ〔カンマ/改行/"〕・0 件ヘッダのみ）。
- [x] 22. 単体 PBT（fast-check）: CSV エスケープ可逆性（任意文字列を含む行 → パースして元値復元）／`scopeForList` 不変条件（surveyor の出力 filter.createdBy は常に actor.id）。
- [x] 23. 単体（DI）: `exportUseCase.buildSurveyPdf`/`buildSurveyCsv`（renderPdf/renderCsv/putBuffer/signGet スタブ注入で 認可・キー・監査・チケットを検証、admin 以外 403、PDF 第1次不在 404）。
- [x] 24. API 統合 `tests/api/private/surveys.test.ts`（追記）: 検索（status/surveyType/structureType/address 部分一致/damageLevel/日付範囲/ページング total）、ロールスコープ（surveyor は他者調査が出ない・admin/viewer は全件）、PDF（admin 成功＝presigned URL／surveyor・viewer 403／第2次ID・不存在 404）、CSV（admin 成功＝presigned URL・非 admin 403・0 件ヘッダのみ）。S3 は既存テスト基盤（minio）利用。
- [x] 25. 既存テスト改訂: U2「一覧は認証者が全件読取」を Q-U5-5=B に合わせ更新（surveyor=自分のみ、応答が `SurveyListResult`）。`surveyUseCase.list()` 呼出箇所（controller・テスト）を新シグネチャへ。

### J. 検証
- [x] 26. `npx tsc --noEmit` PASS（client 側 aspida 連動の型崩れ確認: list 応答が `SurveyListResult` へ変化）。
- [x] 27. `npm test` 全 PASS、coverage All files 100% 維持（service/pdfRenderer は include 対象外）。
- [x] 28. `npx eslint`（変更ファイル）クリーン。`prisma format` 後 schema 差分が意図通り（Survey インデックス追加のみ）であること。

### K. ドキュメント
- [x] 29. `construction/U5/code/u5-summary.md` 作成。`aidlc-state.md` / `audit.md` 更新。

## Security Baseline コンプライアンス
- presigned 発行・一覧返却前のサーバ認可を controller(L1) ＋ useCase(L2 `assertExporter`/`scopeForList`) で多層・fail-closed（SECURITY-08）。
- 一覧は PII 除外（BR-U5-5）、PDF/CSV は admin 限定で PII 含む（BR-U5-6）＋ S3 SSE。
- クエリ全入力 zod 検証（SECURITY-05, BR-U5-17）。監査 `export.pdf`/`export.csv`（BR-U5-15）。
- presigned 短命（15分, BR-U5-10）。生成物は非公開バケット経由のみ。

## PBT コンプライアンス（Full enforcement）
- CSV エスケープ可逆性・`scopeForList` 不変条件を fast-check で検証（ステップ22）。

## リスク・留意
- **`surveyUseCase.list` シグネチャ変更**の波及（controller・既存 U2 テスト・client aspida）。ステップ25/26 で網羅。
- **クエリ boolean 強制**（`confirmedOnly`）は文字列由来のため `z.enum(['true','false']).transform` で安全に変換。
- **pdfkit カバレッジ**: `service/pdfRenderer.ts` に隔離し include 対象外。スモーク（%PDF ヘッダ・非空 Buffer）は API 統合で間接確認。
- **マイグレーションは加法的**（インデックスのみ・データ非破壊）。
- **CSV/PDF の PII**: admin 限定＋presigned 短命＋SSE で機微情報を保護。
