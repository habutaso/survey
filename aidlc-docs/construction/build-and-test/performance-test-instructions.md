# Performance Test Instructions

MVP の性能関心は限定的（小〜中規模の自治体現場利用）。要件 NFR-02（オフライン継続）・NFR-03（一覧の応答性）・NFR-04（計算の決定論性・正確性）を対象とする。

## 性能要件（目標）
- **一覧/検索（NFR-03 / US-703）**: 多数調査でも応答性よく表示（目安: 1万件規模で一覧 API < 500ms / p95）。検索列にインデックス済み（`Survey` の status/surveyType/createdBy/createdAt, migration `add_survey_search_indexes`）＋オフセットページング（pageSize≤100）。
- **計算（NFR-04 / US-401/604/805）**: 同一入力で同一結果（決定論）。PBT で検証済み。
- **オフライン（NFR-02 / US-207）**: 通信断でも入力・撮影・キューイングが継続。

## セットアップ
```bash
docker compose up -d
npm run migrate:deploy --prefix server
# 計測用に調査データを投入（seed 拡張 or スクリプトで Survey を大量生成）
```

## 実行

### 1. 一覧 API 負荷（NFR-03）
- ツール例: `k6` / `autocannon` を `GET /api/private/surveys?page=1&pageSize=20`（認証 Cookie 付き）に対して実行。
```bash
# 例: autocannon -c 20 -d 30 -H "Cookie: <session>" "http://localhost:3000/api/private/surveys?page=1&pageSize=20"
```
- フィルタ別（status/address/createdFrom-To）でも計測。
- **確認**: p95 応答時間・スループット・エラー率。インデックス有効性（EXPLAIN）。

### 2. 計算の決定論性（NFR-04）
- 同一 `SubmissionPayload` を複数回提出 → 損害割合・6区分が常に一致。
- 既存 PBT（`server` の U3c INV-1〜8）で網羅。回帰時は `npm run test:server`。

### 3. オフライン同期（NFR-02）
- DevTools Offline で入力継続 → キュー滞留 → 復帰で全件同期完了する所要時間と成功率。
- 写真枚数（例: 1部位×複数枚）増加時の presigned PUT 並列/直列の所要を観測。

## 結果分析
- **応答時間 / スループット / エラー率**: 目標との対比。
- **ボトルネック**: DB クエリ（インデックス未使用・N+1）、S3 presigned 発行、Cognito 検証。
- 未達時: クエリ最適化（インデックス/選択列）、ページング上限見直し、写真アップロードの並列度調整。再計測。

## 注記
- 本番スケール・SLA の確定、継続的負荷監視は **OPERATIONS フェーズ**で具体化（本書は MVP の指針）。
