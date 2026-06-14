# U2 — 業務ルール（Business Rules: 調査管理 ＋ 提出時一括同期 API）

確定回答（すべて推奨）に基づくビジネスルール・検証ルール・認可ルール・不変条件。各ルールは Code Generation で zod / Model 層 `assert*` / 状態遷移表として実装する。

---

## 1. 集約・データ整合ルール

- **BR-1**（1家屋=1調査, FR-01）: `Survey` は 1家屋に対する 1調査区分（第1次 or 第2次）を表す。`surveyType` は必須。
- **BR-2**（ID 冪等, Q2/Q3=A）: `Survey.id` はクライアント生成 ULID。同一 ID の再 ingest は冪等に扱う（§4 の冪等ルール）。
- **BR-3**（区分従属データ, Q20/Q22=A）: `surveyType=first` のとき `FirstSurvey` を、`second` のとき `SecondSurvey` を伴う。反対側の入力データを持ってはならない（混在は `ValidationError`）。
- **BR-4**（親参照, Q13=A）: `parentSurveyId` は `surveyType=second` のときのみ設定。第1次は `null`。第1次:第2次 = 1:N。
- **BR-5**（再調査の前提, FR-08/US-601, Q24=A）: 第2次の ingest は、`parentSurveyId` の Survey が `surveyType=first` かつ `status=confirmed` であることを要する。未確定・不在・型不一致は拒否。

## 2. 状態遷移ルール（FR-04 / Q15・Q16=A）

- **BR-6**（初期状態, Q1=A）: サーバ永続化の起点は提出。`ingestSubmission` 受理時の状態は `submitted`。サーバ上に `draft` の Survey は通常存在しない（`draft` はクライアント論理状態）。
- **BR-7**（許可遷移のみ）: 状態遷移は `assertTransition` の許可表に一致する場合のみ成功。表外は既定拒否（fail closed）。
  - `submitted --approve(admin)--> approved`
  - `approved --confirm(admin)--> confirmed`
  - `submitted|approved --reject(admin)--> draft*`（**後続実装**, Q16=A）
- **BR-8**（終端・不変, FR-05/US-505, Q17=A）: `confirmed` は終端。確定済み Survey の内容更新（再 ingest・PII 変更・遷移）はすべて拒否（`assertMutable`）。例外は正式判定メタ（official*）の設定のみ（BR-15）。
- **BR-9**（冪等な確定, PBT-04）: 既に `confirmed` の確定要求は no-op 成功（同一結果）。

## 3. 認可ルール（FR-42/43, SECURITY-08 / Q18・Q19=A）

多層防御（AD6=A）: L1=`api/private/hooks`（認証＋粗いガード）、L2=Model `assertRole`/`assertOwnerOrRole`（既定拒否, fail closed）。

- **BR-10**（提出, US-501）: `ingestSubmission`（submit）は **surveyor または admin**。
- **BR-11**（承認・確定・正式判定, US-503/504/606）: `approve`/`confirm`/`chooseOfficial` は **admin のみ**。非管理者は `ForbiddenError`→403。
- **BR-12**（読取スコープ, US-802, Q19=A）: surveyor/admin/viewer いずれも Survey を**全件読取可**（データモデルに自治体スコープ無し）。書込のみロールで制限。
- **BR-13**（PII 取得, Q9=A）: `victim*`（PII）は **surveyor/admin のみ**取得可。viewer には返さない（`toSurveyDto` でマスク）。詳細取得 API（`toSurveyDetailDto`）でのみ PII を返す。
- **BR-14**（提出後編集, US-501/505, Q18=A）: 提出以降、調査員は内容を編集できない（reject による下書き＝ローカル戻しは後続）。確定後は誰も編集不可（BR-8）。

## 4. ingestSubmission 冪等ルール（Q3=A / US-207）

- **BR-15a**: 既存 Survey なし → 新規作成（status=submitted）。
- **BR-15b**: 既存が `submitted`/`approved`（未確定） → 同期再試行とみなし、内容を上書き再受理（同一内容なら実質 no-op、同一 DTO 返却）。
- **BR-15c**: 既存が `confirmed` → 拒否（`ForbiddenError`。確定後の再送は不可）。

## 5. 正式判定ルール（FR-09/US-606, Q14=A）

- **BR-16**: 正式判定は admin のみ（BR-11）。
- **BR-17**: `officialSurveyId` は「当該第1次」または「その第2次群のいずれか」に限る。対象外 ID は `ValidationError`。
- **BR-18**: 正式判定の対象 Survey は `confirmed` であること（確定済み結果に対する選択）。
- **BR-19**: official*（`officialSurveyId`/`officialChosenBy`/`officialChosenAt`）は第1次 Survey に保持。確定後も設定・再設定可（判定「内容」は不変だが正式採用メタは管理者が更新しうる）。

## 6. 入力検証ルール（SECURITY-05 / US-801 / Q20〜Q22=A）

すべての API 入力は zod で検証（型・範囲・最大長）。U-Cross 共通バリデータ（`percentage`/`boundedString`/`numberInRange`/`epochMs`）を再利用。

