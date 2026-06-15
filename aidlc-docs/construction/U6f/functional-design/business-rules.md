# U6f ビジネスルール（ローカルファースト基盤 / headless）

**ステージ**: CONSTRUCTION → U6f Functional Design
**根拠要件**: FR-18・FR-19 / NFR-02 / SECURITY-01・SECURITY-03 / U-Cross BR-11
**設計判断**: 計画 Q1〜Q9＝すべて A

---

## 暗号・鍵ライフサイクル

### BR-U6f-1. ローカル機微データは必ず暗号化（SECURITY-01 / BR-11）
- IndexedDB に保存する **被災者 PII（氏名・連絡先・住所）・GPS 座標・画像バイナリ・下書き入力全体**は、Web Crypto **AES-GCM 256** で暗号化する。
- 暗号化は **レコード毎にランダムな 12 byte IV**（`crypto.getRandomValues`）。IV は封筒（`EncryptedRecord.iv`）に同梱。
- 平文で保存してよいのは PII を含まない最小メタのみ（`id`/`surveyType`/`syncState`/`updatedAt`/`status`/`contentType`/`fileName`/`part`/`step`/`draftId`/`serverPhotoId`）。氏名・連絡先・住所・座標・画像本体は常に暗号化封筒内。

### BR-U6f-2. 鍵はメモリのみ・非永続（SECURITY-01 §4.3）
- 暗号鍵 `CryptoKey` は `extractable: false` で生成し、**メモリ（`DraftKeyState`）のみ**に保持する。
- 鍵を localStorage / sessionStorage / IndexedDB / Cookie に保存しない。
- KDF の **salt** はランダム生成して `meta` store に永続化してよい（salt は非機微。鍵そのものではない）。

### BR-U6f-3. セッション派生・再導出可能（FR-18 と §4.3 の両立 / Q2=A）
- 鍵はセッション由来の key material（`sessionKeyProvider.getKeyMaterial()`）と永続 salt から **HKDF で導出**する。
- アプリ再読込・端末スリープを跨いでも、**セッション有効中は同一鍵を再導出**でき既存ローカルデータを復号できる（FR-18）。
- `sessionKeyProvider` は「セッション有効中は安定値を返し、ログアウト後は取得不能（reject）」を契約とする。

### BR-U6f-4. ログアウト/セッション終了で実質消去（Q9=A / SECURITY-01）
- セッション終了で `sessionKeyProvider` が key material を返せなくなり、鍵を **再導出不能**＝既存暗号データは復号不能（実質消去）。
- メモリ上の鍵は破棄（`DraftKeyState='locked'`）。
- 物理削除が必要な場合は U6u のログアウト導線が `clearAll()`（全 store 削除）を呼ぶ。U6f は手段を提供するが、未同期下書き喪失防止のため**自動物理削除はしない**（保持はするが復号不能）。

### BR-U6f-9. 鍵未取得（locked）時の動作（fail safe）
- 鍵 locked のとき、`getDraft`/`listDrafts` は **暗号フィールドを復号せず**メタのみ返す（`input=null`、UI は「ロック中」表示）。提出・追加は不可。
- 復号失敗（改ざん・鍵不一致）は例外として扱い、当該レコードを「復号不能」とマークして読み飛ばす（他レコードの処理は継続）。秘匿のため詳細をログに出さない。

---

## 下書きライフサイクル

### BR-U6f-5. 自動保存と復元（US-204 / FR-18）
- 入力変更は `updateDraft` で逐次保存（デバウンスは U6u の責務）。`updatedAt` を都度更新。
- 下書きは再読込・再起動・端末スリープを跨いで復元可能（鍵 unlocked 前提）。

### BR-U6f-10. 下書きとサーバ Survey の一致（冪等性 / U2 BR-15）
- `LocalDraft.id` は提出ペイロードの `survey.id`（クライアント採番 ULID）と同一。
- 同一下書きの再提出は同一 ULID で送られ、サーバが upsert で冪等処理する（二重登録なし）。

