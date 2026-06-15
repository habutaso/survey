# U6f コード生成プラン（ローカルファースト基盤 / headless）

**ステージ**: CONSTRUCTION → U6f Code Generation
**配置先**: `client/features/localFirst/`（アプリコード）／ `client/tests/localFirst/`（テスト）
**設計**: `construction/U6f/functional-design/*`（Q1〜Q9=A）
**DI 方式**: 軽量ファクトリ関数（client に velona 未導入のため。ポートは引数注入でテスト時スタブ化）

## 依存・設定
- [x] 1. `idb`（既存・client）使用。`fast-check@3.23.2`・`fake-indexeddb@6.0.0` を devDep pinned 追加（済）。
- [x] 2. `client/vite.config.ts` 新規（`vite-tsconfig-paths`＋coverage: `features/localFirst/{model,crypto/draftCrypto.ts,store,service}/**` を 100% 閾値、`tests/localFirst/setup.ts` で `fake-indexeddb/auto`）。

## 型・純粋ロジック（100% カバレッジ対象）
- [x] 3. `features/localFirst/types.ts` — `LocalDraft`/`LocalPhoto`/`SyncJob`/`EncryptedRecord`/`DraftInput`/`DraftProgress`/`DraftSyncState`/`SyncStage`/summary 型。
- [x] 4. `model/localDraft.ts` — `createDraft`/`applyUpdate`/`toSubmissionPayload`（区分排他・第2次 parentSurveyId 必須, BR-U6f-11）。純粋。
- [x] 5. `model/localPhoto.ts` — `createLocalPhoto`/`toPhotoMeta`/`isImageType`/状態遷移。純粋。
- [x] 6. `model/backoff.ts` — `nextDelayMs`（指数・cap・jitter）/`shouldRetry`（INV-U6f-6）。純粋（jitter は注入乱数）。
- [x] 7. `model/syncJob.ts` — `createJob`/`advanceStage`/`recordFailure`/`nextDueJobs`。純粋。

## 暗号（100% カバレッジ対象 = draftCrypto のみ）
- [x] 8. `crypto/draftCrypto.ts` — `deriveKey`(HKDF→AES-GCM256, extractable=false)/`encryptJson`/`decryptJson`/`encryptBlob`/`decryptBlob`（レコード毎ランダム IV, BR-U6f-1）。
- [x] 9. `crypto/sessionKeyProvider.ts` — `SessionKeyProvider` ポート＋`amplifySessionKeyProvider`（fetchAuthSession idToken 由来・メモリ鍵）。**coverage 除外**（amplify アダプタ）。

## ストア（100% カバレッジ対象）
- [x] 10. `store/localDraftStore.ts` — `idb` ラッパ・ファクトリ。`drafts`/`photos`/`syncQueue`/`meta` の CRUD、暗号封入/開封、鍵キャッシュ＋salt 永続、`isLocked`/`purgeLocal`/`clearAll`。

## サービス（100% カバレッジ対象）
- [x] 11. `service/networkStatus.ts` — `createNetworkStatus(deps)`（getOnline/add/removeListener 注入）。既定は navigator+window。
- [x] 12. `service/syncService.ts` — `createSyncService({ store, submit, putObject, confirm, now, rng })`。3段オーケストレーション（submission→PUT→confirm→done→purge, 段階再開・冪等 INV-U6f-4/5）、`processJob`/`submit`/`retry`/`drainQueue`。

## フック（coverage 除外・U6u 結合）
- [x] 13. `hooks/useLocalDraft.ts`・`hooks/useDraftList.ts`・`hooks/useSyncOnSubmit.ts`・`hooks/useNetworkStatus.ts`。
- [x] 14. `compose.ts`（既定依存配線）・`index.ts`（公開 re-export）。

## テスト（fake-indexeddb + Node WebCrypto + fast-check）
- [x] 15. `tests/localFirst/setup.ts`（`import 'fake-indexeddb/auto'`）。
- [x] 16. `draftCrypto.test.ts` — PBT 暗号往復(JSON/Blob)・IV 一意（INV-U6f-1/2/8）。
- [x] 17. `localDraft.test.ts`・`localPhoto.test.ts`・`backoff.test.ts`(PBT 単調・上限)・`syncJob.test.ts`。
- [x] 18. `localDraftStore.test.ts` — CRUD・暗号往復・locked マスク・purge ガード・clearAll（INV-U6f-5/7）。
- [x] 19. `networkStatus.test.ts`・`syncService.test.ts` — 3段成功/段階再開/失敗バックオフ/done後purge/写真ゼロ（INV-U6f-4/5）。

## 検証
- [x] 20. 対象ファイル `tsc --noEmit`（client 全体は既存 pathpida×next15 で別途ブロックのため、U6f ファイル単位で型確認）。
- [x] 21. `npm test`（client・vitest run --coverage）= localFirst 対象 100%。
- [x] 22. `eslint` 変更ファイル クリーン。サマリ `construction/U6f/code/u6f-summary.md`。