| 項目 | ルール |
|---|---|
| `address` / `houseNumber` | 必須・非空・最大長 `DEFAULT_STRING_MAX`（`boundedString`） |
| `structureType` | 必須・`wood`/`nonWood` のいずれか |
| `buildingName` | 任意・最大長 `DEFAULT_STRING_MAX` |
| `floors` | 任意・整数・≥1 |
| `victimName`/`victimContact`/`victimAddress` | 任意・最大長 `DEFAULT_STRING_MAX`（PII, 値はログ/監査に平文記録しない） |
| `latitude` | 任意・数値・[-90, 90] |
| `longitude` | 任意・数値・[-180, 180] |
| `surveyType` | 必須・`first`/`second` |
| `parentSurveyId` | `second` のとき必須・ULID 形式（brandedId） |
| `externalForceFlags.*` | boolean |
| `tiltRatio` | 任意・数値・≥0（具体上限は U3c で確定, `numberInRange`） |
| `inundationDepthCm` | 任意・数値・≥0（妥当上限は U3c で確定） |
| `partDamages[].damageRatio` | 0–100（`percentage`） |
| `partDamages[].part` | 非空文字列（正準部位キー検証は U3c マスタ導入時に強化） |
| `floorApportionment[].floor` | 整数・≥1 |
| `floorApportionment[].ratio` | 0–100（`percentage`） |

- **BR-20**（階按分合計, US-404）: `floorApportionment` を指定する場合、`ratio` の総和=100（許容誤差は U3c 確定）。違反は `ValidationError`。
- **BR-21**（区分整合, BR-3）: `firstSurvey` は type=first のときのみ、`secondSurvey` は type=second のときのみ受理。
- **BR-22**（インジェクション対策）: 永続化は Prisma パラメタライズドのみ（U-Cross 既定）。文字列はサニタイズではなく型・長さ・形式検証で防御。

## 7. 監査ルール（NFR-08 / SECURITY-13 / Q26=A）

`auditUseCase.record(tx, event)` を同一トランザクションで呼ぶ（U-Cross）。

| 操作 | action | 記録内容 |
|---|---|---|
| 提出（ingest） | `survey.submit` | actor・surveyId・surveyType・status遷移 |
| 承認 | `survey.approve` | actor・前後 status |
| 確定 | `survey.confirm` | actor・前後 status |
| 正式判定 | `survey.officialJudgment` | actor・採用 officialSurveyId・前後値 |
| 差戻し（後続） | `survey.reject` | actor・前後 status |
| PII 登録/変更 | `pii.change` | **マスク済** before/after（`toFieldChanges(entries, pii=true)`） |

- **BR-23**（PII 非記録）: 監査 `changes` に PII 実値を残さない（マスク値のみ）。構造化ログにも PII/トークンを出力しない。
- **BR-24**（追記専用）: 監査は INSERT のみ（U-Cross `auditCommand` の不変条件 INV-D）。

## 8. エラー処理（SECURITY-15 / fail closed, U-Cross エラーハンドラ）

| 状況 | 例外型 | HTTP |
|---|---|---|
| 入力検証失敗・不正遷移・区分不整合・階按分合計不正・正式判定対象不正 | `ValidationError`（zod は ZodError） | 400 |
| 認証なし | （hooks 認証失敗） | 401 |
| ロール不足・他者の確定済みへの操作・確定済み更新 | `ForbiddenError` | 403 |
| 対象 Survey/親 不在 | `NotFoundError` | 404 |
| 想定外内部エラー | （汎用） | 500（詳細秘匿） |

- すべて U-Cross のグローバルエラーハンドラが型別にマッピング（fail closed, 詳細秘匿）。認可失敗（403）・認証失敗（401）は U-Cross が監査記録。

## 9. 不変条件（PBT / Q25=A, NFR-04）

- **INV-1（状態遷移健全性, PBT-06）**: 任意の {現状態, action, ロール} に対し、許可表に一致するときのみ遷移成功・それ以外は拒否。`confirmed` から出る遷移は存在しない。
- **INV-2（ペイロード往復, PBT-02）**: `SubmissionPayload → Entity → Dto → （再構成可能な範囲で）` の往復で意味的同一（ローカル保存↔同期の整合）。
- **INV-3（冪等性, PBT-04）**: 同一 ULID の再 ingest が重複レコードを生まない。確定の再実行が同一結果。
- **INV-4（区分排他, BR-3/21）**: 1 Survey は first/second いずれか一方の入力のみを保持する。
- **INV-5（PII 秘匿, BR-13/23）**: PII は viewer 向け DTO・監査 `changes`・ログのいずれにも実値が出現しない。

## 10. トレーサビリティ（ルール → 要件/ストーリー）
| ルール | 要件/ストーリー |
|---|---|
| BR-1〜5 | FR-01/06/07/08, US-201/601 |
| BR-6〜9 | FR-04/05, US-501/503/504/505 |
| BR-10〜14 | FR-42/43, SECURITY-08, US-501/502/503/802 |
| BR-15 | FR-19, NFR-02, US-207 |
| BR-16〜19 | FR-09, US-605/606 |
| BR-20〜22 | FR-11/28, SECURITY-05, US-404/801 |
| BR-23〜24 | NFR-08, SECURITY-13, US-803 |
| INV-1〜5 | NFR-04, §7 PBT, AC-4 |
