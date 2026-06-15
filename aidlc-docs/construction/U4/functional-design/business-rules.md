# U4 ビジネスルール（画像管理）

**ステージ**: CONSTRUCTION → U4 Functional Design

## アクセス制御・セキュリティ（SECURITY-01 / Q-U4-2=A）
- **BR-P1**: S3 バケットは非公開。オブジェクトへのアクセスはサーバ発行の presigned URL（期限付き）経由に限る。公開読み取りは禁止。
- **BR-P2**: presigned URL 発行前に必ずサーバ側で認可を確認する（PUT=submitter かつ所属一致、GET=調査閲覧権限, U1 ロール規約準拠, fail-closed）。
- **BR-P3**: presigned PUT URL の有効期限は 15 分、GET は 24 時間（Q-U4-5=A）。
- **BR-P4**: S3 オブジェクトの at-rest 暗号化はインフラ層（バケット既定 SSE）に委譲（SECURITY-01）。アプリ層はキー・メタのみ管理。

## キー・識別（Q-U4-5=A）
- **BR-P5**: S3 キーは `surveys/{surveyId}/{photoId}` の決定論的形式。`photoId` は ULID で衝突なし（INV-P2）。
- **BR-P6**: `photoId` はサーバ採番（クライアント提示値は信頼しない）。

## アップロード整合（Q-U4-4=B / 確認方式）
- **BR-P7**: 提出時、写真メタは `status='pending'` で作成される。アップロード本体はクライアントが presigned PUT で S3 へ直接行う。
- **BR-P8**: クライアントは確認 API で `pending → uploaded` へ遷移させる。確認は冪等（既に uploaded は no-op、エラーにしない）。
- **BR-P9**: `status='pending'` の写真は閲覧 URL を発行しない・一覧に含めない（INV-P3 / fail-closed）。アップロード未完了・失敗の不可視化。
- **BR-P10**: 確認対象 `photoId` は当該 `surveyId` 所属に限る。所属外は拒否（404/403）。

## 紐付け（Q-U4-3=C）
- **BR-P11**: 写真は調査（必須）・部位（任意）・ステップ（任意）に紐付く。全体写真は part/step とも null 可（INV-P4）。
- **BR-P12**: `part` を指定する場合、第2次の `PartDamage.part` と同じ部位語彙を用いる（表示・集計整合）。検証は緩く（自由文字列, U3c の部位マスタは判定計算のみに適用）、未知部位でも保存は許容（写真は判定計算に影響しないため）。

## 削除・ライフサイクル
- **BR-P13**: 調査削除時、関連 Photo は Cascade で DB から削除される。S3 オブジェクトの削除は本ユニットでは扱わない（将来の運用/バッチ。`s3.delete` は利用可能）。

## 監査（NFR-08 / U-Cross 規約）
- **BR-P14**: 写真登録は調査提出イベントに包含し件数を記録。アップロード確認は `photo.uploadConfirmed`（対象件数）を記録。認可失敗は U-Cross の認可監査に従う。

## バリデーション
- **BR-P15**: `contentType` は画像 MIME（`image/*`）に限定。`fileName` は境界付き文字列。範囲外は 400（ValidationError）。
