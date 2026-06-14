# U2 — コード生成サマリ（調査管理 Survey 集約 ＋ 提出時一括同期 API）

本書は U2 Code Generation Part 2（実行）の成果サマリです。計画は `aidlc-docs/construction/plans/U2-code-generation-plan.md`（Steps 1–12）。Brownfield のため既存ファイルは in-place 修正、新規ドメインはディレクトリ追加（重複ファイルなし）。

## 検証結果（Step 12）
- `npx tsc --noEmit`（server）: **PASS**（0 errors）
- `npm test`（vitest + coverage, docker compose: postgres/magnito/minio/inbucket）: **16 ファイル / 110 テスト PASS**
- カバレッジ: **All files 100%**（statements / branches / functions / lines）。`vite.config.ts` の対象 `domain/**`・`common/**`・`api/**/{controller,hooks,validators}.ts` をすべて 100% 達成。
- eslint: クリーン（complexity≤5, max-lines≤200, no-non-null-assertion, no-unnecessary-condition, explicit-function-return-type を遵守）。
- マイグレーション `20260614074112_add_survey`（加法的・非破壊）作成・適用済み。`npx prisma generate` ＋ `frourio`（`$server.ts`）＋ `npx aspida`（`$api.ts`）再生成済み。

## 新規ファイル
### 共通（common, client と共有）
- `common/types/survey.ts` — `SurveyType`/`SurveyStatus`/`StructureType`、値オブジェクト（`FloorRatio`/`PartDamage`/`ExternalForceFlags`/`AssessmentResult`）、`FirstSurveyData`/`SecondSurveyData`、`SurveyCommon`/`SurveyPii`/`SurveyBase`、`SurveyDto`（PII 除外）/`SurveyDetailDto`（PII 含む）、`SubmissionPayload`、`HouseResultsDto`、`PhotoMeta`。
- `common/validators/survey.ts` — `surveyValidator.submissionBody`（superRefine を `refineFirstType`/`refineSecondType`/`refineFloorSum` に分解、区分排他・親 ID・階按分合計=100）、`chooseOfficialBody`、`surveyTypeValidator`/`structureTypeValidator`。

### ドメイン（domain/survey）
- `model/surveyType.ts` — `SurveyEntity`。
- `model/surveyMethod.ts` — `createFromSubmission`（`orNull`/`firstDataFromPayload`/`secondDataFromPayload` で分岐集約）、`applyAssessment`、`assertTransition`（表駆動・reject 行は定義のみ）、`assertMutable`、`assertReexaminationAllowed`、`assertOfficialTarget`、`approve`/`confirm`/`applyOfficial`。
- `model/surveyDispatch.ts` — `assessmentInput`（区分別判定入力）、`requireParent`（第2次の親 ID 要求）。純粋・到達可能な検証分岐。
- `model/surveyPolicy.ts` — `assertSubmitter`/`assertApprover`/`canViewPii`/`maskPii`（L2 認可・PII 開示ポリシー）。
- `model/surveyAudit.ts` — `submitEvents`（survey.submit ＋ PII 時 pii.change マスク）/`statusEvent`/`officialEvent`（純粋イベントビルダー）。
- `ports/assessmentPort.ts` — velona `depend` スタブ（`calcFirst`/`calcSecond`、決定論的 `damageRatio=0`/`damageLevel='unclassified'`）。**U3a/U3b が実装注入**。
- `ports/photoPort.ts` — velona `depend` スタブ（`persist` no-op、参照素通し）。**U4 が S3 実装注入**。
- `store/toSurveyDto.ts` — `toSurveyDto`（PII 除外）/`toSurveyDetailDto`（PII 含む）、`SurveyRow` 型。
- `store/surveyCommand.ts` — `upsert`（Survey ＋ FirstSurvey/SecondSurvey 同一 tx、create のみ createdBy/At 設定）。
- `store/surveyQuery.ts` — `findDetailById`/`findById`/`list`/`listByParent`。
- `surveyUseCase.ts` — `ingestSubmission`（velona `depend({ assessmentPort, photoPort })`、冪等・原子的・監査）、`approve`/`confirm`（冪等 no-op）/`chooseOfficial`/`get`（PII マスク）/`list`/`getHouseResults`。

