# U4 インフラストラクチャ設計（軽量 / Infrastructure Design - Light）

**ステージ**: CONSTRUCTION → U4 Infrastructure Design
Q15=A（軽量）/ UG1=A（既存単一コンテナー＋マネージドサービス踏襲）。IaC 未導入のため posture を文書化し、コード成果物は最小（`s3.putSignedUrl` 追加のみ）。U-Cross インフラ設計（§2 S3 SSE）を前提に U4 固有の posture を補足する。

## 1. オブジェクトストレージ（S3 / Cloudflare R2）
- **非公開バケット**（BR-P1）。パブリックアクセスブロックを有効化。ACL 無効（bucket owner enforced）。
- アクセスは**サーバ発行の presigned URL のみ**（BR-P2）。アプリは IAM クレデンシャル（`S3_ACCESS_KEY`/`S3_SECRET_KEY`）で署名。
- **at-rest 暗号化**: バケット既定 SSE（SSE-S3 もしくは SSE-KMS）をインフラ層で有効化（SECURITY-01 / U-Cross §2 踏襲）。アプリ層フィールド暗号化は行わない。
- キー名前空間: `surveys/{surveyId}/{photoId}`（Q-U4-5=A / BR-P5）。プレフィックス `surveys/` で調査画像を区画化。

## 2. presigned URL posture
| 用途 | コマンド | 有効期限 | 発行条件 |
|---|---|---|---|
| アップロード | `PutObjectCommand` | 15 分（BR-P3） | submitter かつ所属一致（サーバ認可後） |
| 閲覧 | `GetObjectCommand` | 24 時間（既存ヘルパー） | 調査閲覧権限あり かつ `status='uploaded'`（INV-P3） |
- 期限は最小権限の原則に沿い、PUT は短命。URL にはメソッド・キーが固定され、対象オブジェクト以外には使えない。

## 3. CORS（クライアント直アップロードの要件）
- presigned PUT はブラウザから S3/R2 へ**直接** PUT するため、バケットに **CORS 設定**が必要:
  - AllowedMethods: `PUT`, `GET`
  - AllowedOrigins: フロントエンドのオリジン（本番ドメイン / ローカル `http://localhost:3000`）
  - AllowedHeaders: `content-type` 等、ExposeHeaders: 最小限
- **ローカル（MinIO）**: 既存 `compose.yml` の minio に対し、開発用 CORS/バケット作成を整合させる（バケットは `S3_BUCKET`、`forcePathStyle: true` は既存 s3Client で設定済み）。本番（S3/R2）は IaC/コンソールで同等設定。

## 4. ローカル開発整合（MinIO）
- 既存 `compose.yml` の minio（9000/9001）と `S3_*` 環境変数を流用。U4 で新規サービス追加なし。
- バケット未作成環境では初回作成が必要（既存運用に準拠。テストは `tests/setup.ts` の S3 前提に従う）。
- presigned URL のホストは `S3_ENDPOINT`（署名）/ 閲覧表示は `S3_PUBLIC_ENDPOINT` 経由のため、ローカルとデプロイでエンドポイント差異を環境変数で吸収。

## 5. ライフサイクル / 削除
- 調査削除時の DB 側 Photo は Cascade 削除（BR-P13）。S3 オブジェクトの削除/ライフサイクルルール（孤立 `pending` の TTL 削除等）は **OPERATIONS で具体化**（本ユニット範囲外。`s3.delete` は利用可能）。
- `pending` のままアップロードされなかったオブジェクトは S3 に存在しない（PUT 未実行）。DB の孤立 `pending` レコードのクリーンアップは将来運用。

## 6. コード成果物への影響（まとめ）
- **コード変更あり**: `service/s3Client.ts` に `putSignedUrl` 追加（`PutObjectCommand` + presigner, 15分）。
- **コード変更なし（設定/運用）**: バケット非公開・SSE・CORS・パブリックアクセスブロック・ライフサイクル。これらは本番は IaC/コンソール、ローカルは MinIO セットアップで適用。
- 新規ランタイム依存なし（`@aws-sdk/client-s3` / `s3-request-presigner` は既存）。
