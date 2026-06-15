# Security Test Instructions

Security Baseline 拡張が有効。横断（U-Cross）・各ユニットのセキュリティ統制を検証する。

## 1. 認証・認可（US-101/102/802 / SECURITY-08）
- 未認証で保護 API（`/api/private/**`）→ **401**。
- ロール不足（viewer/surveyor が admin 操作）→ **403**（UI 非表示に依存しない・fail closed）。
- 他者の調査 ID（IDOR）→ 拒否（surveyor=自分のみ・オブジェクト認可）。
- 検証: `npm run test:server`（U1 認可マトリクス PBT・U2/U4/U5 の 403/404 結合テスト）。

## 2. 入力検証・インジェクション（US-801 / SECURITY-05）
- 全 API 入力は zod で型・範囲・最大長を検証（損傷率/浸水深 0–100%・文字列 `DEFAULT_STRING_MAX`）。範囲外/不正型 → 400。
- SQL は Prisma（パラメタライズド）のみ・raw SQL なし。
- 検証: バリデータ単体テスト＋境界値（U2/U3c/U5）。

## 3. 暗号化（SECURITY-01 / NFR-05）
- **クライアントローカル**: IndexedDB の PII・画像・入力は AES-GCM 256（レコード毎 IV）。鍵はメモリのみ・非永続・ログアウトで再導出不能。検証: `npm run test:client`（暗号往復 PBT・鍵非永続・locked マスク）。手動: ログアウト後/別セッションで旧ローカルデータが復号不能。
- **サーバ at-rest/通信**: S3 既定 SSE・PostgreSQL・TLS（インフラ層）。S3 は非公開＋presigned のみ（PUT15分/GET24h）。
- 同期成功確認後にのみローカル PII/画像を消去（FR-19）。

## 4. 監査ログ（US-803 / NFR-08 / SECURITY-13/14）
- 提出/承認/確定/正式判定/PII 変更/ロール変更/写真確定/エクスポート/認証・認可失敗が `auditLog` に追記専用で記録。
- 監査の `changes` に PII 実体を保存しない（マスク）。stdout ログにも PII/トークン非出力。
- 検証: U-Cross/U2 の監査テスト（INV-A マスク不可逆・INV-D 追記専用）。

## 5. セキュアな既定（US-806 / SECURITY-04/09/15）
- API は helmet（HSTS・nosniff・frameguard）。HTML/CSP は配信層（Next.js/プロキシ）。
- 例外→HTTP マッピング（401/403/404/400/500）で内部詳細・スタックを秘匿（fail closed）。
- デモ用 Task/User は U0 で削除済み。

## 6. 依存性スキャン
```bash
npm audit            # ルート/client/server（既知脆弱性の確認・MVP は既存依存の範囲）
```
- 追加依存はピン留め（idb@8.0.0・fast-check@3.23.2・fake-indexeddb@6.0.0・pdfkit@0.19.1 等）。

## 期待結果
- 認証/認可/検証/暗号/監査の各テストが PASS。手動確認（ローカル暗号・ログアウトクリア・presigned 限定）も設計どおり。継続的スキャン・ペンテストは OPERATIONS。