### API（api/private/surveys、frourio/aspida）
| メソッド・パス | UseCase | 認可(L1) | ストーリー |
|---|---|---|---|
| `POST /surveys/submission` | `ingestSubmission` | surveyor/admin | US-201/202/203/207/501/601 |
| `GET /surveys` | `list` | 認証者 | US-703（最小） |
| `GET /surveys/:surveyId` | `get` | 認証者（PII は surveyor/admin） | US-605 詳細 |
| `POST /surveys/:surveyId/approve` | `approve` | admin | US-503 |
| `POST /surveys/:surveyId/confirm` | `confirm` | admin | US-504 |
| `POST /surveys/:surveyId/official` | `chooseOfficial` | admin | US-606 |
| `GET /surveys/:surveyId/results` | `getHouseResults` | 認証者 | US-605 併記 |

> 計画の 6 エンドポイントに対し **`/results`（US-605 結果併記）を追加**（ストーリー・トレーサビリティ表で US-605→Step 8 にマップされていたため）。`reject` は遷移表に定義のみ・API/UseCase 実装は後続（Q16=A）。

### テスト（tests）
- `tests/unit/surveyFixtures.ts`（共有ビルダー）、`surveyMethod.test.ts`、`surveyDispatch.test.ts`、`surveyPolicy.test.ts`、`surveyAudit.test.ts`、`surveyValidator.test.ts`、`surveyDto.test.ts`、`tests/api/private/surveys.test.ts`。
- 不変条件: **INV-1**（状態遷移健全性 PBT・confirmed 終端）、**INV-2**（ペイロード↔エンティティ↔DTO 往復）、**INV-3**（冪等再送・確定後再送 403、API）、**INV-4**（区分排他）、**INV-5**（PII マスク・viewer DTO/監査 changes に実値非出現）。

## 修正ファイル
- `common/constants/index.ts` — `ID_NAME_LIST += 'survey'`、`SURVEY_TYPE_LIST`/`SURVEY_STATUS_LIST`/`STRUCTURE_TYPE_LIST` ＋各表示名マップ（`*_NAMES`/`*_DISPLAY`）。`AUDIT_ACTION_LIST` は既に `survey.*`/`pii.change` を含む（追記不要）。
- `prisma/schema.prisma` — `Survey`/`FirstSurvey`/`SecondSurvey` を加法的に追加（enum は String カラム＋アプリ層 zod、部位/階按分・externalForceFlags・assessmentBasis は Json）。

## 設計上の要点
- **DDD レイヤリング**: Controller（zod＋L1 認可）→ UseCase（`transaction('RepeatableRead')`・監査・ポート呼出）→ Model（純粋・L2）→ Store。
- **DI（velona `depend`）**: `surveyUseCase.ingestSubmission` が `assessmentPort`/`photoPort` を依存注入。U2 はスタブ既定、後続は `.inject()`／本番組成で実装差替（呼出点不変）。
- **冪等性（BR-15）**: 同一 ULID 再 ingest は upsert で重複なし。未確定は上書き再受理、`confirmed` 再送は `ForbiddenError`(403)。確定は既 confirmed なら no-op 成功。
- **PII 保護**: `toSurveyDto`（一覧）は PII 除外、詳細は surveyor/admin のみ実値・viewer はマスク。監査は `pii.change` でマスク済 before/after（実値非記録）。
- **fail closed エラー方針**: 検証/遷移/区分/階按分/正式判定対象不正→400、ロール不足・確定後更新→403、対象不在→404（U-Cross グローバルハンドラがマッピング）。

## 後続ユニットへの申し送り
- **U3a/U3b**: `assessmentPort.calc{First|Second}` の本実装を注入（`depend` の dependency 差替、または `ingestSubmission.inject`）。被害度区分（damageLevel）・経路別 basis を確定。
- **U3c**: 部位キー／階按分の正準マスタ導入時に `partDamages`/`floorApportionment` の検証強化・許容誤差確定。
- **U4**: `photoPort.persist` の S3 保存実装を注入（Photo モデル・キー採番）。
- **U5**: `surveyQuery` 上に検索/ページング/絞り込み/エクスポートを拡張。
- **U6f/U6u**: `POST /surveys/submission`（`SubmissionPayload`）契約に追従。クライアント・ローカル（IndexedDB）PII 暗号化と同期成功後の消去。
- **後続（reject）**: `survey.reject`（US-502）の UseCase/API 実装（遷移表は対応済み）。

## 残作業（U2 スコープ外）
- `reject` 実装、部位/階按分マスタ（U3c）、判定計算（U3a/U3b）、画像保存（U4）、一覧/検索（U5）、クライアント同期 UI（U6f/U6u）。