### BR-U6f-11. 区分排他（INV-4 整合）
- `surveyType='first'` の下書きは `firstSurvey` 素材のみ、`'second'` は `secondSurvey` 素材のみを提出ペイロードに含める（`toSubmissionPayload` で保証）。第2次は `parentSurveyId` 必須。

---

## 提出時同期

### BR-U6f-6. 同期成功確認後にのみローカル消去（FR-19・SECURITY-01）
- 提出同期は **submission → 写真 presigned PUT → photos/confirm** の 3 段が全成功（`SyncJob.stage='done'`）して初めて完了とみなす。
- **`done` 到達後にのみ**、対応する `LocalDraft`（PII）と `LocalPhoto`（画像）を消去する。途中失敗・中断では消去せず保持（喪失防止）。

### BR-U6f-7. 再試行ポリシー（Q6=A）
- 同期失敗は **指数バックオフ**（base 1s・factor 2・cap 30s・jitter ±20%）で最大 **5 回**自動再試行。
- 上限到達で `syncState='failed'`・安全なエラーメッセージを保持し自動再試行を停止。ユーザーの手動 `retry` で `attempts` をリセットし再投入。
- 各段は冪等・段階再開（前段成功分はやり直さない）。

### BR-U6f-8. オフラインキューの永続性（Q5=A / FR-19）
- オフライン時の「提出」は `syncQueue`（IndexedDB）に永続化し、再読込/再起動後もオンライン復帰で自動再開する。
- ネットワーク判定は `navigator.onLine` ＋ `online`/`offline` イベント（Q7=A）。`online` で due なジョブを順次処理。

### BR-U6f-12. 写真アップロードの整合（U4 契約）
- 画像 `contentType` は `image/*` のみ（U4 BR-P15 と整合・送信前検証）。
- presigned PUT は提出応答 `photoUploadTickets`（15 分有効）へ実施。期限切れ・失敗時は当該段から再試行（必要なら submission 再送でチケット再取得）。
- confirm は uploaded 済み `photoId` 群に対して冪等に実行。

---

## セキュリティ・ログ

### BR-U6f-13. ログへの機微出力禁止（SECURITY-03 / SECURITY-14）
- コンソール/エラーレポートに PII・画像・暗号鍵・認証トークン・復号平文を出力しない。
- 同期エラーは安全な分類メッセージ（例: "network", "auth", "server"）のみ保持・表示する。

### BR-U6f-14. 通信は API クライアント経由（既存方針）
- サーバ呼び出しは aspida（`apiClient`, `withCredentials`）経由。S3 への presigned PUT のみ素の fetch/axios を用い、URL はサーバ発行のものに限定する（任意 URL へ送らない）。

---

## 不変条件（テスト対象 / PBT Full enforcement）

- **INV-U6f-1（暗号往復）**: 任意の JSON 値 `v` について `decryptJson(key, encryptJson(key, v)) === v`。
- **INV-U6f-2（IV 一意）**: 連続する暗号化で生成される `iv` が（実用上）衝突しない（毎回ランダム 12B）。
- **INV-U6f-3（鍵非永続）**: 暗号処理後、いかなる Web Storage / IndexedDB にも `CryptoKey`・key material が保存されない。
- **INV-U6f-4（段階再開冪等）**: `processJob` を任意の段で複数回呼んでも、最終状態と副作用回数が単一実行と等価（submission/confirm は冪等、PUT は同一キー上書き）。
- **INV-U6f-5（消去ガード）**: `stage='done'` 未到達では `LocalDraft`/`LocalPhoto` が削除されない。
- **INV-U6f-6（バックオフ単調・上限）**: `nextDelayMs(n)` は n 増加で（jitter 除き）単調増加し `cap` を超えない。`attempts>=5` で自動再試行が停止する。
- **INV-U6f-7（locked マスク）**: 鍵 locked のとき公開 API は暗号フィールド（PII/画像/input）を一切返さない。
- **INV-U6f-8（バイナリ往復）**: 任意の Blob について `decryptBlob(key, encryptBlob(key, b))` がバイト等価。
