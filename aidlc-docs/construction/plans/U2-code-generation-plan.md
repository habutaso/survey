# U2 — コード生成計画（Code Generation Plan: 調査管理 Survey 集約 ＋ 提出時一括同期 API）

本計画は U2 のコード生成の**単一の真実の源**です。Brownfield のため「生成」は既存ファイルの**修正（in-place）**を含み、重複ファイル（`*_new.ts` 等）は作りません。下部の承認後に Part 2（実行）を行います。

## ユニット・コンテキスト
- **ユニット**: U2 — 調査管理（Survey 集約）＋提出時一括同期 API（`ingestSubmission`）
- **ワークスペースルート**: `/root/environment/survey`（Brownfield モノレポ。サーバは `server/`）
- **責務**: 1家屋=1調査の集約（家屋識別・PII・GPS・状態機械・調査区分・正式判定）、第1次/第2次入力データ実体、提出時一括同期 `POST /api/private/surveys/submission`。
- **依存（充足済み）**: U0（デモ削除）, U1（認証・ロール・`authMethod`/`assertRole`）, U-Cross（`auditUseCase.record`・共通バリデータ・`ValidationError`/`ForbiddenError`/`NotFoundError`・型ベースエラーハンドラ）。すべて COMPLETE & APPROVED。
- **後続が利用するポート（本ユニットはスタブ実装を注入）**: `assessmentPort`（U3a/U3b 実装）, `photoPort`（U4 実装）。
- **担当ストーリー**: US-201, US-202, US-203, US-207（サーバ側同期）, US-501〜505, US-601, US-605, US-606。
- **設計入力**: `aidlc-docs/construction/U2/functional-design/`（domain-entities / business-logic-model / business-rules）。確定回答 Q1〜Q26=推奨(A) / Q27=なし。

## ステージ評価（U2）
| ステージ | 判定 |
|---|---|
| Functional Design | DONE（承認済み 2026-06-14） |
| NFR Requirements / NFR Design | SKIP（Q8=A: at-rest はインフラ委譲・追加 NFR なし） |
| Infrastructure Design | SKIP |
| Code Generation | EXECUTE（本計画） |

## 重要な制約（既存コードベース由来）
- **カバレッジ 100% 必須**（`server/vite.config.ts`: `domain/**`, `common/**`, `api/**/{controller,hooks,validators}.ts`）。`service/**` は対象外。
- **DDD レイヤリング**: Controller（zod 検証＋L1 認可）→ UseCase（`transaction` 境界・監査・ポート呼出）→ Model（純粋・L2 認可・遷移）→ Store（command/query/toDto）。既存 `domain/user`・`domain/audit` の構成に倣う。
- **brandedId**: `ID_NAME_LIST` に `'survey'` を追加（`firstSurvey`/`secondSurvey` は `surveyId` 共有主キーのため独立 ID 名は追加しない）。ULID は `ulid` パッケージで採番。実行時バリデータは共通 `z.string()`、型レベルのみ区別（既存方針）。
- **enum の扱い**: `surveyType`/`status`/`structureType` は **DB は String カラム**で保持し、アプリ層で `SURVEY_TYPE_LIST`/`SURVEY_STATUS_LIST`/`STRUCTURE_TYPE_LIST`（TS union＋zod）により検証（enum churn 回避。U-Cross の `action`/`outcome` と同方針）。
- **監査**: `auditUseCase.record(tx, event)` を同一トランザクションで呼ぶ（U-Cross）。PII 変更は `pii.change` で**マスク済 before/after**（`auditMethod.toFieldChanges` の PII フラグ）。
- **DI（velona `depend`）**: `assessmentPort`/`photoPort` は `depend` で注入。U2 ではスタブ実装（決定論的）を本番組成に注入し、後続ユニットが実装を差し替える。velona は依存に存在（`^0.8.0`）。
- **エラー方針**: fail closed。検証/遷移/区分/階按分/正式判定対象不正→`ValidationError`(400)、ロール不足・確定後更新→`ForbiddenError`(403)、対象不在→`NotFoundError`(404)。U-Cross グローバルハンドラがマッピング。
- **Prisma migrate**: `Survey`/`FirstSurvey`/`SecondSurvey` 追加は**加法的（非破壊）**。`prisma migrate dev --name add_survey` を実行（U1/U-Cross と同様、開発/テスト DB に対して。**実行は承認をゲートとする**）。
- **frourio/aspida 再生成**: 新エンドポイント追加後に `npm run generate` ＋必要に応じ `npx aspida`、`tsc --noEmit`。
- **PBT**: `fast-check@3.23.2`（導入済み）。状態遷移健全性・ペイロード往復・冪等性を検証。

