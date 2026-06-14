# U2 — ドメインエンティティ（Domain Entities: 調査管理 Survey 集約）

技術非依存のドメインモデル定義。実装（Prisma スキーマ・brandedId・zod）は Code Generation で行う。確定回答（Q1〜Q27, すべて推奨）に基づく。

---

## 0. 集約の全体像

```
Survey（集約ルート）── 1:1 ──▶ FirstSurvey（surveyType=first のとき）
        │
        ├── 1:1 ──▶ SecondSurvey（surveyType=second のとき）
        │
        ├── 埋め込み ──▶ 被災者 PII（victim*）
        ├── 埋め込み ──▶ GPS（latitude/longitude）
        ├── 埋め込み ──▶ AssessmentResult（damageRatio/damageLevel/basis）
        └── 埋め込み ──▶ 正式判定（officialSurveyId/officialChosenBy/officialChosenAt：第1次のみ）

第2次 Survey ── parentSurveyId ──▶ 第1次 Survey（1:N：第1次1件に第2次複数, Q13=A）
Photo（U4, 別ユニット）── surveyId ──▶ Survey（U2 は photoPort 経由で結線, Q4=A）
```

- **集約境界**: `Survey` が集約ルート。`FirstSurvey`/`SecondSurvey` は同一トランザクション内で Survey と整合させる従属エンティティ（surveyId を主キー＝1:1）。
- **ID 採番（Q2=A）**: `Survey.id` は **クライアント生成 ULID**。`ID_NAME_LIST` に `'survey'` を追加し、`brandedId` が型/バリデータを自動生成。`FirstSurvey`/`SecondSurvey` は `surveyId` を主キーとして共有（独自 ULID は持たない）。

---

## 1. Survey（集約ルート）

| 属性 | 型 | 必須 | 説明・出典 |
|---|---|---|---|
| `id` | `DtoId['survey']`（ULID, クライアント生成） | ○ | 調査識別子・冪等キー（Q2/Q3=A）。FR-01 |
| `surveyType` | `SurveyType`（`first`/`second`） | ○ | 調査区分。FR-06 |
| `parentSurveyId` | `DtoId['survey'] \| null` | △ | 第2次のとき第1次への参照。第1次は null。FR-07, Q13=A |
| `status` | `SurveyStatus`（`draft`/`submitted`/`approved`/`confirmed`） | ○ | 状態。サーバ初期値=`submitted`（Q1/Q15=A）。FR-04 |
| **家屋識別情報（Q10=A）** | | | FR-01 |
| `address` | string（最大長 `DEFAULT_STRING_MAX`） | ○ | 住所 |
| `houseNumber` | string | ○ | 家屋番号 |
| `structureType` | `StructureType`（`wood`/`nonWood`） | ○ | 構造種別（Q11=A）。表示名は日本語マップ |
| `buildingName` | string \| null | △ | 建物名（任意） |
| `floors` | int \| null（≥1） | △ | 階数（任意・階按分に利用） |
| **被災者 PII（埋め込み, Q7=A）** | | | FR-02。保護は §4 |
| `victimName` | string \| null | △ | 氏名（PII） |
| `victimContact` | string \| null | △ | 連絡先（PII） |
| `victimAddress` | string \| null | △ | 被災者住所（PII。家屋住所と別管理可） |
| **GPS（Q12=A）** | | | FR-03 |
| `latitude` | number \| null | △ | 緯度（任意・取得不可時 null, US-203） |
| `longitude` | number \| null | △ | 経度（任意） |
| **判定結果（埋め込み, Q5/Q6=A）** | | | FR-26。提出時にサーバ再計算で設定 |
| `damageRatio` | number（0–100）\| null | △ | 損害割合（％）。`assessmentPort` 算出結果 |
| `damageLevel` | string \| null | △ | 被害度6区分のキー（区分定義は U3c）。FR-24 |
| `assessmentBasis` | Json \| null | △ | 計算根拠（経路別中間値, US-403 後続表示用） |
| **正式判定（第1次のみ, Q14=A）** | | | FR-09, US-606 |
| `officialSurveyId` | `DtoId['survey']` \| null | △ | 採用した Survey（第1次 or 第2次）の ID |
| `officialChosenBy` | `DtoId['user']` \| null | △ | 正式判定の選択者（管理者） |
| `officialChosenAt` | epoch ms \| null | △ | 正式判定の確定日時 |
| **実施者・日時（監査・履歴）** | | | NFR-08 |
| `createdBy` | `DtoId['user']` | ○ | 作成（＝提出）した調査員 |
| `createdTime` | epoch ms | ○ | 作成日時（既存規約 `*Time` に倣う） |
| `submittedAt` | epoch ms \| null | △ | 提出日時 |
| `approvedBy` / `approvedAt` | `DtoId['user']`/epoch \| null | △ | 承認者・承認日時 |
| `confirmedBy` / `confirmedAt` | `DtoId['user']`/epoch \| null | △ | 確定者・確定日時 |

