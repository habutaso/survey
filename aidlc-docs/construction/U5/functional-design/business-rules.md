# U5 ビジネスルール（結果出力・一覧）

**ステージ**: CONSTRUCTION → U5 Functional Design

## 認可（SECURITY-08 / デフォルト拒否・fail-closed）
- **BR-U5-1（一覧・検索スコープ, Q-U5-5=B）**: 認証必須。viewer / admin は全調査を検索可。surveyor（admin 権限を持たない）は **自身が作成した調査のみ**（サーバが `filter.createdBy` を actor.id に強制上書きし、クライアント指定の createdBy は無視）。無ロールは 403。
  - 注: 本ルールは U2 の Q19=A（「認証者は全件読取」）を **U5 で精緻化**するもの。既存 list 動作（全件）は surveyor について本ルールへ更新する（コード生成で U2 list テストを改訂）。
- **BR-U5-2（PDF 認可, Q-U5-6=C）**: PDF 出力は **admin のみ**。surveyor / viewer / 無ロールは 403。
  - 注: US-701 の想定アクター「調査員/管理者」より厳格化（PII を含む公式様式の配布を管理者に限定する運用判断）。
- **BR-U5-3（CSV 認可, Q-U5-7=A）**: CSV 出力は **admin のみ**。非 admin は 403。
- **BR-U5-4（presigned 前認可）**: PDF/CSV の presigned URL 発行・一覧結果返却の前に必ずサーバ側で認可を確認（fail-closed）。多層防御: API 層（hooks/コントローラのロール強制 L1）＋ UseCase（assertRole L2）。

## PII 取扱い（BR-13 踏襲 / SECURITY-08）
- **BR-U5-5**: 一覧・検索結果は **PII 除外**（`SurveyDto`）。viewer/surveyor/admin とも一覧では PII を返さない。
- **BR-U5-6**: PDF / CSV は admin 限定のため **PII を含む**（被災者氏名・連絡先・住所）。生成物は S3 既定 SSE で at-rest 暗号化（U-Cross/U4 踏襲）。presigned URL は短命。

## フィルタ・検索（US-703 / FR-43 / Q-U5-3=B）
- **BR-U5-7**: フィルタは全て任意・AND 結合。`address` は部分一致（大文字小文字無視）。`status`/`surveyType`/`structureType`/`damageLevel` は対応 enum リストで zod 検証（範囲外は 400）。`createdFrom`/`createdTo` は epoch ms（from ≤ to を検証、違反は 400）。`confirmedOnly=true` は `status='confirmed'` に展開（明示 status と併用時は status 明示を優先 or 競合は 400）。
- **BR-U5-8（ページング, Q-U5-4=A）**: `page≥1`、`1≤pageSize≤100`。既定 `page=1`, `pageSize=20`。範囲外は 400。応答に `total`・`page`・`pageSize` を含める。
- **BR-U5-9（並び順）**: 既定 `createdAt` 降順。

## エクスポート配信（Q-U5-8=B / Q-U5-10=B / Q-U5-2=A）
- **BR-U5-10**: 生成物は非公開 S3 `exports/pdf/{firstSurveyId}-{epoch}.pdf` / `exports/csv/{actorId}-{epoch}.csv` に保存し、presigned GET URL（短命, 既定 15 分）を `ExportTicket` で返す。孤立オブジェクトの TTL クリーンアップは OPERATIONS（範囲外）。
- **BR-U5-11（PDF 単位）**: PDF は **家屋単位**（第1次＋紐づく第2次群を 1 PDF に併記）。エンドポイントの ID は **第1次調査 ID**。第2次 ID 指定・不存在は 404。第2次が無くても第1次のみで生成可。
- **BR-U5-12（CSV 範囲）**: CSV はフィルタ該当の全件（admin 全件対象、ページングなし）。0 件でも **ヘッダ行のみ**の CSV を返す（200）。UTF-8 BOM 付与（Excel 文字化け回避）、RFC4180 準拠エスケープ（カンマ・改行・ダブルクォート）。

## PDF 様式（FR-33 / Q-U5-1=A / Q-U5-11=A）
- **BR-U5-13**: PDF は内閣府 `06_shishin_chosahyo.pdf` の項目構成を参考に、主要セクション（家屋識別／被災者／調査区分／入力値〔第1次: 外力・傾斜・浸水深／第2次: 部位損傷率・階按分〕／損害割合／被害度区分／実施者・日時）を含める。厳密なレイアウト再現は段階的（pdfkit による座標描画、後続で精緻化可）。
- **BR-U5-14**: 日本語フォント（Noto Sans JP もしくは IPAex Gothic, オープンライセンス）を `server/assets/fonts/` に同梱し pdfkit に登録。ライセンス表記を保持。

## 監査（NFR-08 / U-Cross 規約）
- **BR-U5-15**: PDF/CSV 出力を監査記録する。`AUDIT_ACTION_LIST` に `export.pdf` / `export.csv` を追加。PDF は対象 firstSurveyId、CSV は対象件数を summary に記録。一覧・検索（読み取り）は監査対象外（既存方針）。

## エラー処理（U-Cross 規約 / fail-closed）
- **BR-U5-16**: 認可失敗=403、不存在=404、入力検証失敗=400。例外は U-Cross の共通エラーハンドラに委譲（秘匿）。生成（pdfkit/csv）失敗時は 500 とし内部詳細を秘匿。

## 入力検証（SECURITY-05）
- **BR-U5-17**: クエリパラメータ（filter・pagination）は zod で境界・型・enum を検証。文字列は境界付き（`DEFAULT_STRING_MAX`）。`page`/`pageSize` は整数。日付は数値（epoch ms）。
