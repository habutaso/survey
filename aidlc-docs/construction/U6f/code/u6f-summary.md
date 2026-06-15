# U6f コード生成サマリ（ローカルファースト基盤 / headless）

**ステージ**: CONSTRUCTION → U6f Code Generation（Part 2 実装・完了）
**完了日時**: 2026-06-16T08:10+09:00
**担当ストーリー**: US-204（下書き保存・再開）/ US-207（オフライン入力と提出時同期, クライアント）
**設計**: `construction/U6f/functional-design/*`（Q1〜Q9=A）/ 計画: `construction/plans/U6f-code-generation-plan.md`（全22チェック [x]）

## 概要
ブラウザ IndexedDB に調査下書き・撮影画像・提出キューをオフライン保持し、被災者 PII・画像・入力全体を Web Crypto **AES-GCM 256（レコード毎ランダム IV）** で暗号化。鍵はセッション派生・メモリのみ・非永続（FR-18 と SECURITY-01 §4.3 を両立）。提出は **submission → presigned PUT → photos/confirm** の3段を冪等・段階再開・指数バックオフで実行し、**全段成功確認後にのみローカル PII/画像を消去**（FR-19）。すべて `client/features/localFirst/` の headless 基盤（store/crypto/service/hooks）として実装。UI は U6u。

## 依存（client）
- `idb` を **8.0.0** に pinned 追加（既存の transitive 5.0.6 は modern TS で `DBSchema` 型が `never` に解決され使用不可のため）。
- `fast-check@3.23.2`（server と一致）・`fake-indexeddb@6.0.0` を devDep pinned 追加。
- 新規 `client/vite.config.ts`（`vite-tsconfig-paths` + coverage 100% 閾値・対象は localFirst の model/crypto(draftCrypto)/store/service）。
- 既存の `utils/$path.ts` 未生成（pathpida×next15）でブロックされていた client typecheck を `npm run generate:path` で解消（生成物・ビルド時再生成）。

## 実装ファイル（`client/features/localFirst/`）
- `types.ts` — `LocalDraft`/`DraftInput`/`DraftProgress`/`LocalPhoto`/`SyncJob`/`SyncStage`/`DraftSyncState`/summary 型。
- `crypto/draftCrypto.ts` — `deriveKey`(HKDF→AES-GCM256, extractable=false)/`encryptJson`/`decryptJson`/`encryptBlob`/`decryptBlob`/`encryptBytes`/`decryptBytes`。レコード毎 12B ランダム IV。
- `crypto/sessionKeyProvider.ts` — `SessionKeyProvider` ポート＋`amplifySessionKeyProvider`（fetchAuthSession idToken 由来）。coverage 除外（amplify アダプタ）。
- `model/localDraft.ts` — `createDraft`/`applyUpdate`(deep merge)/`withSyncState`/`addPhotoId`/`removePhotoId`（純粋）。
- `model/toPayload.ts` — `toSubmissionPayload`（区分排他・必須欠落で `IncompleteDraftError`, BR-U6f-11）。
- `model/localPhoto.ts` — `isImageType`/`createLocalPhoto`/`toPhotoMeta`/`withStatus`/`markUploaded`。
- `model/backoff.ts` — `nextDelayMs`/`baseDelayMs`/`shouldRetry`/`MAX_ATTEMPTS=5`（指数・cap30s・jitter±20%）。
- `model/syncJob.ts` — `createJob`/`withStage`/`withTickets`/`withConfirmed`/`recordFailure`/`resetForRetry`/`isExhausted`/`isDue`。
- `store/db.ts` — `LocalDb`（DBSchema）/`openLocalDb`（drafts/photos/syncQueue/meta + index）/`ensureSalt`（salt 永続・非機微）。
- `store/codec.ts` — draft/photo の暗号封入・開封（平文メタ＋`enc` 封筒分離。PII は常に enc 内）。
- `store/localDraftStore.ts` — ファクトリ。鍵キャッシュ＋`LockedError`、CRUD、`purgeLocal`、`clearAll`、`isLocked`。
- `service/networkStatus.ts` — `createNetworkStatus(deps)`（navigator/window は compose 注入）。
- `service/stages.ts` — `runSubmission`/`runPhotosPut`/`runConfirm`（冪等・段階）。
- `service/syncService.ts` — `submit`/`retry`/`processJob`/`drainQueue`、失敗時バックオフ＋状態遷移、done 後 `purgeLocal`（FR-19）。
- `hooks/` — `useLocalDraft`/`useDraftList`/`useSyncOnSubmit`/`useNetworkStatus`（U6u 利用・coverage 除外）。
- `compose.ts` — 既定配線（amplify鍵・aspida submission/confirm・axios presigned PUT・browser network）。coverage 除外。
- `index.ts` — 公開 re-export。

