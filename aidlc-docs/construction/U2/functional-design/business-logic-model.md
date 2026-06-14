# U2 — 業務ロジックモデル（Business Logic Model: 調査管理 ＋ 提出時一括同期 API）

技術非依存のユースケース／ドメインロジック設計。DDD レイヤリング（Controller → UseCase → Model → Store/Port）と DI（velona）に準拠。確定回答（すべて推奨）に基づく。

---

## 0. レイヤと責務

```
api/private/surveys/**/controller.ts   … 入力検証(zod)・認可L1(hooks)・DTO 返却
        │
domain/survey/surveyUseCase.ts         … トランザクション境界・オーケストレーション・監査・ポート呼出
domain/survey/secondSurveyUseCase.ts   … 第2次特有のオーケストレーション（必要に応じ統合）
        │
domain/survey/model/surveyMethod.ts    … 純粋ドメインロジック（生成・遷移・認可L2・不変性）
domain/survey/model/surveyType.ts      … エンティティ型
        │
domain/survey/store/surveyCommand.ts   … 書込（save/upsert）
domain/survey/store/surveyQuery.ts     … 読取（findById/list/countByParent 等）
domain/survey/store/toSurveyDto.ts     … エンティティ→DTO（PII マスク版/詳細版）
        │
ports: assessmentPort（U3a/U3b 実装） / photoPort（U4 実装）  … DI 注入
```

- すべての関数は DI 可能（`depend` / velona, NFR-09）。Model は純粋関数でフレームワーク非依存。
- 監査記録は UseCase 層で同一トランザクションに参加（`auditUseCase.record(tx, event)`, U-Cross）。

---

## 1. 状態機械（FR-04 / Q15・Q16・Q17=A）

### 遷移定義
```
[draft*]  --submit(surveyor)-->  submitted  --approve(admin)-->  approved  --confirm(admin)-->  confirmed(終端・不変)
                                     ^                                |
                                     |------- reject(admin, 後続) ----+  （submitted/approved -> draft*）
```
- `draft*` はクライアント・ローカルの論理状態（サーバ未永続化, Q1=A）。サーバ上の Survey は通常 `submitted` から始まる。
- `confirmed` は終端。以降あらゆる更新を拒否（`assertMutable`, Q17=A）。再判定は第2次（別記録）で対応。
- **reject（US-502, 後続）**: 遷移表には含めるが、UseCase/API 実装は後続フェーズ（Q16=A）。`assertTransition` は将来拡張に耐える表駆動で実装。

### `surveyMethod.assertTransition(current, action, actor)`（純粋・L2）
- 許可表（{現状態 × action × 必要ロール}）に一致する場合のみ次状態を返す。不一致は `ForbiddenError`（権限不足）または `ValidationError`（不正遷移）。
- 既定拒否（fail closed, SECURITY-08/15）。表にないものは一律拒否。

| current | action | 許可ロール | next | MVP実装 |
|---|---|---|---|---|
| submitted | approve | admin | approved | ○ |
| approved | confirm | admin | confirmed | ○ |
| submitted/approved | reject | admin | (draft*=ローカル戻し) | 後続 |
| (submission 受信) | submit | surveyor/admin | submitted | ○（ingest 内） |

### `surveyMethod.assertMutable(survey)`（Q17=A）
- `status === 'confirmed'` なら `ForbiddenError`（確定後不変, FR-05/US-505）。あらゆる更新系（再 ingest・PII 変更・遷移）の前に適用。

---

## 2. `surveyUseCase.ingestSubmission`（提出時一括同期 / FR-18・19, US-207, Q1〜Q6=A）

提出時にクライアント（U6f）が IndexedDB の入力・画像を一括送信。サーバはこれを**原子的**に処理する。

### 入力契約（SubmissionPayload）
```
{
  survey: {
    id: ULID(クライアント生成),           // 冪等キー（Q2/Q3）
    surveyType: 'first' | 'second',
    parentSurveyId?: ULID,                // 第2次のとき必須（親=確定済み第1次）
    address, houseNumber, structureType, buildingName?, floors?,
    victimName?, victimContact?, victimAddress?,   // PII（Q7）
    latitude?, longitude?,                // GPS（Q12）
  },
  firstSurvey?: { externalForceFlags, tiltRatio?, inundationDepthCm?, floorApportionment? },   // type=first
  secondSurvey?: { partDamages, floorApportionment? },                                          // type=second
  photos?: PhotoMeta[]                    // 画像メタ（実体保存は photoPort=U4）
}
```
- クライアントが算出したプレビュー計算値は**受理しても保存しない**（サーバ再計算, Q6=A）。

