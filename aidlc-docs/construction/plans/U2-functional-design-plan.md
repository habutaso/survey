# U2 — 機能設計計画（Functional Design Plan: 調査管理 Survey 集約＋提出時一括同期 API）

本計画は U2 の機能設計の**単一の真実の源**です。下部の質問（`[Answer]:`）にすべてご回答いただいた後、アーティファクトを生成します。
※本ステージは**設計のみ**（コード変更・マイグレーションなし）。破壊的操作は Code Generation 段階で確認のうえ実施します。

## ユニット・コンテキスト
- **ユニット**: U2 — 調査管理（Survey 集約）＋提出時一括同期 API
- **責務**: 1家屋=1調査の集約。家屋識別情報・被災者 PII・GPS・状態機械（下書き→提出→承認→確定）・調査区分（第1次/第2次）参照・正式判定の保持と遷移。第1次/第2次の入力データ実体（`FirstSurveyEntity`/`SecondSurveyEntity`）保持。提出時一括同期の受け口 `POST /api/private/surveys/submission` → `ingestSubmission`（UG6=A）。
- **依存**: U1（認証・ロール・認可基盤 `hooks`/`assertRole`/`assertOwnerOrRole`）、U-Cross（`auditUseCase.record`・共通バリデータ・統一エラー型）完了済み。
- **後続が依存**: U3a/U3b（計算）、U4（画像）、U5（出力・一覧）、U6f（同期クライアント）、U6u（UI）。
- **担当ストーリー**: US-201, US-202, US-203, US-207（サーバ側同期）, US-501, US-502（後続）, US-503, US-504, US-505, US-601, US-605, US-606
- **関連要件**: FR-01〜09, FR-18, FR-19 / NFR-08 / SECURITY-01, 05, 08, 13
- **既存資産（Brownfield, 流用/拡張）**:
  - `server/common/constants/index.ts`（`ID_NAME_LIST`／`AUDIT_ACTION_LIST` に survey.* 済）、`server/common/validators/common.ts`（`percentage`/`boundedString`/`numberInRange`/`epochMs`）
  - `server/domain/audit/auditUseCase.ts`（`record(client, event)`・同一 tx）
  - `server/service/customAssert.ts`（`ValidationError`/`UnauthorizedError`/`ForbiddenError`/`NotFoundError`）、`server/service/prismaClient.ts`（`transaction`）
  - `server/api/private/hooks.ts`（認証＋`req.user`注入）、U1 `authMethod.assertRole`/`hasRole`
  - frourio + aspida + Prisma パイプライン、`brandedId` 自動生成（`ID_NAME_LIST` 駆動）

---

## ステージ評価（U2）
| ステージ | 判定 | 理由 |
|---|---|---|
| Functional Design | **EXECUTE** | 集約・状態機械・業務ルール・データモデル・同期 API のドメイン設計が必要（本計画） |
| NFR Requirements | SKIP（暫定） | セキュリティ・ベースライン採用済み。U2 固有の新規 NFR は想定せず（性能 NFR-03 は U5 一覧/検索で扱う）。※ Q で覆る場合あり |
| NFR Design | SKIP（暫定） | 同上 |
| Infrastructure Design | SKIP（暫定） | DB スキーマ追加（加法的）のみ。at-rest 暗号化/TLS は U-Cross/OPERATIONS 既定に従う |
| Code Generation | EXECUTE | 機能設計承認後に別計画で実施 |

> 計算（U3a/U3b）・画像保存（U4）は**後続ユニット**。本ユニットでは DI 可能な**ポート（インターフェイス）**として境界のみ定義し、実装は後続で注入する想定（DDD/velona 準拠, NFR-09）。

---

