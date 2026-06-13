# コンポーネント メソッド定義（Application Design）

各コンポーネントの主要メソッドのシグネチャ（高レベル）。詳細な業務ルール・数値ロジックは Functional Design で確定する。型は既存 CATAPULT 規約（Branded ID: `EntityId`/`DtoId`/`MaybeId`、`XxxBase`/`XxxDto`/`XxxEntity`、zod validators）に準拠。副作用は Store/Service/UseCase 境界に限定し、Model は純粋関数とする。

凡例: `tx: Prisma.TransactionClient`、`user: UserDto`（ロール込み）。

---

## 1. `auth`（拡張: 既存 user ドメイン）

### model（純粋）
- `assertRole(user: UserDto, allowed: Role[]): void` — 機能レベル認可（違反は例外→403）。
- `assertOwnerOrRole(user: UserDto, ownerId: DtoId, allowed: Role[]): void` — オブジェクトレベル認可。
- `resolveRole(claims: CognitoClaims): Role` — Cognito 属性/グループ → ロール解決。

### store
- `userQuery.findOrCreate(tx, claims): Promise<UserDto>` — 既存踏襲＋role 付与。

---

## 2. `survey`（集約ルート — UseCase / Model / Store）

### model（純粋）
- `surveyMethod.create(user, payload: CreateSurveyPayload): SurveyEntity` — 区分=入力、状態=下書き、識別情報設定、`brandedId.survey.entity` 生成。
- `surveyMethod.attachPii(survey: SurveyEntity, pii: PiiPayload): SurveyEntity` — PII 付与（暗号化は Store/Service）。
- `surveyMethod.submit(user, survey): SurveyEntity` — 下書き→提出。`assertRole(調査員/管理者)`、所有者チェック。
- `surveyMethod.approve(user, survey): SurveyEntity` — 提出→承認。`assertRole(管理者)`。
- `surveyMethod.reject(user, survey): SurveyEntity` — 提出→下書き（差戻し、後続）。
- `surveyMethod.finalize(user, survey): SurveyEntity` — 承認→確定。確定後不変。
- `surveyMethod.assertMutable(survey): void` — 確定済みは編集拒否（FR-05）。
- `surveyMethod.chooseOfficial(user, survey, choice: 'first'|'second'): SurveyEntity` — 正式判定選択（`assertRole(管理者)`、FR-09）。
- `surveyMethod.assertTransition(from, to): void` — 不正遷移排除（PBT-06）。

### store
- `surveyQuery.findById(tx, user, surveyId): Promise<SurveyDto>` — 所有/ロール認可込み。
- `surveyQuery.list(tx, user, filter): Promise<SurveyDto[]>` — 一覧/検索（FR-43, NFR-03）。
- `surveyQuery.findPairByHouse(tx, user, houseKey): Promise<{first?: SurveyDto; second?: SurveyDto}>` — 第1次/第2次併記用（FR-09）。
- `surveyCommand.save(tx, user, entity): Promise<SurveyDto>` — upsert＋監査記録。
- `surveyCommand.saveOfficial(tx, user, surveyId, determination): Promise<SurveyDto>` — 正式判定保存＋監査。

### usecase（トランザクション境界）
- `surveyUseCase.create(user, body)` / `submit(user, body)` / `approve(user, body)` / `finalize(user, body)` / `chooseOfficial(user, body)` — `transaction('RepeatableRead', ...)`。
- `surveyUseCase.ingestSubmission(user, payload: SubmissionPayload)` — ★提出時一括同期の受信口（入力＋画像メタ一括登録→計算→状態=提出）。FR-19。

---

## 3. `firstSurvey`（第1次）

### model（純粋）
- `firstSurveyMethod.create(user, surveyId, payload: FirstInputPayload): FirstSurveyEntity` — 外力フラグ・傾斜・浸水深・階按分入力を保持。
- `firstSurveyMethod.update(user, entity, payload): FirstSurveyEntity` — `assertMutable` 連携。

### store
- `firstSurveyQuery.findBySurveyId(tx, user, surveyId): Promise<FirstSurveyDto>`。
- `firstSurveyCommand.save(tx, user, entity): Promise<FirstSurveyDto>`。

---

## 4. `secondSurvey`（第2次・再調査）

### model（純粋）
- `secondSurveyMethod.startReexamination(user, finalizedFirst: SurveyDto): SecondSurveyEntity` — 第1次確定前提（未確定は例外、FR-08）。親第1次参照を設定。
- `secondSurveyMethod.upsertPartDamage(entity, part: PartId, ratio: number): SecondSurveyEntity` — 部位別損傷率（0–100 検証は validator）。
- `secondSurveyMethod.update(user, entity, payload): SecondSurveyEntity`。