### 処理フロー（`transaction('RepeatableRead', ...)`）
1. **認可 L1/L2**: 認証済み（hooks）＋ `assertRole(actor, [surveyor, admin])`（提出は調査員/管理者, Q18）。
2. **入力検証**: zod（型・範囲・最大長, §J 検証ルール）。不正は `ValidationError`→400。
3. **冪等性判定（Q3=A）**: `surveyQuery.findById(tx, payload.survey.id)`。
   - 既存が `confirmed` → `ForbiddenError`（確定後の再送は不可, fail closed）。
   - 既存が `submitted`/`approved` → 同一内容なら **no-op で現状を返す**（再試行の成功扱い）。内容差異がある未確定再送は上書き（提出として再受理）。
   - 既存なし → 新規作成。
4. **第2次の親検証（Q13/Q24=A）**: `surveyType=second` の場合、`parentSurveyId` の Survey が存在し `status=confirmed` かつ `surveyType=first` であることを検証（`surveyMethod.assertReexaminationAllowed`）。違反は `ValidationError`/`ForbiddenError`。
5. **エンティティ生成**: `surveyMethod.createFromSubmission(actor, payload)` → `status='submitted'`、`createdBy=actor.id`、`submittedAt=now`。
6. **計算（Q5/Q6=A）**: `assessmentPort.calc{First|Second}(input, floorApportionment)` を呼び `AssessmentResult` を取得し Survey に設定（U2 はスタブ注入。U3a/U3b で実装差替）。
7. **永続化**: `surveyCommand.upsert(tx, surveyEntity)` ＋ `firstSurvey`/`secondSurvey` 保存。
8. **画像（Q4=A）**: `photoPort.persist(tx, surveyId, photos)`（U2 は no-op スタブ、U4 で S3 保存実装）。
9. **監査（Q26=A）**: `auditUseCase.record(tx, { action:'survey.submit', actorUserId, targetType:'survey', targetId:id, outcome:'success', summary, changes })`。PII を新規/変更登録した場合は `pii.change`（マスク済 before/after）も記録。
10. **返却**: `toSurveyDetailDto`（提出者は自分の提出内容を確認可）。

### 原子性・再試行（US-207）
- 全処理は単一トランザクション。途中失敗は全ロールバック（部分登録なし）。クライアントは失敗時ローカル保持・再送（同じ ULID で冪等）。
- 同期成功（2xx）確認後にクライアントがローカル PII/画像を消去（U6f の責務）。

---

## 3. 状態遷移ユースケース（US-503/504）

### `surveyUseCase.approve(actor, surveyId)`
- `transaction`：`assertRole(actor,[admin])` → `findById` → `assertMutable` → `assertTransition(survey,'approve',actor)` → `surveyCommand.save`（status=approved, approvedBy/At） → `auditUseCase.record(action:'survey.approve')`。
- 非管理者は `ForbiddenError`→403（US-503）。

### `surveyUseCase.confirm(actor, surveyId)`
- 同様に `assertTransition(...,'confirm')` → status=confirmed, confirmedBy/At → 監査 `survey.confirm`。
- **冪等性（PBT-04）**: 既に `confirmed` の同一確定要求は no-op 成功扱い（同じ DTO を返す）。それ以外の確定済みへの更新は拒否。

### `surveyUseCase.reject`（後続 / Q16=A）
- 遷移表に定義のみ。実装は後続フェーズ。

---

## 4. 第2次調査（再調査）/ US-601, FR-07/08, Q24=A

- **開始専用 API は設けない**（Q24=A）。クライアントが第2次をローカル作成（surveyType=second, parentSurveyId=確定済み第1次）し、`ingestSubmission` で同期。
- サーバは ingest 時に親第1次の `confirmed` を検証（§2-4）。未確定なら拒否（US-601 の異常系）。
- 第1次:第2次 = 1:N（Q13=A）。`surveyQuery.listByParent(firstSurveyId)` で第2次群を取得。

---

## 5. 結果併記・正式判定（US-605/606, FR-09, Q14=A）

### 併記表示（US-605）
- `surveyUseCase.getHouseResults(actor, firstSurveyId)`：第1次＋その第2次群の `AssessmentResult` を併記して返す（管理者/閲覧者/調査員、PII は認可で制御, Q9）。

