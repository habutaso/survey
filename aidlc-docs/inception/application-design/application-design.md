# アプリケーション設計（統合ドキュメント）

住家被害認定調査（水害）効率化アプリのアプリケーション設計。本書は `components.md` / `component-methods.md` / `services.md` / `component-dependency.md` を統合した概要であり、各詳細は個別ファイルを参照する。Functional Design 以降で業務ルール・数値ロジック・スキーマ・NFR を確定する。

## 1. 概要

既存 CATAPULT テンプレート（Next.js / Fastify / frourio + aspida / Prisma + PostgreSQL / Cognito / S3、DDD・関数型・DI）上に、被害認定調査ドメインを新規構築する。デモ `task` ドメインは置換・削除し、`user` はロール拡張のうえ流用する。

## 2. 設計判断サマリー（AD1〜AD6 / AD2-FU）

| ID | 判断 | 回答 | 設計への反映 |
|---|---|---|---|
| AD1 | 計算エンジンの境界 | A 独立 | `assessment` を純粋計算カーネル（独立コンテキスト）として分離。PBT 重点対象 |
| AD2 / AD2-FU | 進捗・入力の保持／オフライン方針 | A オフライン/ローカルファースト正式採用 | クライアント `LocalDraftStore`(IndexedDB, 暗号化) に入力・画像を保持。NFR-02 改定済み |
| AD2-FU2 | 同期トリガ | A 提出時一括 | `SyncOnSubmit` が提出操作でサーバへ一括送信。成功確認後ローカル消去 |
| AD3 | マスタ保持 | A コード内定数 | `assessment/constants`（構成比・浸水深換算・部位定義・既定按分、バージョン管理） |
| AD4 | PDF/CSV 生成 | A サーバ側 | `export` コンポーネントがサーバ生成、認可制御下 |
| AD5 | 調査区分モデル | B 別エンティティ | `firstSurvey` / `secondSurvey` を別エンティティ。`survey` が統括 |
| AD6 | 認可 | A 多層 | `api/private/hooks`(L1) + Model `assert*`(L2) の多層防御 |

## 3. コンポーネント一覧（要約）

**サーバ**: `auth`（認証/ロール）、`survey`（集約ルート・状態機械・正式判定）、`firstSurvey`、`secondSurvey`、`assessment`（純粋計算）、`photo`（S3）、`export`（PDF/CSV）、横断（hooks 認可・監査・検証）。
**クライアント**: `SurveyWizard`（ステッパー）、`LocalDraftStore`（IndexedDB）、`SyncOnSubmit`（提出時同期）、`ResultView/ExportTrigger`。

詳細は `components.md`。メソッドシグネチャは `component-methods.md`。

## 4. 中核ドメイン: assessment（被害度計算）

- 入力から決定論的に損害割合（0–100%）を算出し、6区分（全壊/大規模半壊/中規模半壊/半壊/準半壊/準半壊に至らない）へ排他・網羅マッピング。
- 第1次: 外力・流失該当→全壊、傾斜＋浸水深→損害割合。
- 第2次: Σ(部位損傷率 × 構成比)、階按分反映。
- 純粋関数のため UseCase/クライアントプレビュー双方から再利用可。PBT（境界・不変条件・冪等性）を重点適用（§7 要件, NFR-04）。

## 5. ローカルファースト・同期方式（AD2-FU/AD2-FU2）

- オフラインでも `SurveyWizard` が `LocalDraftStore`(IndexedDB) に入力・画像を暗号化保持。再読込・復帰で復元。
- 「提出」操作で `SyncOnSubmit` が `POST /api/private/surveys/submission` に一括送信 → `surveyUseCase.ingestSubmission` が原子的に登録・計算・状態遷移・監査。
- 同期成功確認後にローカルの PII・画像を消去。失敗時は保持・キューイング・オンライン復帰で再試行（喪失防止）。
- 保護要件は SECURITY-01（拡張）に準拠。詳細実装（IndexedDB スキーマ・暗号化方式・同期キュー・競合・Service Worker）は NFR/Infrastructure Design で確定。