---

## 生成ステップ（Part 2 で実行）

### Step 1: 共通定数・型（common）
- [x] `server/common/constants/index.ts`: `ID_NAME_LIST` に `'survey'` を追加。`SURVEY_TYPE_LIST=['first','second']`、`SURVEY_STATUS_LIST=['draft','submitted','approved','confirmed']`、`STRUCTURE_TYPE_LIST=['wood','nonWood']` と各表示名マップ（`SURVEY_TYPE_DISPLAY`/`SURVEY_STATUS_DISPLAY`/`STRUCTURE_TYPE_DISPLAY`）を追加。`AUDIT_ACTION_LIST` は既に survey.* を含む（追記不要）。
- [x] `server/common/types/survey.ts`（新規）: `SurveyType`/`SurveyStatus`/`StructureType` 型、`FloorRatio`/`PartDamage`/`AssessmentResult`/`ExternalForceFlags` 値オブジェクト、`SurveyBase`（家屋識別・PII・GPS・判定・official*・actors/timestamps）、`FirstSurveyBase`/`SecondSurveyBase`、`SurveyDto = SurveyBase & { id: DtoId['survey'] }`、`SurveyDetailDto`（PII 含む）/`SurveyDto`（PII マスク/除外）の区別を型で表現、`SubmissionPayload`（survey + firstSurvey?/secondSurvey? + photos?）。

### Step 2: 共通バリデータ（common/validators）
- [x] `server/common/validators/survey.ts`（新規）: `surveyValidator` に以下を定義（U-Cross の `percentage`/`boundedString`/`numberInRange`/`epochMs` を再利用）。
  - `submissionBody`（business-rules §6 検証表に準拠: address/houseNumber 必須・`boundedString`、`structureType` enum、buildingName/floors 任意、victim* 任意 `boundedString`、latitude `numberInRange(-90,90)`、longitude `numberInRange(-180,180)`、surveyType enum、parentSurveyId は second のとき必須、`firstSurvey`/`secondSurvey` の各フィールド、`floorApportionment[]`、`partDamages[]`）。
  - `chooseOfficialBody`（`officialSurveyId: z.string()`）。
  - 区分排他（first/second 入力の混在禁止, BR-3/21）は `superRefine` で表現。

### Step 3: ドメイン型・エンティティ（survey model）
- [x] `server/domain/survey/model/surveyType.ts`（新規）: `SurveyEntity = SurveyBase & { id: EntityId['survey'] }`、`FirstSurveyEntity`/`SecondSurveyEntity`（`surveyId: EntityId['survey']`）。

### Step 4: ドメインロジック（survey method, 純粋・L2）
- [x] `server/domain/survey/model/surveyMethod.ts`（新規）:
  - `createFromSubmission(actor, payload): { survey, first?, second? }`（id=`brandedId.survey.entity.parse(payload.survey.id)`, status=`submitted`, createdBy=actor.id, createdTime/submittedAt=now, official*=null）。
  - `assertTransition(survey, action, actor): SurveyStatus`（表駆動。submitted→approve(admin)→approved、approved→confirm(admin)→confirmed、submitted/approved→reject(admin)（**後続・表のみ**）。表外は既定拒否。ロール不足は `ForbiddenError`、不正遷移は `ValidationError`。fail closed）。
  - `assertMutable(survey)`（status===confirmed なら `ForbiddenError`, FR-05）。
  - `assertReexaminationAllowed(parent)`（第2次の親が surveyType=first かつ status=confirmed であることを検証, BR-5。不在は呼出側 `NotFoundError`、不適合は `ValidationError`/`ForbiddenError`）。
  - `assertOfficialTarget(first, secondList, officialSurveyId)`（officialSurveyId が当該第1次 or その第2次群のいずれか、かつ confirmed であることを検証, BR-17/18）。
  - `applyOfficial(first, officialSurveyId, actor)`/`approve`/`confirm`（状態・メタ更新を返す純粋関数）。