### 正式判定（US-606）
- `surveyUseCase.chooseOfficial(actor, firstSurveyId, officialSurveyId)`：
  1. `assertRole(actor,[admin])`（管理者のみ。調査員/閲覧者は `ForbiddenError`, US-606 異常系）。
  2. `officialSurveyId` が「当該第1次」または「その第2次群のいずれか」であることを検証（不正は `ValidationError`）。
  3. 対象 Survey 群が `confirmed` であること（正式判定は確定済み結果に対して行う）。
  4. 第1次 Survey に `officialSurveyId`/`officialChosenBy`/`officialChosenAt` を設定（Q14=A）。
  5. 監査 `survey.officialJudgment`（actor・採用 ID・前後値）。
- **確定不変性との関係**: 正式判定は第1次の official* フィールドのみ更新する操作で、`assertMutable` の対象外（確定済み調査の「内容」は変えない）。official* は確定後も設定可能なメタ情報として扱う（Q17=A の趣旨＝判定内容の不変は維持）。

---

## 6. 取得・一覧（最小 / Q23=A）

- `surveyUseCase.get(actor, surveyId)` → `toSurveyDetailDto`（PII 含む, 調査員/管理者のみ。閲覧者は PII マスク版）。
- `surveyUseCase.list(actor)` → `toSurveyDto`（PII 除外）。読取スコープ（Q19=A）: surveyor/admin/viewer いずれも全件読取可（書込はロール制限）。本格的な検索/ページング/絞り込みは **U5**。

### DTO 変換（PII マスキング, Q9=A）
| 変換 | PII | 用途 |
|---|---|---|
| `toSurveyDto` | 除外/マスク | 一覧・併記・低権限 |
| `toSurveyDetailDto` | 含む | 詳細取得（調査員/管理者のみ） |

---

## 7. 公開 API エンドポイント（frourio/aspida, `api/private/surveys/...`, Q23=A）

| メソッド・パス | UseCase | 認可 | ストーリー |
|---|---|---|---|
| `POST /surveys/submission` | `ingestSubmission` | surveyor/admin | US-201/202/203/207/501/601 |
| `GET /surveys` | `list` | 認証者（全件読取, Q19） | US-703 の最小（本格は U5） |
| `GET /surveys/:surveyId` | `get` | 認証者（PII は surveyor/admin） | US-605 詳細 |
| `POST /surveys/:surveyId/approve` | `approve` | admin | US-503 |
| `POST /surveys/:surveyId/confirm` | `confirm` | admin | US-504 |
| `POST /surveys/:surveyId/official` | `chooseOfficial`（body: officialSurveyId） | admin | US-606 |
| （`POST /surveys/:surveyId/reject`） | `reject` | admin | US-502（後続・未実装） |

- すべて `api/private` 配下＝認証必須（hooks L1）。各 controller で zod 検証 ＋ UseCase 呼出。
- frourio の規約に従い `controller.ts`/`index.ts`（zod スキーマ）を配置。`$api.ts`/`$relay.ts` は再生成。

---

## 8. ポート結線（DI / Q4・Q5=A）
- `surveyUseCase` は `assessmentPort` / `photoPort` を依存として受け取る（velona `depend`）。本番組成では U3a/U3b/U4 実装を注入、U2 単体テストではスタブを注入。
- 呼出点（ingest の Step 6・8）は実装差替時も不変。後続ユニットは実装提供のみで結線完了。

---

## 9. テスト方針（PBT 全面適用 / Q25=A, NFR-04）
- **PBT-06（状態遷移）**: 生成した {現状態, action, ロール} の全組合せに対し、許可表どおりに成功/拒否され、`confirmed` が終端であること（不正遷移が起きない）。
- **PBT-02（ペイロード往復）**: SubmissionPayload ↔ ドメインエンティティ ↔ DTO の往復同一性（IndexedDB ローカル保存↔同期ペイロードの構造整合）。
- **PBT-04（冪等性）**: 同一 ULID の再 ingest が重複を生まない／確定の再実行が同一結果。
- **例示テスト**: 第1次/第2次提出、承認・確定の正常系、確定後更新拒否、他ロールの操作拒否（403）、親未確定の第2次拒否、正式判定の選択。
- ポートはスタブで決定論化（計算結果固定）。API テストは docker compose スタック（postgres/magnito/minio/inbucket）で実行。