## 設計ステップ（質問確定後に実行）
- [x] Step A: Survey 集約のドメインエンティティ確定（識別/区分/親参照/状態/GPS/PII参照/日時・実施者/結果参照）→ `domain-entities.md`
- [x] Step B: 被災者 PII の保持モデル（別エンティティ/埋め込み・暗号化方針・マスク）→ `domain-entities.md`
- [x] Step C: FirstSurvey/SecondSurvey 入力データ実体（外力・傾斜・浸水深 / 部位別損傷率・階按分）の構造 → `domain-entities.md`
- [x] Step D: AssessmentResult・OfficialDetermination の保持モデルと計算ポート（DI 境界）→ `domain-entities.md` / `business-logic-model.md`
- [x] Step E: 状態機械（下書き→提出→承認→確定 [＋reject]）と `assertTransition` 設計 → `business-logic-model.md` / `business-rules.md`
- [x] Step F: `ingestSubmission`（提出時一括同期）の入力契約・原子性・冪等性・再試行・監査連携 → `business-logic-model.md`
- [x] Step G: 第2次調査（再調査）開始ロジック（第1次確定前提・親関連付け）→ `business-logic-model.md`
- [x] Step H: 正式判定（管理者が第1次/第2次を選択・確定）ロジック → `business-logic-model.md`
- [x] Step I: オブジェクト/機能レベル認可の強制点（L1 hooks / L2 assert）と読取スコープ → `business-rules.md`
- [x] Step J: 入力検証ルール（範囲・型・最大長・単位）と監査アクション対応表 → `business-rules.md`
- [x] Step K: 公開 API エンドポイント設計（submission ＋ 取得/遷移操作）→ `business-logic-model.md`
- [x] Step L: テスト方針（PBT: 状態遷移 PBT-06・ペイロード往復 PBT-02・確定冪等 PBT-04）→ 各アーティファクトに付記

---

## 確認事項（Questions）

> 各 `[Answer]:` の後に回答（選択肢の記号や自由記述）をご記入ください。推奨案には「推奨」と明記しています。判断に迷う場合は推奨案で問題ありません。
> まとめて「すべて推奨でよい」等の一括回答も可能です。

### 【データフロー・同期】

#### Q1. サーバが「下書き(下書き状態)」を保持するか（ローカルファーストとの整合）
AD2-FU2=A により入力途中はクライアント IndexedDB（U6f）に保持し、「提出」時に一括同期します。サーバ側の永続化の起点は？
- **A（推奨）**: サーバは**提出時に初めて永続化**する。`ingestSubmission` 受信時点で Survey を作成し**状態=提出**で保存（サーバ上に「下書き」状態の Survey は基本的に存在しない）。状態機械の「下書き」はクライアント・ローカルの論理状態として扱う。
- **B**: サーバも「下書き」状態を保持する（明示的な下書き保存 API を設け、提出で遷移）。ローカルファーストと二重管理になる。
- **C**: その他（自由記述）

[Answer]:A

#### Q2. Survey の ID 採番（オフライン作成との整合）
オフラインでクライアントが調査を作成・保持し、後で同期します。ID は？
- **A（推奨）**: **クライアントが ULID を生成**してペイロードに含める。サーバはその ID で UPSERT 的に受理（同期再試行の冪等キーに利用）。
- **B**: サーバが採番。クライアントは一時 ID で保持し、同期応答でサーバ ID に置換（マッピング管理が必要）。
- **C**: その他（自由記述）

[Answer]:B

#### Q3. `ingestSubmission` の冪等性（再試行時の重複防止 / US-207）
ネットワーク不通で再送した場合の重複登録防止策は？
- **A（推奨）**: Survey ID（Q2=A のクライアント ULID）を**冪等キー**とし、同一 ID の再送は「既に提出済みなら成功扱い（no-op で同じ結果を返す）」。未確定なら内容を上書き。確定済みへの再送は拒否（409 相当→ Forbidden/Validation）。
- **B**: 別途リクエスト単位の冪等トークン（`Idempotency-Key`）を導入。
- **C**: その他（自由記述）

[Answer]:A

#### Q4. 提出ペイロードに画像（U4）を含めるか
US-207 は「入力内容・画像を一括送信」。画像保存は U4（S3）の責務で、U4 は U2 の後に構築します。
- **A（推奨）**: U2 では**画像保存を DI ポート（`photoPort`）として境界定義のみ**行い、`ingestSubmission` のフローに「画像保存呼び出し点」を用意（実装は U4 で注入）。U2 の段階ではポートのスタブで結線・テスト。ペイロードの画像メタ（部位/種別/一時参照）は受理形だけ定義。
- **B**: U2 では画像を一切扱わず、画像同期は完全に別 API（U4/U6f）に分離。`ingestSubmission` は非画像データのみ。
- **C**: その他（自由記述）

[Answer]:A

