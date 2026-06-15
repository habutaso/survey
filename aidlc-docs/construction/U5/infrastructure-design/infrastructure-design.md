# U5 インフラストラクチャ設計（軽量 / Infrastructure Design - Light）

**ステージ**: CONSTRUCTION → U5 Infrastructure Design
Q15=A（軽量）/ UG1=A（既存単一コンテナー＋マネージドサービス踏襲）。IaC 未導入のため posture を文書化し、コード成果物は最小（`s3.putBuffer` 追加・DB インデックス・フォント同梱）。U-Cross §2（S3 SSE）・U4（presigned posture）を前提に U5 固有を補足する。

## 1. 検索性能（NFR-03）— DB インデックス
- 一覧・検索（`surveyQuery.search`）の応答性確保のため `Survey` に**加法的インデックス**を追加（マイグレーション, 既存データ非破壊）:
  - `@@index([status])` / `@@index([surveyType])` / `@@index([createdBy])` / `@@index([createdAt])`
  - 既存の `parentSurveyId`/`officialSurveyId` 等は U2 で付与済みのものを踏襲。
  - 複合の最適化（例 `[status, createdAt]`）は実データ分布を見て OPERATIONS で調整可。MVP は単一列インデックス＋オフセットページング（pageSize≤100）で充足。
- `address` 部分一致（`contains`）はインデックス非効率だが、中規模（NFR-03）かつ他フィルタとの AND 併用で実用範囲。全文検索は範囲外（将来）。

## 2. オブジェクトストレージ（生成物の一時保存, Q-U5-8=B）
- 既存**非公開バケット**（U4/BR-P1 踏襲）を流用。新規バケット追加なし。
- キー名前空間: `exports/pdf/{firstSurveyId}-{epoch}.pdf` / `exports/csv/{actorId}-{epoch}.csv`。`exports/` プレフィックスで生成物を区画化。
- **at-rest 暗号化**: バケット既定 SSE（U-Cross §2 / SECURITY-01 踏襲）。CSV/PDF は PII を含むため SSE 必須。
- アプリは既存 IAM クレデンシャル（`S3_*`）で署名。

## 3. presigned URL posture
| 用途 | コマンド | 有効期限 | 発行条件 |
|---|---|---|---|
| エクスポート閲覧/DL | `GetObjectCommand` | 15 分（短命） | サーバ認可後（PDF=admin / CSV=admin, BR-U5-2/3/4） |
- 生成物は presigned GET でのみ取得可能。URL はキー固定で対象オブジェクト以外に使えない。短命化で漏洩リスク低減。
- アップロード（生成物の格納）はサーバ内から `PutObjectCommand`（`s3.putBuffer`）で直接実施（クライアント直 PUT ではないため CORS 不要）。

## 4. CORS
- U5 のダウンロードは presigned **GET** をブラウザが取得する形。バケット CORS の AllowedMethods に `GET` が含まれていれば足りる（U4 で PUT/GET を設定済みの前提）。U5 で追加の CORS 変更は不要。

## 5. 日本語フォント同梱（Q-U5-11=A / デプロイ整合）
- `server/assets/fonts/` にオープンライセンスフォント（Noto Sans JP もしくは IPAex Gothic）を同梱しリポジトリに含める。`Dockerfile` のビルド成果物に `assets/` が含まれることを確認（コピー対象に追加が必要なら Build and Test / デプロイ手順に明記）。
- フォントのライセンス表記を `server/assets/fonts/LICENSE` に保持。

## 6. ローカル開発整合（MinIO）
- 既存 `compose.yml` の minio（9000/9001）と `S3_*` を流用。`exports/` プレフィックスは自動生成（事前作成不要）。テストは `tests/setup.ts` の S3 前提に従い、`afterEach` の S3 クリーンアップ対象に `exports/` も含まれることを確認。

## 7. ライフサイクル / 削除
- 生成物（`exports/`）は一時的。孤立オブジェクトの TTL 削除（例 24h ライフサイクルルール）は **OPERATIONS で具体化**（本ユニット範囲外。`s3.delete` 利用可）。

## 8. コード成果物への影響（まとめ）
- **コード変更あり**: `service/s3Client.ts` に `putBuffer(key, body: Buffer, contentType)` 追加。`prisma/schema.prisma` に `Survey` の検索用インデックス追加＋マイグレーション。`server/assets/fonts/` にフォント同梱。
- **コード変更なし（設定/運用）**: バケット非公開・SSE・CORS（既存）・ライフサイクル。本番は IaC/コンソール、ローカルは MinIO。
- 新規ランタイム依存: `pdfkit`（PDF 生成, Q-U5-1=A）。CSV は自前生成（依存追加なし, Q-U5-2=A）。`@aws-sdk/client-s3`/`s3-request-presigner` は既存。
