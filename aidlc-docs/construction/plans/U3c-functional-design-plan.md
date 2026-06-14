# U3c — 機能設計 計画（Functional Design Plan: 計算コア / assessment-core）

本書は U3c の Functional Design の計画と確認質問です。回答（各 `[Answer]:` 記入）後に設計成果物（domain-entities / business-logic-model / business-rules）を生成します。

## ユニット・コンテキスト
- **ユニット**: U3c — 計算コア（共有, assessment-core）。U3a/U3b が共有する純粋計算カーネル。
- **責務**: マスタ定数（部位構成比・浸水深換算表・部位定義・既定按分）、6区分マッピング `classifyDamageLevel`、階按分 `applyFloorRatio`、`AssessmentResult` 型、結果不変条件・PBT ハーネス。フレームワーク・永続化に非依存の純粋関数。
- **依存**: U-Cross（型・PBT 基盤）のみ。U3a/U3b/U5 が U3c に依存。
- **担当ストーリー**: US-402（6区分判定）, US-403（計算根拠）, US-404（階按分）, US-805（PBT）。
- **関連要件**: FR-24, FR-25, FR-26, FR-27, FR-28, FR-30 / NFR-04 / §7 PBT / AC-2, AC-7。
- **配置（予定）**: `server/domain/assessment/`（`constants` / `classifyDamageLevel` / `applyFloorRatio` / `types`）。client 共有が必要な型は `common/` に配置。
- **U2 連携**: U2 が `assessmentPort.calc{First,Second}` をスタブ注入済み。U3c は計算コアを提供し、U3a/U3b がポート実装で U3c を利用する。`AssessmentResult` は U2 `common/types/survey.ts` に暫定定義あり（damageRatio/damageLevel/basis）。

## ステージ評価（U3c）
| ステージ | 判定 | 理由 |
|---|---|---|
| Functional Design | EXECUTE（本計画） | 新規ドメインモデル（マスタ）・複雑な計算ロジック・不変条件あり |
| NFR Requirements / NFR Design | 後段で評価 | 純粋計算（性能は軽微）。PBT は NFR-04 として本設計に内包想定 |
| Infrastructure Design | SKIP 想定 | 永続化・インフラ非依存 |
| Code Generation | EXECUTE | — |

## 機能設計プラン（成果物生成手順）
- [x] Step A: ドメインエンティティ/型定義（`AssessmentResult`、`DamageLevel` enum、マスタ型: 部位定義・構成比・浸水深換算・既定階按分、入力型 `FirstAssessmentInput`/`SecondAssessmentInput`）→ `domain-entities.md`
- [x] Step B: 業務ロジックモデル（`classifyDamageLevel`、`applyFloorRatio`、第1次/第2次の損害割合算出の共有要素、`basis` 構造、決定論・端数処理方針）→ `business-logic-model.md`
- [x] Step C: 業務ルール（6区分閾値・境界、構成比合計=100%、階按分合計=100%、範囲[0,100]、外力該当=全壊、PBT 不変条件 INV 群）→ `business-rules.md`
- [x] Step D: トレーサビリティ（FR/US ↔ 設計要素）と後続（U3a/U3b/U5）への提供インターフェイス

---

## 確認質問（回答を `[Answer]:` に記入してください）

> 形式: 各設問に A/B/C... の選択肢。`[Answer]:` に記号（必要に応じ補足）を記入。**(推奨)** は既定案です。迷う場合は推奨で問題ありません。

### Q1. 被害度6区分の閾値・境界
FR-24 のとおり「全壊≥50% / 大規模半壊 40–50%未満 / 中規模半壊 30–40%未満 / 半壊 20–30%未満 / 準半壊 10–20%未満 / 準半壊に至らない（一部損壊）<10%」（下限包含・上限排他）で確定してよいですか。
- A) はい、FR-24 どおり **(推奨)**
- B) 変更したい（補足に指定）

[Answer]: A

### Q2. enum キー・表示名（U1/U2 と統一）
被害度区分を英語 enum ＋日本語表示名マップ（`common/constants`）で定義します。キー案: `totalCollapse`(全壊) / `largeScaleHalf`(大規模半壊) / `mediumScaleHalf`(中規模半壊) / `half`(半壊) / `quasiHalf`(準半壊) / `partial`(準半壊に至らない/一部損壊)。
- A) この命名で統一 **(推奨)**
- B) 別の命名（補足に指定）