### store
- `secondSurveyQuery.findBySurveyId(tx, user, surveyId): Promise<SecondSurveyDto>`。
- `secondSurveyCommand.save(tx, user, entity): Promise<SecondSurveyDto>`。

---

## 5. `assessment`（純粋計算カーネル）★AD1=A / AD3=A

すべて副作用なしの純粋関数。定数は `assessment/constants`（コード内、バージョン管理）。

### calc（純粋）
- `calcFirst(input: FirstInput): AssessmentResult` — 外力・流失該当→全壊、または傾斜＋浸水深から損害割合算出（FR-20〜22）。
- `calcSecond(input: SecondInput): AssessmentResult` — Σ(部位損傷率 × 構成比) → 損害割合（FR-23）。
- `applyFloorRatio(input, floorRatios: FloorRatio[]): SecondInput | FirstInput` — 階ごと床面積按分の反映（FR-28）。比率総和=100% 検証。
- `classifyDamageLevel(damageRatio: number): DamageLevel` — 6区分マッピング（境界 50/40/30/20/10%、FR-24）。
- `assertResultInvariants(result): void` — 0–100% 範囲・区分排他/網羅（PBT-03）。

### constants（コード内定数）★AD3=A
- `PART_COMPOSITION_RATIOS: Record<PartId, number>`（構成比、総和=1）。
- `INUNDATION_DEPTH_TABLE: Array<{minCm; maxCm; damageRatio}>`（浸水深→損害割合）。
- `PART_DEFINITIONS: { external: PartId[]; internal: PartId[] }`。
- `DEFAULT_FLOOR_RATIOS: FloorRatio[]`。
- `DAMAGE_LEVEL_THRESHOLDS`（6区分境界）。
- `MASTER_VERSION: string`（バージョン管理）。

---

## 6. `photo`

### model（純粋）
- `photoMethod.create(user, surveyId, kind: 'part'|'whole', partId?, image): PhotoEntity` — `s3Key = surveys/{surveyId}/photos/{ulid}.{ext}`、MIME/拡張子検証（SECURITY）。

### store
- `photoCommand.save(tx, user, entity, binary): Promise<PhotoDto>` — S3 put＋DB。
- `photoCommand.saveMany(tx, user, entities, binaries): Promise<PhotoDto[]>` — ★同期一括登録用。
- `photoQuery.listBySurveyId(tx, user, surveyId): Promise<PhotoDto[]>`。

---

## 7. `export`（サーバ生成）★AD4=A

### service/domain
- `exportUseCase.buildSurveyPdf(user, surveyId): Promise<{ pdf: Buffer; filename: string }>` — 認可後、Query→整形→PDF（調査票様式、FR-33）。
- `exportUseCase.buildSurveyCsv(user, filter): Promise<{ csv: Buffer; filename: string }>` — 複数件（FR-32）。認可範囲のみ。

---

## 8. クライアント側メソッド（ローカルファースト）

### `LocalDraftStore`（IndexedDB, 暗号化）★AD2-FU=A
- `saveDraft(surveyDraftId, data: DraftData): Promise<void>` — 入力＋進捗を暗号化保存。
- `savePhoto(surveyDraftId, photo: LocalPhoto): Promise<void>` — 画像バイナリをローカル保持。
- `loadDraft(surveyDraftId): Promise<DraftData | null>` — 復元（再読込/復帰）。
- `listPendingDrafts(): Promise<DraftSummary[]>`。
- `purgeAfterSync(surveyDraftId): Promise<void>` — ★同期成功確認後に PII・画像を消去（SECURITY-01）。

### `SyncOnSubmit`（提出時一括同期）★AD2-FU2=A
- `submitAndSync(surveyDraftId): Promise<SubmissionResult>` — Draft＋画像を `SubmissionPayload` 化→`api.private.surveys.submission.$post`→成功確認→`purgeAfterSync`。
- `enqueueOnFailure(surveyDraftId, error): void` — 不通/失敗時キューイング。
- `retryPending(): Promise<void>` — オンライン復帰時の再試行。

### `SurveyWizard`
- `goToStep(stepId)` / `next()` / `prev()` / `isStepApplicable(stepId): boolean`（スキップ判定）/ `computeProgress(): Progress`。

---

## 9. 入力検証（共有 zod validators）
- `surveyValidator.createBody / submissionBody / approveBody / officialBody`。
- `firstSurveyValidator.inputBody`（傾斜・浸水深の範囲/型）。
- `secondSurveyValidator.inputBody`（部位別損傷率 0–100、階按分総和=100%）。
- `exportValidator.csvQuery`。
すべて API 境界で適用（SECURITY-05, US-801）。