## テスト（`client/tests/localFirst/`・fake-indexeddb + Node WebCrypto + fast-check）
- `draftCrypto.test.ts`（6）: 暗号往復 PBT（JSON/バイナリ, INV-U6f-1/8）・IV 一意（INV-U6f-2）・異鍵復号失敗。
- `model.test.ts`（15）: localDraft/localPhoto/backoff(INV-U6f-6)/syncJob/toPayload（必須欠落の各 throw）。
- `localDraftStore.test.ts`（11）: CRUD・PII 非平文・locked(LockedError, INV-U6f-7)・sorted・purge（job 有/無）・clearAll（fresh/used）・salt 再利用・既定 dbName。
- `networkStatus.test.ts`（1）: online/購読/cleanup。
- `syncService.test.ts`（13）: 3段成功＋purge(INV-U6f-5)・写真ゼロ・段階再開冪等(INV-U6f-4)・失敗バックオフ・上限→failed・retry・drainQueue・missing draft/job・surplus/未確定 photo・非Error分類。

## 検証結果
- `npx tsc --noEmit`（client 全体）: **PASS**（$path 生成後・既存 pathpida ブロック解消）。
- `npx vitest run --coverage`: **6 ファイル / 46 テスト PASS**、対象（model/crypto(draftCrypto)/store/service）**100%**（statements/branches/functions/lines）。
- `npx eslint`（localFirst・tests・vite.config・eslint.config）: **クリーン**。
- eslint: `client/tests/**` に server と同様の緩和（max-lines/max-nested-callbacks/no-non-null-assertion/require-await off）を追加。

## Security Baseline コンプライアンス
- BR-U6f-1: PII・GPS・画像・入力全体を AES-GCM256・レコード毎 IV で暗号化。平文は非 PII メタのみ。
- BR-U6f-2/3/4: 鍵は extractable=false・メモリのみ・salt のみ永続。セッション派生で再読込跨ぎ可、ログアウトで再導出不能＝実質消去。
- BR-U6f-6（FR-19）: 3段成功(`done`)確認後のみ `purgeLocal`。途中失敗では保持。
- BR-U6f-13: エラーは安全な分類（error.name / 'unknown'）のみ保持。PII・トークン・平文をログ出力しない。
- BR-U6f-14: サーバ呼出は aspida（withCredentials）。S3 PUT はサーバ発行 presigned URL のみ。

## PBT コンプライアンス（Full enforcement）
- INV-U6f-1（JSON 往復）・INV-U6f-8（バイナリ往復）を fast-check で検証。INV-U6f-2（IV 一意）・INV-U6f-6（バックオフ単調/上限）も網羅。

## 申し送り
- **U6u**: 本基盤のフック（`useLocalDraft`/`useDraftList`/`useSyncOnSubmit`/`useNetworkStatus`）を用いてウィザード UI・撮影・提出・再開・オフライン表示を構築。ログアウト導線で `localFirst.store.clearAll()` を呼ぶ（Q9=A）。
- **鍵 rotation 注記**: 既定 `amplifySessionKeyProvider` は idToken 由来。導出鍵は store がセッション中メモリ保持するため rotation の影響を受けないが、別タブ/再読込で token 更新後に旧データ復号が必要な高度要件は OPERATIONS で再評価（MVP 範囲外）。
- 本変更は未コミット（コミットはユーザー要求時）。