[Answer]: A

### Q3. マスタ値（部位構成比・浸水深-損害割合換算表・部位定義）の出所【最重要】
`docs/references/` の運用指針 PDF はこの環境ではテキスト抽出不可（pdftotext 不在・大容量バイナリ）。標準構成比・浸水深換算等の**具体数値**の扱いを選んでください。
- A) **設定可能マスタとして構造を実装し、出典明記の上で代表値プレースホルダを定義**（計算ロジック・PBT・型・テスト基盤は完成。実数値は後日 PDF/ユーザー確定で差替。`assessment/constants` を単一の真実の源にする）**(推奨：実装を止めず構造とテストを固める)**
- B) ユーザーが本チャットで具体値（構成比表・浸水深換算表・部位一覧）を提供 → それを確定値として実装
- C) 管理者編集可能な DB マスタ化（U3c はインターフェイス/既定値のみ、値運用は後続ユニット）
- D) AI が PDF を画像として読み取り値抽出（精度リスクあり・要人手レビュー）

[Answer]: A

### Q4. 構造種別スコープ（水害）
対象は水害のみ（要件確定）。構造種別の構成比マスタの対応範囲は？
- A) 木造・非木造の両方をマスタで切替 **(推奨)**
- B) 木造のみ（非木造は後続ユニットで追加）

[Answer]: A

### Q5. 階按分 `applyFloorRatio`（US-404 / FR-28）の意味論
複数階の床面積比率をどう反映しますか。
- A) 階別床面積比率による加重平均（住家損害割合 = Σ(階別損害割合 × 階床面積比)、比率合計=100%）**(推奨)**
- B) 別方式（補足に指定。例: 階別×部位別の二次元按分）

[Answer]: A

### Q6. `AssessmentResult` の正準定義の所在
U2 が暫定定義（`common/types/survey.ts`: `{ damageRatio, damageLevel, basis }`）。
- A) U3c（`assessment/types`、必要分は `common/`）に正準 `AssessmentResult` と `DamageLevel` を定義し、U2 はそれを参照/再エクスポートして整合 **(推奨)**
- B) U2 の既存定義を据え置き、U3c は適合（型は重複させず U2 を import）

[Answer]: A

### Q7. `basis`（計算根拠, US-403）の構造
- A) 経路別・部位別・階按分の中間値を構造化保持（第1次: 外力フラグ/傾斜寄与/浸水深寄与、第2次: 部位別損傷率×構成比の内訳、階按分前後）**(推奨)**
- B) 最小（最終損害割合のみ、根拠表示は後続）

[Answer]: A

### Q8. 端数処理・精度
- A) 内部は高精度（浮動小数）で計算、区分判定・表示時に小数第1位を四捨五入（運用指針の慣行に合わせる）**(推奨)**
- B) 整数％へ丸め
- C) 丸めなし（生値を保持し、表示側で処理）

[Answer]: A

### Q9. PBT 不変条件（US-805 / NFR-04）の範囲
`assessment` 純粋関数に課す不変条件:
- A) 範囲[0,100]・決定論（同一入力→同一結果）・単調性（部位損傷率/浸水深↑ → 損害割合↑）・区分整合（割合→区分が境界表と一致）・按分保存（比率合計100%で恒等）**(推奨)**
- B) 一部のみ（補足に指定）

[Answer]: A

### Q10. 第1次調査経路の区分算定（U3c が提供する共有部分）
第1次（外力・流失／傾斜／浸水深）も損害割合→6区分まで算定しますか（U3a が U3c を用いて実装）。
- A) 第1次も損害割合→6区分（外力・流失該当は全壊=50%以上扱い、傾斜・浸水深は換算表で割合化）**(推奨)**
- B) 第1次は簡易区分（全壊/半壊/一部）に留める

[Answer]: A

---

## 補足
- 回答後、曖昧点があれば追加質問（clarification）を別 .md で提示します。
- 本計画承認・回答完了後に `aidlc-docs/construction/U3c/functional-design/` へ成果物を生成します。