#### Q5. 計算（U3a/U3b）の結合方法（U2 が U3 より前に構築される件）
構築順序は U2 → U3c → U3a → U3b です。`ingestSubmission` は「登録・計算・状態遷移・監査」を原子的に行う設計ですが、計算実装は後続です。
- **A（推奨）**: U2 で**計算ポート `assessmentPort.calcFirst/calcSecond`（DI インターフェイス）**を定義し、`ingestSubmission` から呼ぶ。U2 段階では**恒等/スタブ実装を注入**してフロー・テストを成立させ、U3a/U3b 完成時に実装を差し替える（結果 `AssessmentResult` を Survey に保存）。
- **B**: U2 では計算を呼ばず**入力データのみ保存**。`AssessmentResult` の算出・保存は U3a/U3b 構築時に `ingestSubmission` へ追加する。
- **C**: その他（自由記述）

[Answer]:A

#### Q6. サーバ側での提出時の再計算 vs クライアント計算の信頼
クライアント（U6f/U6u）はプレビュー計算を行えます（純粋関数共有）。提出時の正式結果は？
- **A（推奨）**: **サーバが提出時に再計算**して保存（クライアント値は信頼しない。決定論的なので一致するはず・改ざん防止, SECURITY）。クライアント送信値があっても無視 or 検証用に突合。
- **B**: クライアント計算結果を保存（サーバ再計算なし）。
- **C**: その他（自由記述）

[Answer]:A

### 【ドメインモデル】

#### Q7. 被災者 PII の保持モデル
氏名・連絡先等の PII（FR-02）の持ち方は？
- **A（推奨）**: Survey に**埋め込み**（同一テーブルのカラム群 `victimName`/`victimContact`/`victimAddress` 等）。1家屋=1調査で 1:1 のため単純。
- **B**: 別エンティティ `Resident`/`Victim`（別テーブル, Survey と 1:1 参照）。将来の正規化・別管理に有利。
- **C**: その他（自由記述）

[Answer]:B

#### Q8. PII の保存時保護方式（SECURITY-01 / US-202「暗号化保存」）
U-Cross では「サーバ at-rest 暗号化＝インフラ層（OPERATIONS）、サーバでのフィールド暗号化はコード追加なし」と決定済みです。U2 の PII は？
- **A（推奨）**: **DB の at-rest 暗号化（インフラ層）に委譲**し、アプリ層では PII を**平文カラム**で保持（U-Cross 決定と整合）。保護はアクセス認可（PII は権限者のみ取得）＋監査＋ログ非出力＋クライアント・ローカル暗号化（U6f）で担保。
- **B**: U2 で**アプリ層フィールド暗号化**（保存前に暗号化、取得時に復号）を実装する（U-Cross 決定の例外として PII のみ追加保護）。→ 鍵管理の NFR/Infra 設計が必要（ステージ評価が変わる）。
- **C**: その他（自由記述）

[Answer]:A

#### Q9. PII を返す API のマスキング／取得制御
PII の読取は？
- **A（推奨）**: PII は**詳細取得 API でのみ**返し、一覧（U5）・併記表示・他ロールにはマスク/非表示。閲覧者(viewer)は PII を見られる？ → **見られない（PII は調査員/管理者のみ）**を既定とする。
- **B**: 閲覧者も PII を含めて全件参照可（U1 Q7=A「viewer 全件参照」を PII にも適用）。
- **C**: その他（自由記述）

[Answer]:A

#### Q10. 家屋識別情報の項目と必須/任意
FR-01 の家屋識別情報。最小セットは？
- **A（推奨）**: `address`(必須), `houseNumber`/家屋番号(必須), `structureType`(構造種別: 木造/非木造 等の enum, 必須), `buildingName`/建物名(任意), `floors`/階数(任意・階按分に利用)。
- **B**: 上記のうち `address` のみ必須、他は任意。
- **C**: その他（自由記述で項目・必須を指定）

[Answer]:A

#### Q11. 構造種別（structureType）の値
水害でも木造/非木造で様式・構成比が異なります（要件 §11 リスク）。U2 での扱いは？
- **A（推奨）**: enum `wood`(木造)/`nonWood`(非木造) の2値を保持（表示名は日本語マップ）。計算での使い分けは U3c マスタ側で対応。
- **B**: 自由文字列。
- **C**: その他（自由記述）

[Answer]:A

#### Q12. GPS（FR-03 / US-203）の保持
- **A（推奨）**: `latitude`/`longitude`（数値, **任意**）＋取得不可時は null（「位置なしでも継続」を記録）。精度/高度は持たない。
- **B**: 緯度経度＋精度(accuracy)・取得日時も保持。
- **C**: その他（自由記述）

