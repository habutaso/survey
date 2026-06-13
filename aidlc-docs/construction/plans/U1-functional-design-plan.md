# U1 — 機能設計計画（Functional Design Plan: 認証・ユーザー/ロール基盤）

本計画は U1 の機能設計の**単一の真実の源**です。下部の質問（`[Answer]:`）にすべてご回答いただいた後、アーティファクトを生成します。

## ユニット・コンテキスト
- **ユニット**: U1 — 認証・ユーザー/ロール基盤
- **責務**: Cognito 連携認証（既存踏襲）、利用者解決（findOrCreateUser）、ロール（調査員/管理者/閲覧者）保持、認可基盤（`api/private/hooks` L1 ＋ Model 層 `assert*` L2 の土台）。
- **依存**: U0 完了（前提）。後続 U-Cross / U2 以降が本ユニットの認可基盤を利用。
- **担当ストーリー**: US-101, US-102, US-103, US-802
- **関連要件**: FR-40〜43 / SECURITY-08 / AD6（多層防御）
- **既存資産（Brownfield）**:
  - `server/domain/user/`（userUseCase.findOrCreateUser / userMethod.create / userQuery / userCommand / toUserDto）
  - `server/api/private/hooks.ts`（JWT 検証 → `req.user` 注入）
  - `server/service/cognito.ts`（getUser 等）
  - `server/common/types/user.ts`（UserBase / UserDto — 現状ロールなし）
  - `server/prisma/schema.prisma`（model User — 現状ロール列なし）

---

## ステージ評価（U1）
| ステージ | 判定 | 理由 |
|---|---|---|
| Functional Design | **EXECUTE** | ロール・認可のドメインロジック／ビジネスルールを確定する必要がある（本計画） |
| NFR Requirements | SKIP | セキュリティ・ベースライン採用済み、U1 固有の新規 NFR なし（認可は SECURITY-08 に準拠） |
| NFR Design | SKIP | 同上 |
| Infrastructure Design | SKIP | インフラ変更なし（Cognito は既存／IdP のロール設定は運用領域） |
| Code Generation | EXECUTE | 機能設計承認後に別計画で実施 |

> 監査ログ基盤そのもの（認証認可失敗の記録実体）は **U-Cross** の責務。U1 は認可の強制点（hooks / assert*）と「どこで失敗イベントが発生するか」を定義し、記録呼び出しの接続は U-Cross 構築時に行う。

---

## 設計ステップ（質問確定後に実行）
- [x] Step A: ロール・モデル（`Role` 値・表現・単複）の確定 → `domain-entities.md`
- [x] Step B: User エンティティのロール拡張（UserBase/Dto/Entity・Prisma 列・toUserDto）設計 → `domain-entities.md`
- [x] Step C: ロール解決ロジック（`resolveRole(claims)`／findOrCreate へのロール付与）設計 → `business-logic-model.md`
- [x] Step D: 認可ヘルパー（`assertRole` / `assertOwnerOrRole`）のシグネチャ・失敗時挙動設計 → `business-logic-model.md`
- [x] Step E: ロール×操作の権限マトリクス（FR-42）と既定拒否ポリシー → `business-rules.md`
- [x] Step F: 多層防御の強制点（L1 hooks / L2 Model assert）と責務分担 → `business-logic-model.md`
- [x] Step G: エラー/エッジケース（未知ロール・claims 欠落・トークン失効）処理 → `business-rules.md`
- [x] Step H: テスト方針（PBT 全面適用＝認可マトリクスの不変条件）→ 各アーティファクトに付記

---

## 確認事項（Questions）

> 各 `[Answer]:` の後に回答（選択肢の記号や自由記述）をご記入ください。推奨案には「推奨」と明記しています。判断に迷う場合は推奨案で問題ありません。

### Q1. ロールの真実の源（Source of Truth）
ロールをどこで管理しますか。
- **A**: Cognito（グループ/属性）を唯一の真実の源とし、リクエスト毎に claims から解決。DB には保存しない。
- **B**: DB の `User.role` を真実の源とし、Cognito は認証のみ。ロール割当はアプリ運用で。
- **C（推奨）**: ハイブリッド。Cognito を真実の源とし、`findOrCreate` 時に `User.role` へ同期保存（監査・一覧・検索で参照、毎回 claims に依存しない）。

[Answer]: B

