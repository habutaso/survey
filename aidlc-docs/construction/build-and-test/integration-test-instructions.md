# Integration Test Instructions

ユニット間の相互作用を検証する。サーバ側の結合は API テスト（Docker Compose 上の実 PostgreSQL / Cognito エミュレータ / MinIO）で既に網羅。クライアント⇔サーバの結合は aspida 共有型（契約）＋手動 E2E で検証する。

## 自動結合テスト（サーバ・実装済み）
`server/tests/api/private/surveys.test.ts` ほかが、複数ユニットを跨ぐ実フローを検証:
- **U2×U1×U-Cross**: 提出 → 認可（ロール）→ 監査記録（同一トランザクション）。
- **U2×U3a/U3b/U3c**: 提出時にサーバ再計算（`assessmentPort` 本実装）で損害割合・6区分を確定。
- **U2×U4**: 提出応答に presigned PUT チケット → confirm（pending→uploaded・冪等）→ 閲覧（uploaded のみ）。
- **U2×U5**: 検索/一覧（ロールスコープ・ページング）・家屋単位 PDF・CSV（S3 presigned）。

### 実行
```bash
docker compose up -d
npm run migrate:deploy --prefix server
npm run test:server         # 結合シナリオ含む（vitest, retry:2, testTimeout 30s）
```
- **期待**: 全 PASS、カバレッジ 100%。ログは vitest 出力。
- **クリーンアップ**: `docker compose down`（テスト DB/バケットは破棄可）。

## クライアント⇔サーバ契約結合
- **型契約**: `client/api`・`client/common` は `server` のシンボリックリンク。`npm run generate` 後、client の `tsc` が aspida 型でエンドポイント整合を**コンパイル時に保証**（`SubmissionPayload`/`SurveyListResult`/`HouseResultsDto`/`ExportTicket` 等）。
  ```bash
  npm run generate && npm run typecheck   # 契約不整合はここで検出
  ```

## 手動 E2E シナリオ（ローカル: `npm run notios`）
ブラウザ `http://localhost:3000`、メールは Inbucket `http://localhost:2501`。

### シナリオ1: 第1次調査の作成→提出→承認→確定（U6u×U6f×U2×U1×U4×U5）
1. アカウント作成/ログイン（admin に surveyor ロール付与済みを使用）。
2. 「新規調査」→ ウィザードで家屋情報・被災者 PII・外力/傾斜/浸水深・写真添付・（多層なら）階按分を入力。各入力が IndexedDB に保存されること（再読込で復元）。
3. 「提出」→ submission POST → 写真 presigned PUT → confirm の3段が完了し、ローカル下書き/画像が消去されること（FR-19）。
4. 一覧で当該調査が「提出」状態。詳細で損害割合・6区分がサーバ算出値で表示。
5. admin で「承認」→「確定」。状態遷移が反映され監査記録されること。

### シナリオ2: オフライン入力と復帰同期（U6f / US-207 / NFR-02）
1. DevTools で Offline に切替。NetworkBanner が表示されること。
2. 入力・撮影を継続（ローカル保存）。「提出」→ キュー化（状態=送信待ち）。
3. Online に復帰 → 自動再開で同期完了（状態=同期完了→消去）。

### シナリオ3: 第2次調査・正式判定・出力（U6u×U2×U5 / US-601/606/701/702）
1. 確定済み第1次の結果画面から「第2次調査を開始」→ parentSurveyId 引継ぎで作成・提出。
2. 家屋結果で第1次/第2次が併記。admin が「正式判定に選択」。
3. admin が「PDF 出力」「CSV 出力」→ presigned URL が新規タブで開くこと。

### シナリオ4: 認可（多層 / US-102/802）
1. viewer/surveyor で admin 専用操作（承認/確定/正式判定/PDF/CSV）が UI 非表示かつ**サーバで 403**。
2. 他者の調査 ID へ直接アクセス時、権限外は拒否（surveyor=自分のみ）。

### シナリオ5: ログアウト時クリア（US-103 / 共用端末）
1. 下書きがある状態でサインアウト → `localFirst.store.clearAll()` でローカル削除、再ログイン後に残留しないこと。

## 期待結果
- 全シナリオで状態遷移・同期・認可・出力が設計どおり。失敗時はサーバログ（stdout・PII 非出力）と監査ログ（`auditLog`）で追跡。
