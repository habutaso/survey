# Unit Test Execution

各ユニットの単体テストは Code Generation で生成済み（vitest）。サーバは Docker Compose 必須、クライアントは不要。

## 事前準備
```bash
docker compose up -d        # server テスト用: postgres / magnito / minio / inbucket
npm run migrate:deploy --prefix server   # テスト DB スキーマ（test DB へ）
```
> server の `vite.config.ts` は `DATABASE_URL` の DB 名を `test` に・`S3_BUCKET` を `*-test` に差し替えて実行。

## 1. 全単体テストの実行
```bash
npm test                    # = test:client + test:server（run-p）
# 個別:
npm run test:server         # vitest run --coverage（Docker 必須）
npm run test:client         # vitest run --coverage（fake-indexeddb + Node WebCrypto, Docker 不要）
```

## 2. 期待結果（カバレッジ閾値 100%）

### サーバ（`server`）
- **テスト数**: 24 ファイル / 201+ テスト PASS（U5 時点。U6 はサーバ変更なし）。
- **カバレッジ**: **All files 100%**（statements/branches/functions/lines）。対象 = `domain/**`・`common/**`・`api/**/{controller,hooks,validators}.ts`（`service/pdfRenderer.ts` 等の副作用境界は include 対象外）。
- **PBT**: fast-check（U1 認可マトリクス・U2 状態遷移/往復・U3c 計算不変条件 INV-1〜8・U4 INV-P1/P3・U5 CSV 可逆/スコープ）。

### クライアント（`client`）
- **テスト数**: 8 ファイル / 61 テスト PASS。
- **カバレッジ**: **100%**（対象 = `features/localFirst/{model,crypto/draftCrypto.ts,store,service}/**` ＋ `features/survey/model/**`）。React コンポーネント（.tsx）・hooks・compose・amplify アダプタは coverage 対象外（Q8=A・tsc/eslint で担保）。
- **PBT**: 暗号往復（JSON/バイナリ INV-U6f-1/8）・IV 一意（INV-U6f-2）・バックオフ単調/上限（INV-U6f-6）・ウィザードステップ整合（INV-U6u-1〜4）。

## 3. 付随チェック
```bash
npm run typecheck           # typecheck:client(hcm+tsc) + typecheck:server(tsc)
npm run lint                # eslint + stylelint + prettier + server prisma format
```
- いずれも **エラー 0** が期待値。

## 4. 失敗時の対応
1. `docker compose ps` でサービス稼働を確認（server テストの transient 失敗は magnito 負荷由来のことがあり、`retry: 2` で吸収。決定論的失敗はロジック不具合）。
2. 失敗テストの出力（vitest レポート）を確認し、該当コード/テストを修正。
3. カバレッジ閾値未達（threshold エラー）は、対象モジュールに未到達分岐がある合図。テストを追加して 100% へ。
4. `npm test` を再実行し全 PASS を確認。