### 値オブジェクト / enum
- `SurveyType = 'first' | 'second'` ＋ 表示名マップ（第1次/第2次）。
- `SurveyStatus = 'draft' | 'submitted' | 'approved' | 'confirmed'` ＋ 表示名マップ（下書き/提出/承認/確定）。enum は完全形で定義するが、サーバ上 `draft` は通常出現しない（クライアント・ローカルの論理状態, Q1=A）。
- `StructureType = 'wood' | 'nonWood'` ＋ 表示名マップ（木造/非木造）。

> 命名規約（U1 Q5=A と統一）: 英語 enum ＋ 日本語表示名マップを `common/constants` に集約。`ID_NAME_LIST += 'survey'`、`SURVEY_TYPE_LIST` / `SURVEY_STATUS_LIST` / `STRUCTURE_TYPE_LIST` を追加。

---

## 2. FirstSurvey（第1次入力データ実体 / Q20=A）

`surveyType=first` の Survey に 1:1（主キー=`surveyId`）。計算規則は U3a、本ユニットはデータ保持のみ。

| 属性 | 型 | 必須 | 説明 |
|---|---|---|---|
| `surveyId` | `DtoId['survey']` | ○ | 親 Survey（主キー兼 FK） |
| `externalForceFlags` | `{ houseWashedAway: boolean; groundScour: boolean; foundationWashout: boolean; fullCeilingInundation: boolean }` | ○ | 外力・流失等の該当（FR-20, US-301）。いずれか該当で全壊扱い（規則は U3a） |
| `tiltRatio` | number（≥0, 比率） | △ | 傾斜・実測（FR-21, US-302）。単位=比率（Q21=A） |
| `inundationDepthCm` | number（≥0, cm） | △ | 浸水深（FR-22, US-303）。単位=cm（Q21=A） |
| `floorApportionment` | `FloorRatio[]`（§5） | △ | 階按分（FR-28, US-404） |

> 範囲上限（浸水深の妥当上限・傾斜の許容範囲）は U-Cross の `numberInRange` を用い、運用指針準拠の具体値は **U3c マスタ確定時に最終化**（Q21=A）。U2 では型と非負・範囲の緩い境界のみ強制。

---

## 3. SecondSurvey（第2次入力データ実体 / Q22=A）

`surveyType=second` の Survey に 1:1（主キー=`surveyId`）。計算規則は U3b、本ユニットはデータ保持のみ。

| 属性 | 型 | 必須 | 説明 |
|---|---|---|---|
| `surveyId` | `DtoId['survey']` | ○ | 親 Survey（主キー兼 FK） |
| `partDamages` | `PartDamage[]`（§5） | ○ | 部位別損傷率（外部＋内部の全部位, FR-23, US-602/603） |
| `floorApportionment` | `FloorRatio[]`（§5） | △ | 階按分（FR-28, US-404） |

> 部位キー（屋根・基礎・外壁・天井・床・内壁・建具・設備 等）の**正準定義・構成比マスタは U3c** に置く（Q22=A）。U2 は「部位キー（string）＋損傷率(0–100%)」の汎用集合として保持し、キーの妥当性検証は U3c マスタ導入時に強化する。

---

## 4. 被災者 PII の保護方針（Q7=A / Q8=A / Q9=A）

- **保持形（Q7=A）**: Survey に埋め込み（`victim*` カラム）。1家屋=1調査の 1:1。
- **保存時保護（Q8=A）**: **DB の at-rest 暗号化（インフラ層, OPERATIONS）に委譲**。アプリ層では平文カラムで保持し、サーバでのフィールド暗号化は行わない（U-Cross 決定と整合, SECURITY-01）。多層で保護:
  1. **認可**: PII は調査員/管理者のみ取得可。閲覧者(viewer)は取得不可（Q9=A）。
  2. **取得制御（Q9=A）**: PII は**詳細取得 API のみ**で返す。一覧（U5）・併記表示・低権限ロールにはマスク/非表示。
  3. **監査**: PII の変更は `pii.change` で**マスク済 before/after** を記録（実値はログ/監査に残さない, `auditMethod.toFieldChanges(entries, pii=true)`）。
  4. **非ログ**: 構造化ログ・エラーに PII を出力しない（U-Cross 既定）。
  5. **クライアント・ローカル暗号化**: IndexedDB 上の PII はアプリ層で暗号化（U6f, SECURITY-01）。同期成功確認後にローカル消去。