### Step 5: ポート定義＋スタブ（survey ports, velona DI）
- [x] `server/domain/survey/ports/assessmentPort.ts`（新規）: `depend` で `calcFirst(input, floors): AssessmentResult` / `calcSecond(input, floors): AssessmentResult` を定義。U2 スタブ＝決定論的固定値（例: `damageRatio=0`, `damageLevel='unclassified'`, `basis={ stub:true }`）。U3a/U3b で実装注入。
- [x] `server/domain/survey/ports/photoPort.ts`（新規）: `depend` で `persist(tx, surveyId, photoMetas): savedRefs` を定義。U2 スタブ＝no-op（参照素通し）。U4 で S3 実装注入。

### Step 6: ストア（survey store）
- [x] `server/domain/survey/store/toSurveyDto.ts`（新規）: prisma → `SurveyDto`（**PII 除外/マスク**, 一覧・低権限用）と `toSurveyDetailDto`（**PII 含む**, 認可済み詳細用）。`DateTime`→epoch ms、`action`/enum は String→union キャスト、`assessmentBasis` は `Json`。第1次/第2次の従属データを含める。
- [x] `server/domain/survey/store/surveyCommand.ts`（新規）: `upsert(tx, { survey, first?, second? }): Promise<SurveyDto>`（Survey upsert ＋ FirstSurvey/SecondSurvey upsert を同一 tx。冪等な再 ingest に対応）。`setOfficial`/`updateStatus` の保存も含む（または `upsert` に集約）。INSERT/UPDATE のみで Survey 集約の整合を保つ。
- [x] `server/domain/survey/store/surveyQuery.ts`（新規）: `findById(tx, id): SurveyDto|throw`、`findDetailById`、`listByParent(tx, parentSurveyId)`、`list(tx)`（最小一覧, 本格検索は U5）。

### Step 7: ユースケース（surveyUseCase, トランザクション境界・監査・ポート呼出）
- [x] `server/domain/survey/surveyUseCase.ts`（新規, `depend` で `assessmentPort`/`photoPort` 注入）:
  - `ingestSubmission(actor, payload)`（`transaction('RepeatableRead')`）: L2 `assertRole(actor,[surveyor,admin])` → zod 済前提 → 冪等性判定（`findById`: confirmed→`ForbiddenError`／submitted・approved→上書き再受理（同一なら no-op 相当）／不在→新規）→ second の親検証（`assertReexaminationAllowed`）→ `createFromSubmission` → `assessmentPort.calc{First|Second}` → `surveyCommand.upsert` → `photoPort.persist` → 監査 `survey.submit`（PII 登録/変更時は `pii.change` マスク記録）→ `toSurveyDetailDto` 返却。
  - `approve(actor, surveyId)` / `confirm(actor, surveyId)`: `assertRole([admin])` → `findById` → `assertMutable` → `assertTransition` → 保存（approvedBy/At・confirmedBy/At）→ 監査 `survey.approve`/`survey.confirm`。confirm は既 confirmed なら **no-op 成功**（冪等, PBT-04）。
  - `chooseOfficial(actor, firstSurveyId, officialSurveyId)`: `assertRole([admin])` → 親第1次＋第2次群取得 → `assertOfficialTarget` → official* 設定 → 監査 `survey.officialJudgment`。
  - `get(actor, surveyId)`（PII は surveyor/admin のみ詳細, viewer はマスク）/ `list(actor)`（全件読取, Q19=A）/ `getHouseResults(actor, firstSurveyId)`（第1次＋第2次群併記, US-605）。
  - `reject` は**後続**（表に存在・実装なし, Q16=A）。