## 6. 認可（多層防御, AD6=A）

- L1: `api/private/hooks`（認証＋ロール注入＋粗いガード）。
- L2: Model 層 `assertRole` / `assertOwnerOrRole`（オブジェクト/機能、デフォルト拒否、fail closed）。
- 承認・確定・正式判定は管理者のみ。閲覧者は参照のみ。SECURITY-08, US-802。

## 7. 状態機械（survey）

```
下書き --submit(調査員)--> 提出 --approve(管理者)--> 承認 --finalize(管理者)--> 確定(不変)
   ^------ reject(管理者, 後続) ------|
第1次確定 --startReexamination--> 第2次(下書き) ...（同様の遷移）
第1次/第2次併存 --chooseOfficial(管理者)--> 正式判定
```
不正遷移は `assertTransition` で排除（PBT-06）。

## 8. データ要素（高レベル）

`Survey`（識別/区分/親参照/状態/GPS/PII参照/各日時・実施者）、`FirstSurvey`（外力/傾斜/浸水深/階按分）、`SecondSurvey`（部位別損傷率/親第1次/階按分）、`AssessmentResult`（損害割合/区分/根拠）、`OfficialDetermination`、`Photo`（s3Key/区分/部位）、`LocalDraft`（IndexedDB, 同期前）、`Master`（コード内定数）。詳細スキーマは Functional Design。

## 9. セキュリティ・横断的関心事

- 保存時暗号化（DB/S3）、TLS、IndexedDB のローカル PII・画像保護＋同期後消去（SECURITY-01）。
- 全 API 入力 zod 検証（SECURITY-05）。監査ログ（NFR-08, SECURITY-13/14）。デフォルト拒否認可（SECURITY-08）。セキュアヘッダ・エラー秘匿・fail closed（SECURITY-04/09/15）。

## 10. 既存資産の扱い

- 流用: `user` ドメイン（ロール拡張）、`service/{cognito,s3,prismaClient,envValues}`、`api/private/hooks`、frourio/aspida/Prisma パイプライン、`common/{types,validators,constants}` 規約。
- 削除: `task` ドメイン・サンプル UI・関連テスト（SECURITY-09, C2=A）。

## 11. トレーサビリティ（コンポーネント → 要件/ストーリー）

| コンポーネント | 主な要件 | 主なストーリー |
|---|---|---|
| auth | FR-40〜43 | US-101〜103, US-802 |
| survey | FR-01〜09, FR-18/19 | US-201〜207, US-501〜505, US-606 |
| firstSurvey | FR-06/07, FR-20〜22, FR-28 | US-301〜303, US-401, US-404 |
| secondSurvey | FR-07/08, FR-23, FR-28 | US-601〜604 |
| assessment | FR-11, FR-20〜28, NFR-04 | US-401, US-402, US-404, US-604, US-805 |
| photo | FR-12〜14 | US-304, US-305 |
| export | FR-31〜33 | US-701, US-702 |
| SurveyWizard | FR-15〜17 | US-205, US-206, US-404 |
| LocalDraftStore | FR-18, NFR-02, SECURITY-01 | US-204, US-207 |
| SyncOnSubmit | FR-19, NFR-02 | US-207 |

## 12. 次段への申し送り（Functional Design / NFR / Infra）

- 浸水深→損害割合換算表・部位別構成比の**正確な数値**を運用指針（水害編・記入の手引き）から抽出（要件 §11 リスク）。
- 「2階部分の割合調整」の算定方法・対象部位・既定値の確定。
- IndexedDB スキーマ・ローカル暗号化方式・同期キュー/競合/再試行・Service Worker 範囲・PWA 化（NFR/Infra Design）。
- サーバ側 PDF/CSV 生成ライブラリ選定（NFR Design）。
- PBT プロパティの特定（PBT-01）。
