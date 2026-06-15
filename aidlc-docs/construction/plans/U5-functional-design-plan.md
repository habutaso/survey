# U5 機能設計プラン（結果出力・一覧 / Functional Design）

**ステージ**: CONSTRUCTION → U5 Functional Design
**担当ストーリー**: US-701（PDF 単票）/ US-702（CSV/Excel 複数件）/ US-703（一覧・検索）
**関連要件**: FR-31・FR-32・FR-33 / NFR-03（一覧・検索の応答性）/ SECURITY-08（デフォルト拒否・オブジェクトレベル認可・ロール別機能認可）
**依存**: U2（survey 集約・surveyQuery）、U3a/U3b（判定結果）、U1（認可）、U-Cross（監査・検証）すべて完了
**応用設計参照**: `application-design/components.md §1.7 export`、`component-methods.md §7`、`services.md §7`
**現状把握**:
- `surveyQuery.list(tx)` は **全件**（PII 除外 `SurveyDto`、createdAt desc）を返す。フィルタ・ページングなし。
- `surveyUseCase.list()` は認証者に全件読取（U2 / Q19=A）。
- PDF/CSV/Excel ライブラリは **未導入**。
- 内閣府様式の参考 PDF は `docs/references/`（`06_shishin_chosahyo.pdf` = 調査票本体、`07_chosahyo_about.pdf` = 解説）。

---

## 機能設計プラン（チェックボックス）

### 設計対象
- [x] 1. ドメインエンティティ/型: 検索フィルタ型（`SurveyListFilter`）、ページング型、CSV 行型、PDF データモデル（調査票項目の整形済みビュー）。
- [x] 2. ビジネスロジックモデル: `export` モジュール（`exportUseCase.buildSurveyPdf` / `buildSurveyCsv`）、検索 Query（`surveyQuery.search`）、整形ロジック（判定結果・enum 表示名・PII の取扱い）。
- [x] 3. ビジネスルール: 認可（誰が PDF/CSV/検索可能か）、PII 取扱い、検索フィルタ仕様、ページング上限、CSV 列・エンコーディング、PDF 様式準拠範囲、エラー処理、監査記録。
- [x] 4. データフロー: 認可 → Query（認可範囲）→ 整形 → 生成（Buffer）→ API 応答（Content-Disposition）。
- [x] 5. API エンドポイント設計（出力先・配置・レスポンス形態）。

---

## 設計判断のための質問

> 回答は各 `[Answer]:` の後に英字（A/B/...）で記入してください。複数選択や補足があれば併記可。

### Q-U5-1: PDF 生成方式（FR-31/33・様式準拠 vs 軽量さ）
内閣府様式 `06_shishin_chosahyo.pdf` に準拠した PDF をサーバ生成する方式。
- **A**: `pdfkit`（プログラマティック描画）。軽量・依存小・Docker 追加なし。様式は座標指定で再現（高再現には工数）。日本語フォント同梱が必要。
- **B**: HTML テンプレート → `puppeteer`(ヘッドレス Chromium) で PDF 化。レイアウト再現性が高いが Chromium が重く Docker イメージ肥大・メモリ増。
- **C**: `@react-pdf/renderer`（JSX で宣言的レイアウト）。中間。日本語フォント登録が必要。
- **D**: MVP は様式厳密準拠せず、主要項目（家屋識別・入力・損害割合・被害度区分）の簡易レイアウト PDF（`pdfkit`）。様式準拠は後続で精緻化。

[Answer]: A

### Q-U5-2: CSV と Excel の実装範囲（FR-32）
US-702 は「CSV／Excel」。MVP の実装範囲。
- **A**: CSV のみ（UTF-8 BOM 付きで Excel で文字化けしない）。最小依存、自前生成。
- **B**: CSV + Excel(.xlsx)（`exceljs` 等）。両形式。依存追加。
- **C**: Excel(.xlsx) のみ。

[Answer]: A

### Q-U5-3: 検索・一覧のフィルタ項目（US-703 / FR-43）
「住所・状態・区分等」で検索。実装するフィルタ（複数選択可、AND 結合）。
- **A**: 状態（status）/ 調査区分（surveyType）/ 住所（address 部分一致）/ 被害度区分（damageLevel）/ 作成日時範囲（from/to）。
- **B**: A に加えて構造種別（structureType）/ 実施者（createdBy）/ 確定済みのみ等の追加フィルタ。
- **C**: 最小（status / surveyType / address 部分一致）のみ。

[Answer]: B

### Q-U5-4: ページング方式（NFR-03 応答性）
一覧・検索の応答性確保。
- **A**: オフセット方式（`page` / `pageSize`、上限 pageSize=100、総件数を返す）。実装単純・UI 互換性高。
- **B**: カーソル方式（`cursor` / `limit`）。大規模向き・安定。総件数は返さない。
- **C**: ページングなし（上限件数で打ち切り、例: 最大 500 件）。MVP 簡易。