### Q2. Cognito 側のロール表現
Q1 で A または C の場合、Cognito 上のロール保持方式は？
- **A（推奨）**: Cognito Groups（`cognito:groups` クレーム）
- **B**: カスタム属性（`custom:role`）
- **C**: 未定（IdP 設計は後続）。当面は Groups 前提で実装し、解決ロジックを差し替え可能にする。

[Answer]: 

### Q3. 1ユーザーあたりのロール数
- **A（推奨）**: 単一ロール（FR-42 の3区分に対応、最も単純・明確）
- **B**: 複数ロール可（例: 管理者かつ調査員）。判定は「いずれかが許可」で行う。

[Answer]: B

### Q4. ロール未割当ユーザーの既定挙動
`findOrCreate` 時にロール情報が無い（どのグループにも属さない）場合は？
- **A（推奨・fail-safe）**: 最小権限の「閲覧者(viewer)」を既定とする。
- **B**: ロールなし（全操作を既定拒否。明示割当まで参照含め不可）。
- **C**: アクセス拒否（403、ユーザー作成もしない）。

[Answer]: B

### Q5. ロールの内部表現（命名）
- **A（推奨）**: 英語 enum（`surveyor` / `admin` / `viewer`）＋表示名マップ（調査員/管理者/閲覧者）で分離。
- **B**: 日本語識別子をそのまま使用。

[Answer]: A

### Q6. 認可違反時の挙動（多層防御の失敗時）
`assertRole` / `assertOwnerOrRole` 違反時は？
- **A（推奨）**: ドメイン例外を投げ、共通エラーハンドラが 403 に変換（詳細・PII を秘匿、fail closed）。
- **B**: 各 hooks/usecase で個別に `res.status(403)` を返す。

[Answer]: A

### Q7. 閲覧者(viewer)の参照範囲
- **A（推奨）**: 全調査を参照可（自治体担当者として全件閲覧。現データモデルに自治体スコープ無しのため単純）。
- **B**: 担当範囲（自治体等）のみ。→ スコープ属性の追加が必要（要件・データ拡張）。

[Answer]: A

### Q8. オブジェクトレベル認可の「所有者」定義（FR-43）
調査員が編集できる対象の所有権モデルは？（実体の強制は U2 だが、U1 で `assertOwnerOrRole` の意味を定義）
- **A**: `Survey.createdBy`（作成した調査員）のみ＝厳格な所有者制。
- **B（推奨）**: 調査員は提出前（下書き）の調査を相互に閲覧・編集可（現場チーム共有）。管理者は全件。
- **C**: その他（自由記述）

[Answer]: B

### Q9. 管理者の権限包含
管理者は調査員の操作（調査の作成・入力）も行えますか。
- **A（推奨）**: 包含する（管理者は作成・入力も可）＋承認・確定・全件管理。FR-08（第2次開始は管理者 or 調査員）とも整合。
- **B**: 管理者は承認・確定・管理のみ。作成・入力は調査員専用。

[Answer]: B

### Q10. ロール割当・変更の管理機能
アプリ内でロールを割り当て・変更する管理 UI/API は U1（本リリース）の範囲ですか。
- **A（推奨）**: スコープ外（Cognito 側の運用で割当。アプリにロール管理機能は作らない）。
- **B**: U1 で最小のロール割当 API を作る。

[Answer]: B

### Q11. PBT（プロパティベーステスト）の U1 適用範囲
PBT は「全面適用」設定です。U1 での重点は？
- **A（推奨）**: 認可マトリクスの不変条件を PBT 化（生成した {ロール, 操作, 所有関係} の全組合せに対し、許可/拒否が権限表と一致する・既定拒否が破られない）。＋ 例示テストで代表ケースを固定。
- **B**: U1 は例示テストのみ。PBT は計算ユニット（U3*）に限定。

[Answer]: A

### Q12. その他・補足
追加の制約・懸念・上記に当てはまらない要望があればご記入ください（なければ「なし」）。

[Answer]: 管理者がロール管理機能を持つ

---

## ストーリー・トレーサビリティ（暫定）
| ストーリー | 内容 | 反映先ステップ |
|---|---|---|
| US-101/102/103 | ログイン/認証/ロール別アクセス | Step C, E, F |
| US-802 | サーバ側認可（オブジェクト/機能レベル） | Step D, E, F |

## 備考（安全性）
- 本ステージは設計のみ（コード変更なし）。`prisma migrate` 等の破壊的操作は Code Generation 段階でユーザー確認のうえ実施。