[Answer]:A

#### Q13. 第1次→第2次（再調査）の多重度
確定済み第1次に対する第2次（FR-07/08, US-601）の関係は？
- **A（推奨）**: 1つの第1次に対し**第2次は複数作成可**（再調査の履歴を残す）。各第2次は `parentSurveyId` で第1次を参照。正式判定は「ある第1次」と「その第2次群のうち最新/指定」を対象にする。
- **B**: 第1次:第2次 = 1:1（再調査は1回のみ）。
- **C**: その他（自由記述）

[Answer]:A

#### Q14. 正式判定（OfficialDetermination / FR-09, US-606）の保持先
- **A（推奨）**: **第1次 Survey に保持**（`officialSurveyId`＝採用した Survey の ID[第1次 or 第2次]、`officialChosenBy`、`officialChosenAt`）。同一家屋の系列（第1次＋その第2次群）の代表は第1次が持つ。
- **B**: 独立エンティティ `OfficialDetermination`（家屋系列を参照）。
- **C**: その他（自由記述）

[Answer]:B

### 【状態機械・業務ルール】

#### Q15. 状態（status）の値と内部表現
- **A（推奨）**: enum `draft`/`submitted`/`approved`/`confirmed`（英語）＋日本語表示名マップ（下書き/提出/承認/確定）。U1 のロール表現（Q5=A）と統一。※ Q1=A の場合 `draft` はクライアント論理状態だが、enum 自体は完全形で定義し、サーバ初期値は `submitted`。
- **B**: 日本語識別子をそのまま使用。
- **C**: その他（自由記述）

[Answer]:A

#### Q16. 差戻し（reject / US-502）の実装範囲
US-502（管理者による差戻し）は優先度「後続」です。U2 での扱いは？
- **A（推奨）**: 状態機械の**遷移定義には含める**（提出/承認→下書き）が、**API/UseCase の実装は後続**に回し、`assertTransition` は将来拡張に耐える形にする。MVP の実装対象は submit/approve/confirm/officialJudgment。
- **B**: U2 で reject も完全実装する（管理者が提出→下書きに戻せる）。
- **C**: reject は状態機械からも除外（完全に後続フェーズへ）。

[Answer]:A

#### Q17. 確定後の不変性（FR-05 / US-505）の強制方法
- **A（推奨）**: `assertNotConfirmed`（または `assertMutable`）をモデル層で適用し、確定済み Survey へのあらゆる更新（再提出・PII 変更・正式判定変更含むか後述）をドメイン例外で拒否（fail closed）。再調査は別記録（第2次）で対応。
- **B**: 確定後も特定フィールド（例: 正式判定）は変更可。
- **C**: その他（自由記述）

[Answer]:A

#### Q18. 提出後の編集可否（US-501「提出後 調査員は編集不可」）と所有権（U1 Q8=B 連動）
U1 では「調査員は下書きを相互編集可（管理者は全件）」と決定。ただし Q1=A なら下書きはローカル。サーバ側の編集権は？
- **A（推奨）**: サーバ Survey は提出以降に存在し、**提出後は調査員は編集不可**（reject で下書き＝ローカル戻しは後続）。承認/確定/正式判定は管理者のみ。管理者は全件操作可（U1 Q9 で「管理者も入力可」だが、提出済みの編集は運用上 reject 経由）。
- **B**: その他（自由記述）

[Answer]:A

#### Q19. 調査員(surveyor)のサーバ側**読取**スコープ（オブジェクト認可 / FR-43, US-802）
提出済み Survey を、提出した本人以外の調査員も読めるか？
- **A（推奨）**: 調査員は**全 Survey を読取可**（現場チーム共有・データモデルに自治体スコープ無し。U1 Q7=A/Q8=B の精神に整合）。書込（承認/確定/正式判定）はロールで制限。
- **B**: 調査員は**自分が提出した Survey のみ**読取可（厳格な所有者制）。管理者・閲覧者は全件。
- **C**: その他（自由記述）

[Answer]:A

### 【入力検証】