### Step 8: API レイヤ（frourio/aspida, `api/private/surveys/...`）
- [x] `server/api/private/surveys/index.ts` ＋ `controller.ts`（新規）: `get` = `list`（認証者全件, `toSurveyDto`）。
- [x] `server/api/private/surveys/submission/index.ts` ＋ `controller.ts`（新規）: `post` = `ingestSubmission`（body=`surveyValidator.submissionBody`, 認可 surveyor/admin を controller L1 でも強制）。
- [x] `server/api/private/surveys/_surveyId@string/index.ts` ＋ `controller.ts` ＋ `validators.ts`（新規）: `get` = `get`（詳細, params.surveyId 検証）。
- [x] `server/api/private/surveys/_surveyId@string/approve/index.ts` ＋ `controller.ts`（新規）: `post` = `approve`（admin）。
- [x] `server/api/private/surveys/_surveyId@string/confirm/index.ts` ＋ `controller.ts`（新規）: `post` = `confirm`（admin）。
- [x] `server/api/private/surveys/_surveyId@string/official/index.ts` ＋ `controller.ts`（新規）: `post` = `chooseOfficial`（admin, body=`chooseOfficialBody`）。
- [x] （`reject` エンドポイントは後続・未実装）。すべて `api/private` 配下＝認証必須（既存 hooks L1）。

### Step 9: Prisma スキーマ＋マイグレーション
- [x] `server/prisma/schema.prisma`: 加法的に追加。
  - `model Survey { id String @id; surveyType String; parentSurveyId String?; status String; address String; houseNumber String; structureType String; buildingName String?; floors Int?; victimName String?; victimContact String?; victimAddress String?; latitude Float?; longitude Float?; damageRatio Float?; damageLevel String?; assessmentBasis Json?; officialSurveyId String?; officialChosenBy String?; officialChosenAt DateTime?; createdBy String; createdAt DateTime; submittedAt DateTime?; approvedBy String?; approvedAt DateTime?; confirmedBy String?; confirmedAt DateTime?; first FirstSurvey?; second SecondSurvey? }`
  - `model FirstSurvey { surveyId String @id; survey Survey @relation(fields:[surveyId], references:[id]); externalForceFlags Json; tiltRatio Float?; inundationDepthCm Float?; floorApportionment Json? }`
  - `model SecondSurvey { surveyId String @id; survey Survey @relation(fields:[surveyId], references:[id]); partDamages Json; floorApportionment Json? }`
  - （部位/階按分は当面 `Json` で保持。正準スキーマ強化は U3c マスタ導入時。）
- [x] `prisma migrate dev --name add_survey` を実行（非破壊・加法的）。`prisma generate` で型反映。**実行は承認ゲート対象**。

### Step 10: テスト（カバレッジ 100% ＋ PBT）
- [x] `server/tests/unit/surveyMethod.test.ts`（新規）: `createFromSubmission`/`assertMutable`/`assertReexaminationAllowed`/`assertOfficialTarget`/`approve`/`confirm` の例示。PBT: **INV-1**（状態遷移健全性: 許可表どおり成功/拒否・confirmed 終端）、**INV-4**（区分排他）、**INV-5**（PII が viewer DTO・監査 changes に出現しない）。
- [x] `server/tests/unit/surveyDto.test.ts`（新規, 必要時）: `toSurveyDto`（PII マスク）/`toSurveyDetailDto`（PII 含む）と **INV-2**（ペイロード↔エンティティ↔DTO 往復同一性, PBT-02）。
- [x] `server/tests/api/private/surveys.test.ts`（新規, 実サーバ＋DB）: 第1次/第2次提出（US-201/202/203/207）、冪等再送（同一 ULID は重複なし／confirmed 再送 403, **INV-3**）、approve/confirm 正常系・確定後更新拒否（403）・他ロール操作拒否（403）、親未確定の第2次拒否、正式判定の選択（admin のみ）、viewer の PII マスク、監査 `survey.*`/`pii.change` 記録の確認。ポートはスタブで決定論化。
- [x] 既存テスト（U1/U-Cross）への影響なしを確認（加法的のため期待値変更は想定しないが回帰確認）。

