# U5 コード生成サマリ（結果出力・一覧）

**ステージ**: CONSTRUCTION → U5 Code Generation（Part 2 実装・完了）
**完了日時**: 2026-06-15T22:20+09:00
**担当ストーリー**: US-701（家屋単位 PDF）/ US-702（CSV）/ US-703（一覧・検索）
**計画**: `construction/plans/U5-code-generation-plan.md`（全 29 チェック [x] 済み）

## 概要
調査の検索/一覧（フィルタ＋オフセットページング＋ロールスコープ）、家屋単位 PDF、複数件 CSV をサーバ生成し、S3 へ保存して presigned GET URL を返す。副作用境界（pdfkit / S3 / 時刻）は `service/` と velona DI に隔離し、ドメインは純粋＋DI でカバレッジ 100% を維持。

## 実装内容

### 依存・アセット
- `pdfkit@0.19.1` / `@types/pdfkit@0.17.6` を pinned 追加（CSV は依存追加なしの自前生成）。
- 日本語フォント IPAex ゴシック（`server/assets/fonts/ipaexg.ttf`）を同梱、`assets/fonts/LICENSE.md` を保持。フォントパスは `envValues.PDF_FONT_PATH`（既定 `cwd/assets/fonts/ipaexg.ttf`、env で上書き可）。

### 型・定数・バリデータ
- `common/types/survey.ts`: `SurveyListFilter` / `Pagination` / `SurveyListResult` を加法的に追加。
- `common/types/export.ts`（新規）: `ExportFormat` / `ExportTicket` / `SurveyPdfModel` / `SurveyCsvRow`。
- `common/constants`: `AUDIT_ACTION_LIST` に `export.pdf` / `export.csv` 追加、`DEFAULT_PAGE_SIZE=20` / `MAX_PAGE_SIZE=100`、表示名マップ（`SURVEY_TYPE_DISPLAY` 等）。
- `common/validators/survey.ts`: `listQuery`（`z.coerce` で page/pageSize/createdFrom/createdTo を数値化、`confirmedOnly` は `z.enum(['true','false'])`、enum 検証、from≤to の superRefine）、`csvQuery`（同フィルタ・ページングなし）。

### Prisma
- `Survey` に `@@index([status])` / `@@index([surveyType])` / `@@index([createdBy])` / `@@index([createdAt])` を加法的に追加（NFR-03）。
- マイグレーション `20260615035439_add_survey_search_indexes`（インデックス作成のみ・非破壊）。

### S3 サービス（`service/s3Client.ts`）
- `putBuffer(key, body: Buffer, contentType)` 追加（`PutObjectCommand`）。
- presigned GET 期限を `getSignedUrl(key, expiresIn?)` で引数化（既定 24h 維持・後方互換、エクスポートは 15 分で発行）。

### PDF レンダラ（`service/pdfRenderer.ts`・カバレッジ対象外）
- `renderSurveyPdf(model): Promise<Buffer>`。pdfkit で同梱フォント登録、家屋単位（第1次＋第2次群）を様式参考セクション（家屋識別/被災者/区分/入力/損害割合/被害度区分/実施者・日時, BR-U5-13）で描画。決定的入出力・副作用は内部隔離。

### domain/survey 拡張（純粋＋DI）
- `model/surveyPolicy.ts`: `scopeForList(actor, filter)`（admin/viewer は不変、surveyor は `createdBy=actor.id` 強制、無ロール 403）、`assertExporter(actor)`（admin のみ）。
- `store/surveyQuery.ts`: 純粋ヘルパー `buildSurveyWhere(filter)`、`search(tx, filter, pagination)`（findMany＋count）、`searchDetail`（PII 含む全件）、`listDetailByParent`（家屋単位 PDF 用）。
- `surveyUseCase.list(actor, filter, pagination): SurveyListResult` へ拡張（旧 list 全件を置換）。