- **DTO マスキング**: `toSurveyDto`（全件・一覧用, PII 除外/マスク）と `toSurveyDetailDto`（PII 含む・認可済み）を分離（詳細は `business-logic-model.md`）。

---

## 5. 共有値オブジェクト

### FloorRatio（階按分 / FR-28）
| 属性 | 型 | 説明 |
|---|---|---|
| `floor` | int（≥1） | 階（1階, 2階 …） |
| `ratio` | number（0–100, percentage） | 当該階の床面積比率（％） |

- 不変条件: `ratio` の総和 = 100（許容誤差は U3c で確定）。合計≠100 は検証エラー（US-404）。

### PartDamage（部位別損傷率 / FR-23）
| 属性 | 型 | 説明 |
|---|---|---|
| `part` | string（部位キー, 正準集合は U3c） | 部位（屋根/基礎/外壁/天井/床/内壁/建具/設備 等） |
| `damageRatio` | number（0–100, percentage） | 当該部位の損傷率（％） |

### AssessmentResult（判定結果の保存契約 / Q5・Q6=A）
- `assessmentPort.calcFirst/calcSecond` が返す結果の**保存用最小契約**。U3c の `assessment/types.AssessmentResult` がこの形に適合する。
| 属性 | 型 | 説明 |
|---|---|---|
| `damageRatio` | number（0–100） | 損害割合（％）。決定論的（FR-27） |
| `damageLevel` | string（6区分キー） | 被害度区分（U3c が分類） |
| `basis` | Json | 経路別中間値・計算根拠（US-403） |

---

## 6. ポート（DI 境界・後続ユニットが実装 / Q4・Q5=A）

U2 は計算・画像の実装に依存せず、**インターフェイス（ポート）** のみ定義して `ingestSubmission` から呼ぶ。U2 段階では恒等/スタブ実装を注入して結線・テストし、後続で差し替える（NFR-09 / velona DI）。

| ポート | シグネチャ（概念） | 実装ユニット | U2 のスタブ |
|---|---|---|---|
| `assessmentPort.calcFirst` | `(input: FirstSurveyInput, floors: FloorRatio[]) => AssessmentResult` | U3a | 固定/恒等値を返すスタブ |
| `assessmentPort.calcSecond` | `(input: SecondSurveyInput, floors: FloorRatio[]) => AssessmentResult` | U3b | 同上 |
| `photoPort.persist` | `(client, surveyId, photoMetas[]) => savedPhotoRefs[]` | U4 | no-op スタブ（参照を素通し） |

> スタブ注入により U2 のフロー（登録→計算→状態遷移→監査）を完結・テスト可能にし、後続ユニットは実装を注入するのみ（コードの呼出点は不変）。

---

## 7. 永続化マッピング（Code Generation で確定 / 加法的）
- 新規テーブル: `Survey`, `FirstSurvey`, `SecondSurvey`。`Photo` は U4。
- `ID_NAME_LIST += 'survey'`（`firstSurvey`/`secondSurvey` は `surveyId` を共有主キーとするため独立 ID 名は追加しない）。
- enum 値は U-Cross の `AuditLog.action`/`outcome` と同様、**String カラム＋アプリ層 zod 検証**で保持（enum churn 回避, U-Cross Q 決定と整合）。`SurveyType`/`SurveyStatus`/`StructureType` も同方針。
- マイグレーションは**加法的**（既存 User/AuditLog に影響なし）。`prisma migrate` は Code Generation で確認のうえ実施。

---

## 8. トレーサビリティ
| 要件/ストーリー | 反映エンティティ・属性 |
|---|---|
| FR-01 / US-201 | Survey（家屋識別情報・surveyType=first・status） |
| FR-02 / US-202 | Survey.victim*（§4 保護） |
| FR-03 / US-203 | Survey.latitude/longitude（任意） |
| FR-04 / US-501/503/504 | Survey.status ＋ 実施者/日時 |
| FR-05 / US-505 | status=confirmed の不変性（business-rules） |
| FR-06/07/08 / US-601 | surveyType, parentSurveyId（1:N） |
| FR-09 / US-605/606 | official*（第1次保持） |
| FR-20〜22 / US-301〜303 | FirstSurvey.* |
| FR-23 / US-602/603 | SecondSurvey.partDamages |
| FR-28 / US-404 | FloorRatio（first/second） |
| FR-26 / US-402 | AssessmentResult（damageRatio/damageLevel） |
| NFR-08 / SECURITY-13 | 実施者/日時 ＋ pii.change マスク記録 |