#### Q20. 第1次入力（FR-20〜22）のデータ項目と検証範囲
U2 が保持する第1次入力データ実体の項目・範囲は（計算規則は U3a）？
- **A（推奨）**: `externalForceFlags`（外力・流失等の該当真偽: 住家流失/地盤洗掘/基礎流失/全階天井浸水 など boolean 群）, `tiltRatio`（傾斜・実測, 0以上の数値・単位は後述）, `inundationDepthCm`（浸水深 cm, 0–`MAX`）, `floorApportionment`（階按分: 各階比率, 合計=100%）。範囲は U-Cross の `numberInRange`/`percentage` を使用。
- **B**: 項目は上記、ただし詳細範囲は U3a/U3c 構築時に確定（U2 は緩い型のみ）。
- **C**: その他（自由記述で項目を指定）

[Answer]:A

#### Q21. 浸水深・傾斜の単位と上限
- **A（推奨）**: 浸水深=cm（整数 or 小数, 0〜例: 2000cm 程度の妥当上限）, 傾斜=**比率（例 1/20 → 0.05）または 度**のいずれか。→ **比率（無次元, 0〜1 程度）**を既定とし、運用指針の数値は U3c で確定。
- **B**: 傾斜は度（degree, 0〜90）。
- **C**: その他（自由記述）

[Answer]:A

#### Q22. 第2次入力（FR-23）の部位別損傷率の保持形
外部（屋根・基礎・外壁）＋内部（天井・床・内壁・建具・設備 等）の損傷率（US-602/603）。
- **A（推奨）**: `partDamages`: 部位キー→損傷率(%)のマップ。**部位キーの定義（マスタ）は U3c**に置き、U2 は「部位キー（string/enum）＋損傷率(0–100%)の集合」として汎用保持。階按分も保持。検証は `percentage`。
- **B**: U2 で部位を固定 enum として確定（屋根/基礎/外壁/天井/床/内壁/建具/設備…）。
- **C**: その他（自由記述）

[Answer]:A

### 【API・テスト】

#### Q23. 公開エンドポイント構成（frourio/aspida, `api/private/surveys/...`）
- **A（推奨）**: 次を定義（すべて `api/private` 配下＝要認証）:
  - `POST /surveys/submission`（`ingestSubmission`: 第1次/第2次の提出一括同期）
  - `GET /surveys`（一覧・最小。本格的な検索/ページングは U5）
  - `GET /surveys/:surveyId`（詳細・PII は認可制御）
  - `POST /surveys/:surveyId/approve`（管理者）
  - `POST /surveys/:surveyId/confirm`（管理者）
  - `POST /surveys/:surveyId/official`（管理者: 正式判定の選択・確定）
  - `POST /surveys/:surveyId/reexamination`（第2次開始 / 管理者 or 調査員。または submission に区分含めて一括でも可）
  - （reject は Q16 に従う）
- **B**: 上記から一覧/詳細を U5 に委ね、U2 は submission ＋遷移操作のみ。
- **C**: その他（自由記述で増減を指定）

[Answer]:A

#### Q24. 第2次調査開始のトリガ（API 形）
US-601（確定済み第1次に対し第2次開始）。
- **A（推奨）**: 専用 `POST /surveys/:firstSurveyId/reexamination` で第2次の空調査（ローカル下書き相当）を**サーバ作成せず**、クライアントが第2次をローカル作成→ `ingestSubmission`（区分=第2次, parent=第1次）で同期。サーバは submission 受信時に「親=確定済み第1次」を検証。→ **開始専用 API は作らず submission で検証**（Q1=A と整合）。
- **B**: 開始 API で第2次を作成（サーバ側で親確定を検証し下書き作成）。
- **C**: その他（自由記述）

[Answer]:A

#### Q25. PBT（プロパティベーステスト）の U2 重点
PBT 全面適用設定。U2 の重点は？
- **A（推奨）**: ①状態機械の不正遷移排除（PBT-06: 任意の {現状態, 操作, ロール} に対し許可遷移のみ成功・他は拒否、確定は終端）②提出ペイロード↔ドメイン/DTO の往復同一性（PBT-02）③確定・提出再送の冪等性（PBT-04, Q3=A）。＋例示テストで代表ケース。
- **B**: U2 は例示テストのみ。
- **C**: その他（自由記述）

[Answer]:A

#### Q26. 監査記録の対象イベント（NFR-08 / SECURITY-13, 既存 `AUDIT_ACTION_LIST`）
`survey.submit`/`survey.approve`/`survey.confirm`/`survey.reject`/`survey.officialJudgment`/`pii.change` が定義済みです。
- **A（推奨）**: 上記すべてを該当操作で記録（reject は実装時）。PII 変更は `pii.change` で**マスク済 before/after**（`auditMethod.toFieldChanges(entries, pii=true)`）。状態遷移は actor/前後状態を `changes` に記録。
- **B**: 状態遷移のみ記録、PII 変更記録は後続。
- **C**: その他（自由記述）

