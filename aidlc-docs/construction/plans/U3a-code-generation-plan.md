# U3a コード生成計画（第1次判定の本実装注入）

**ユニット**: U3a 第1次判定（assessmentPort.calcFirst 本実装注入）
**担当ストーリー**: US-402 / US-403 / US-404（FR-20〜22, FR-24, FR-28）
**作成日時**: 2026-06-15T08:39+09:00

## スコープ
U3c で完成した純粋計算 `computeFirstAssessment` を DI 境界 `assessmentPort.calcFirst` の
既定 `compute` 依存として束ね、第1次提出時にサーバが実値で被害度を算出するようにする。
呼出点（`surveyUseCase.ingestSubmission` → `resolveAssessment` → `calcFirst`）は不変。

### 前提（確認済み）
- `FirstSurveyData`（common/types/survey）と `FirstAssessmentInput`（common/types/assessment）は構造同一。
- 正準 `AssessmentResult`（assessment）は緩い境界 `AssessmentResult`（survey）へ構造的に代入可能（widen）。
- `calcSecond` はスタブ据え置き（U3b 担当）。

## チェックリスト

### 1. ポート本実装バインド
- [x] `server/domain/survey/ports/assessmentPort.ts`: `calcFirst` の既定 `compute` をスタブから
      `computeFirstAssessment`（`domain/assessment/computeFirstAssessment`）へ差替。
- [x] ラッパ signature（`(input: FirstSurveyData) => AssessmentResult`[緩い]）は不変に保つ。
- [x] `calcSecond` はスタブのまま（U3b で差替）。コメントを実態に合わせて更新。

### 2. テスト更新（実値検証）
- [x] `server/tests/api/private/surveys.test.ts`: 第1次提出テストの
      `expect(res.body.damageLevel).toBe('unclassified')` を `computeFirstAssessment` 由来の実値検証へ更新
      （`computeFirstAssessment` を import し、`firstBody` 入力から期待 `damageLevel`/`damageRatio` を算出して比較）。
- [x] 外力フラグ true 経路の API 検証を1ケース追加（全壊・damageRatio=100 / damageLevel 最上位）。
- [x] テスト名から「スタブ」表記を実態へ更新。
- [x] 第2次提出テストはスタブ据え置き（U3b 申し送り）。

### 3. 検証
- [x] `npx tsc --noEmit`（server）PASS。
- [x] `npm test`（vitest run --coverage）PASS、coverage 100%（domain/**・common/**・api/**/{controller,hooks,validators}.ts）。
- [x] `npx eslint`（複雑度・ネスト・行数・no-non-null-assertion 等）クリーン。
- [x] Prisma 変更なし（マイグレーション不要）。

### 4. サマリ
- [x] `aidlc-docs/construction/U3a/code/u3a-summary.md` 作成（変更点・検証結果・U3b/U4 申し送り）。

## 後続申し送り
- **U3b**: `computeSecondAssessment` を `calcSecond` へ同様に注入。第2次提出テストを実値化。
- **U4**: `photoPort` の S3 実装注入。
- **U5**: 一覧/検索で `DAMAGE_LEVEL_*` を利用。
