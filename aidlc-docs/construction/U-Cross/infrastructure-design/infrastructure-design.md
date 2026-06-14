# U-Cross インフラストラクチャ設計（軽量 / Infrastructure Design - Light）

Q15=A に基づく軽量実行。デプロイは既存単一 Docker コンテナー＋マネージドサービスを踏襲（UG1=A）。IaC 未導入のため posture（方針）を文書化するに留め、コード成果物は最小限。

## 1. デプロイ形態（踏襲）
- 単一 Docker コンテナー内のモノリス。U-Cross は論理モジュール（独立デプロイなし）。
- ローカル開発/テストは `compose.yml`（postgres / magnito[Cognito] / minio[S3] / inbucket[SMTP]）。

## 2. 保存時暗号化（at-rest, SECURITY-01 / Q12=A）— インフラ層で担保
| データストア | 暗号化方針 | 担保レイヤ | 備考 |
|---|---|---|---|
| PostgreSQL | 保存時暗号化（マネージド DB のディスク/ボリューム暗号化、例: RDS storage encryption / KMS） | インフラ（運用） | アプリ層フィールド暗号化は行わない。アクセス制御＋at-rest で保護。 |
| S3（画像） | 既定の SSE（SSE-S3 / SSE-KMS） | インフラ（バケット設定） | U4 が画像メタ＋本体を扱う。バケットは非公開既定。 |
| 監査ログ（`auditLog`） | PostgreSQL 上のため上記 at-rest に従う | インフラ | 追記専用運用（BR-1）＋DB 権限で保護。 |
> 本リポジトリにはコード変更を伴わない（設定/運用で適用）。ローカル開発の minio/postgres は暗号化未適用でも可（本番設定で担保）。

## 3. 通信時暗号化（in-transit, SECURITY-01 / Q12=A）
- クライアント↔サーバ、サーバ↔外部（Cognito/S3）は **TLS 強制**（本番のロードバランサ/リバースプロキシ終端）。
- アプリは TLS 前提で動作（HSTS は helmet で付与, BR-8）。

## 4. セキュリティヘッダ posture（SECURITY-04 / Q9=A）
- API サーバ（Fastify）: `helmet` 既定＋強化（HSTS / noSniff / frameguard 等）。
- HTML（CSP）: Next.js（U6u）側で付与。prod は `@fastify/http-proxy` が `content-security-policy` を除去するため、CSP はフロント配信側で一元付与する設計と整合。

## 5. 監査ログの保護・アクセス（NFR-08 / SECURITY-13・14 / Q1=A, Q6=A）
- 追記専用運用（アプリは INSERT のみ）。`auditLog` への UPDATE/DELETE はアプリ経路に存在させない。
- DB レベルのアクセス制御（将来: 監査専用ロール/権限分離は OPERATIONS で具体化）。
- 保持は恒久（MVP, Q6=A）。アーカイブ/ローテーションは OPERATIONS。

## 6. アクセスログ / 構造化ログ（SECURITY-03/14）
- アプリログ（stdout）は構造化を志向し、PII・認証トークンを出力しない。
- 監査ログ（業務的追跡）とアプリログ（技術的観測）は別系統。アラート連携は OPERATIONS へ保留（Q5=A）。

## 7. 依存・サプライチェーン（SECURITY-10, 参考）
- ロックファイル（`package-lock.json`）固定、Docker イメージは固定タグ（compose は固定タグ使用済み）。
- U-Cross は新規ランタイム依存を増やさない見込み（監査=Prisma、検証=zod、暗号化標準=ブラウザ Web Crypto[実装U6f]）。

## 8. コード成果物への影響（まとめ）
- **コード変更あり**: 監査ドメイン（Prisma `AuditLog` モデル＋マイグレーション）、helmet 強化、グローバルエラーハンドラ精緻化。
- **コード変更なし（設定/運用）**: PG/S3 の at-rest 暗号化、TLS 終端、監査 DB 権限分離、ログ基盤/アラート。
- これらは Code Generation 計画（`U-Cross-code-generation-plan.md`）と Build and Test で扱う。