[Answer]:A
ドメイン駆動開発における、各イベントテーブルを作成して
エンティティそのものやイベントは削除される事なく
状態をいつでも追えるような設計とする

#### Q27. その他・補足
追加の制約・懸念・上記に当てはまらない要望があればご記入ください（なければ「なし」）。

[Answer]:

---

## ストーリー・トレーサビリティ（暫定）
| ストーリー | 内容 | 反映先ステップ |
|---|---|---|
| US-201 | 第1次新規作成（家屋情報） | Step A, C, J |
| US-202 | 被災者 PII 登録 | Step B, I, J |
| US-203 | GPS 記録 | Step A, J |
| US-207（サーバ側） | 提出時一括同期 | Step F, K |
| US-501 | 調査員による提出 | Step E, F |
| US-502（後続） | 管理者による差戻し | Step E（遷移定義） |
| US-503 | 管理者による承認 | Step E, K |
| US-504 | 管理者による確定 | Step E, K |
| US-505 | 確定後の編集不可 | Step E |
| US-601 | 第2次（再調査）開始 | Step G, K |
| US-605 | 第1次/第2次併記表示 | Step D, H |
| US-606 | 正式判定の選択・確定 | Step H, K |

## 備考（安全性）
- 本ステージは設計のみ（コード変更なし）。`prisma migrate` 等の破壊的操作は Code Generation 段階でユーザー確認のうえ実施。
- 計算（U3a/U3b）・画像（U4）は DI ポートとして境界定義のみ。実装は後続ユニットで注入し、`ingestSubmission` のフローへ結線する。

---

## 確定回答（Confirmed Answers — 2026-06-14T01:55:25+09:00）

ユーザー入力「完了」＝提示済みの「すべて推奨でよい」一括承認として確定。

| 質問 | 回答 | 質問 | 回答 |
|---|---|---|---|
| Q1 | **A**（提出時に初めて永続化, 初期状態=提出） | Q14 | **A**（正式判定は第1次 Survey に保持） |
| Q2 | **A**（クライアント生成 ULID＝冪等キー） | Q15 | **A**（status enum + 日本語表示名） |
| Q3 | **A**（Survey ID 冪等, 確定済み再送は拒否） | Q16 | **A**（reject は遷移定義に含め実装は後続） |
| Q4 | **A**（photoPort DI 境界, 実装は U4） | Q17 | **A**（assertMutable で確定後不変） |
| Q5 | **A**（assessmentPort DI, U2 はスタブ注入） | Q18 | **A**（提出後 surveyor 編集不可・admin 全件） |
| Q6 | **A**（サーバが提出時に再計算） | Q19 | **A**（surveyor は全 Survey 読取可） |
| Q7 | **A**（PII は Survey に埋め込み 1:1） | Q20 | **A**（外力flags/傾斜/浸水深/階按分） |
| Q8 | **A**（at-rest はインフラ委譲, 平文カラム＋認可/監査/非ログ/クライアント暗号化で保護） | Q21 | **A**（浸水深=cm, 傾斜=比率, 数値は U3c で確定） |
| Q9 | **A**（PII は詳細APIのみ・viewer 不可） | Q22 | **A**（partDamages: 部位キー→損傷率%, 部位定義は U3c） |
| Q10 | **A**（address/houseNumber/structureType 必須＋任意項目） | Q23 | **A**（submission＋一覧/詳細/approve/confirm/official/reexamination） |
| Q11 | **A**（structureType enum: wood/nonWood） | Q24 | **A**（開始専用 API なし, submission で親確定検証） |
| Q12 | **A**（lat/lng 任意・null 可） | Q25 | **A**（PBT: 状態遷移/ペイロード往復/冪等性） |
| Q13 | **A**（第1次:第2次 = 1:N, parentSurveyId） | Q26 | **A**（survey.* ＋ pii.change マスク済記録） |
| Q27 | なし | | |

**ステージ評価への影響**: Q8=A のため NFR Requirements / NFR Design / Infrastructure Design は **SKIP** 確定（鍵管理等の新規 NFR なし）。Code Generation は機能設計承認後に実施。