### Step 11: ドキュメント生成（サマリ）
- [x] `aidlc-docs/construction/U2/code/u2-summary.md`: 変更/新規ファイル一覧、検証結果（typecheck/coverage/test）、API エンドポイント一覧、ポート・スタブの差替点（U3a/U3b/U4 への申し送り）、残作業（reject 実装、部位/階按分マスタ U3c、一覧/検索 U5、画像 U4、クライアント同期 U6f）。

### Step 12: 型・健全性確認
- [x] `server`: `npm run generate`（prisma/frourio）＋ `npx aspida`（必要時）＋ `tsc --noEmit` = PASS（0 errors）。
- [x] `npm test`（vitest + coverage）= 全 PASS・カバレッジ 100%（docker compose スタック: postgres/magnito/minio/inbucket で実行）。

---

## ストーリー・トレーサビリティ
| ストーリー | 内容 | ステップ |
|---|---|---|
| US-201/202/203 | 家屋識別・PII・GPS 入力（提出受理） | 1,2,3,4,6,7,8,10 |
| US-207 | 提出時一括同期（サーバ側・冪等・原子的） | 7,8,9,10 |
| US-501〜505 | 提出・承認・確定・確定後不変 | 4,7,8,10 |
| US-601 | 第2次（再調査, 親=確定済み第1次） | 4,7,8,10 |
| US-605 | 第1次/第2次結果併記 | 7,8 |
| US-606 | 正式判定（admin） | 4,7,8,10 |
| NFR-08 / SECURITY-13 | 監査（survey.* / pii.change マスク） | 7,10 |
| SECURITY-05 / US-801 | 入力検証 | 2,10 |
| NFR-04 / §7 PBT | 不変条件 INV-1..5 | 10 |

## 依存・インターフェイス（後続ユニット向け）
- **公開**: `surveyUseCase`（ingest/approve/confirm/chooseOfficial/get/list/getHouseResults）、`SurveyType`/`SurveyStatus`/`StructureType`、`SubmissionPayload`/`SurveyDto`/`SurveyDetailDto`、`assessmentPort`/`photoPort`（インターフェイス）。
- **U3a/U3b**: `assessmentPort.calc{First|Second}` の実装を注入（呼出点不変）。
- **U4**: `photoPort.persist` の S3 実装を注入。
- **U5**: 一覧/検索/エクスポートを `surveyQuery` 上に拡張。
- **U6f/U6u**: `POST /api/private/surveys/submission` の契約（`SubmissionPayload`）に追従。

## 安全性・備考
- `prisma migrate dev` は加法的（Survey/FirstSurvey/SecondSurvey 追加）。テスト DB は `migrate reset` 前提。**マイグレーション実行は本計画承認をゲートとする**。
- 監査は状態遷移・正式判定・PII で同一 tx の原子的記録（U-Cross 規約）。PII 実値は監査 `changes`・ログに出力しない（マスクのみ）。
- ポートはスタブ注入で U2 フローを完結・決定論化。後続は実装注入のみ（コード呼出点は不変）。
- Brownfield 規約: 既存ファイル（constants/schema 等）は in-place 修正、新規ドメインはディレクトリ追加。重複ファイルを作らない。

## スコープ・規模
- **新規**: `domain/survey/**`（model/ports/store/usecase）、`common/types/survey.ts`・`common/validators/survey.ts`、`api/private/surveys/**`（6 エンドポイント）、Prisma 3 モデル＋1 マイグレーション、テスト 3 種。
- **修正**: `common/constants/index.ts`（ID_NAME_LIST + survey enum 群）、`prisma/schema.prisma`。
- **ステップ総数**: 12（うち migrate 実行と test 実行が承認ゲート/環境依存）。