### domain/export（新規・純粋＋velona DI）
- `model/exportFormat.ts`: `toPdfModel` / `toCsvRows`（enum→表示名、epoch→ISO、null→空文字）。純粋。
- `model/csvRenderer.ts`: `render(rows): Buffer`（UTF-8 BOM＋ヘッダ＋RFC4180 エスケープ、CRLF、0 件はヘッダのみ）。純粋。
- `exportUseCase.ts`: `buildSurveyPdf(actor, firstSurveyId)` / `buildSurveyCsv(actor, filter)`。`depend({ renderPdf|renderCsv, putBuffer, signGet, now })` で副作用注入。admin 認可→Query（PII）→整形→render→`putBuffer(exports/...)`→`signGet(15分)`→監査→`ExportTicket`。PDF は第1次以外/不存在を 404。

### API（frourio）
- `GET /api/private/surveys`（拡張）: `query=SurveyListQuery`、`resBody=SurveyListResult`。controller で confirmedOnly を boolean 化、page/pageSize 既定適用、`surveyUseCase.list`。
- `GET /api/private/surveys/:surveyId/pdf`（新規）: L1 admin 強制＋`exportUseCase.buildSurveyPdf`。`resBody=ExportTicket`。
- `GET /api/private/surveys/export/csv`（新規・静的パス）: `query=SurveyCsvQuery`＋L1 admin 強制＋`exportUseCase.buildSurveyCsv`。`resBody=ExportTicket`。
- `npm run generate`（prisma + frourio `$server` + aspida `$api`）でルート・型再生成。

## テスト
- 単体（純粋）: `buildSurveyWhere`（9）、`exportFormat`（5）、`csvRenderer`（4, BOM・カンマ/改行/`"` エスケープ・0 件ヘッダのみ）、`surveyPolicy`（scopeForList: surveyor=self 強制 / admin・viewer 不変 / 無ロール 403）。
- PBT（fast-check）: CSV エスケープ可逆性、`scopeForList` 不変条件（surveyor 出力 filter.createdBy は常に actor.id）。
- DI 単体: `exportUseCase`（renderPdf/renderCsv/putBuffer/signGet/now スタブ注入で認可・キー・監査・チケット検証、非 admin 403、PDF 第2次/不存在 404）。
- API 統合 `tests/api/private/surveys.test.ts`（23 tests）: 検索（各フィルタ・ページング total）、ロールスコープ、PDF（admin 成功＝presigned URL / surveyor・viewer 403 / 第2次・不存在 404）、CSV（admin 成功 / 非 admin 403 / 0 件ヘッダのみ）。
- 既存 U2 list テストを Q-U5-5=B（surveyor=自分のみ・応答 `SurveyListResult`）へ改訂。

## 検証結果
- `npx tsc --noEmit`: **PASS**。
- `npm test`: **24 ファイル / 201 テスト PASS**、coverage **All files 100%**（statements/branches/functions/lines）。`service/pdfRenderer.ts` はカバレッジ include 対象外（include = `api/**/{controller,hooks,validators}.ts`・`common/**`・`domain/**`）。
- `npx eslint`（変更ファイル）: **クリーン**。
- `npx prisma format`: schema 差分は Survey の 4 インデックス追加のみ（加法的）。
- client 側 aspida 型は `SurveyListResult` へ追従。client 全体 typecheck は既存の pathpida×Next15 非互換（U-units 無関係）でブロックされるため対象外（U6u で対応）。

## セキュリティ（Security Baseline）
- 多層 fail-closed 認可: controller(L1 `assertRole([admin])`)＋useCase(L2 `assertExporter`/`scopeForList`)（SECURITY-08）。
- 一覧は PII 除外（BR-U5-5）。PDF/CSV は admin 限定で PII を含む（BR-U5-6）＋S3 既定 SSE。
- 全クエリ zod 検証（SECURITY-05 / BR-U5-17）。出力監査 `export.pdf`/`export.csv`（BR-U5-15）。presigned は短命 15 分・非公開バケット経由のみ。

## 申し送り
- 孤立した S3 エクスポートオブジェクトの TTL クリーンアップは OPERATIONS（範囲外）。
- PDF レイアウトは様式参考の段階的再現（座標精緻化は後続で可）。
- 一覧応答型変更（`SurveyDto[]`→`SurveyListResult`）はクライアント実装 U6u で追従。
- 本 U5 変更は U4 と同様 **未コミット**（コミットはユーザー要求時）。