[Answer]: A

### Q-U5-5: 一覧・検索の認可スコープ（SECURITY-08）
SECURITY-08 は「オブジェクトレベル認可（他者の調査へのアクセス防止）」を挙げるが、U2 では Q19=A で「認証者は全件読取（PII 除外）」を採用済み。U5 一覧・検索のスコープ。
- **A**: U2 踏襲。認証済みなら全件を検索可（PII 除外の `SurveyDto`）。viewer/surveyor/admin とも全件一覧。SECURITY-08 のオブジェクト認可は「PII・PDF 等の機微出力」に適用。
- **B**: ロール別スコープ。viewer/admin は全件、surveyor は自身が作成した調査（createdBy=self）のみ一覧。
- **C**: その他（補足に記載）。

[Answer]: B

### Q-U5-6: PDF（単票）の認可と PII（US-701 / SECURITY-08）
PDF は調査票＝PII（被災者氏名・連絡先・住所）を含む公式様式。
- **A**: surveyor / admin のみ PDF 出力可、PII を含めて出力。viewer は 403（PII 非開示の方針 BR-13 と整合）。
- **B**: surveyor / admin / viewer 全員出力可だが、viewer 向けは PII マスク版 PDF。
- **C**: admin のみ。

[Answer]: C

### Q-U5-7: CSV（複数件）の認可と PII（US-702）
US-702 は「As a 管理者」。CSV の出力権限と PII。
- **A**: admin のみ。CSV に PII を含める（集計・連携用途）。
- **B**: admin のみ。CSV は PII 除外（非 PII 項目のみ）。
- **C**: surveyor/admin。surveyor は自分の調査のみ、PII 含む。

[Answer]: A

### Q-U5-8: 出力エンドポイントの配置とレスポンス形態
サーバ生成（AD4=A）。配置とダウンロード方式。
- **A**: `GET /api/private/surveys/:surveyId/pdf`（単票）＋ `GET /api/private/surveys/export/csv?<filter>`（複数件）。レスポンスは Buffer/ストリームを `Content-Type` + `Content-Disposition: attachment; filename=...` で直接返す。
- **B**: 生成して S3 に置き presigned URL を返す（大容量・非同期向き）。
- **C**: その他（補足に記載）。

[Answer]:B 

### Q-U5-9: 検索エンドポイントの形態（既存 list との関係）
現状 `GET /api/private/surveys`（一覧）は U2 で `list()` 全件。U5 で検索を追加。
- **A**: 既存 `GET /api/private/surveys` をフィルタ＋ページング対応に拡張（クエリパラメータ追加・後方互換）。`surveyUseCase.list` → `search(filter)` へ。
- **B**: 検索専用の別エンドポイント（例: `GET /api/private/surveys/search`）を新設し、既存 list は据置。
- **C**: その他（補足に記載）。

[Answer]: A

### Q-U5-10: PDF の対象調査と判定結果の併記（US-605 整合）
第1次/第2次の結果併記（US-605, `getHouseResults`）が既存。PDF の単位。
- **A**: 単票 = 1 調査（surveyId 指定）。第1次・第2次それぞれ独立に PDF 化。
- **B**: 単票 = 家屋単位（第1次＋紐づく第2次群を1 PDF に併記）。
- **C**: 両対応（surveyId 単体／家屋単位の2エンドポイント）。

[Answer]:B 

### Q-U5-11: 日本語フォント同梱（PDF 必須事項）
PDF に日本語を埋め込むにはフォントファイルが必要（`pdfkit`/`@react-pdf` とも）。
- **A**: オープンライセンスフォント（例: Noto Sans JP / IPAex）を `server/assets/fonts/` に同梱しリポジトリに含める。
- **B**: ビルド時にダウンロード（Dockerfile で取得）。リポジトリに含めない。
- **C**: 方式に合わせて後で決定（Q-U5-1 の選択に従う）。

[Answer]: A

---

## 補足・前提（設計時の既定）
- 入力検証は U-Cross の zod 規約をクエリパラメータにも適用（SECURITY-05）。フィルタ値は境界付き・enum 検証。
- 監査: PDF/CSV 出力は機微操作のため監査記録を検討（`export.pdf` / `export.csv`、対象・実施者）。要否は Q 回答後に business-rules で確定。
- `export` は「生成＝副作用境界」（services.md §7）。Query/整形は純粋、生成（Buffer 化）のみ副作用。
- 既存 `toSurveyDto`（PII 除外）と `findDetailById`（PII 含む）を認可に応じて使い分ける。
