# U0 — コード生成計画（Code Generation Plan: デモ削除・基盤整備）

本計画は U0 のコード生成の**単一の真実の源**です。Brownfield のため「生成」は既存ファイルの**削除・修正**を含みます。下部の承認後に Part 2 を実行します。

## ユニット・コンテキスト
- **ユニット**: U0 — デモ削除・基盤整備
- **責務**: 既存デモ `task` ドメイン/サンプルの完全削除、`user` ドメインのロール拡張準備、共通 ID 規約（ULID）整備、ドメイン群追加の土台づくり。
- **依存**: なし（最初に実施。後続全ユニットの前提）
- **担当ストーリー**: US-806（デモ Task/User サンプル削除部分）
- **関連要件**: SECURITY-09（デモ削除）, C2
- **所有データエンティティ**: なし新規（Prisma `Task` モデルは削除。`User` は U1 で拡張）
- **プロジェクト種別**: Brownfield モノレポ（workspace root: `/root/environment/survey`、`server/` Fastify + `client/` Next.js）

## ステージ評価（U0）
| ステージ | 判定 | 理由 |
|---|---|---|
| Functional Design | SKIP | 新規データモデル・業務ロジックなし（削除＋規約整備のみ） |
| NFR Requirements | SKIP | 技術スタック確定済み、U0 固有の NFR なし |
| NFR Design | SKIP | 同上 |
| Infrastructure Design | SKIP | インフラ変更なし |
| Code Generation | EXECUTE | 本計画 |

---

## 生成ステップ（Part 2 で実行）

### Step 1: サーバ task ドメイン削除
- [x] `server/domain/task/` 配下を全削除（`taskUseCase.ts`, `model/taskType.ts`, `model/taskMethod.ts`, `store/taskQuery.ts`, `store/taskCommand.ts`, `store/toTaskDto.ts`）

### Step 2: サーバ task API レイヤ削除
- [x] `server/api/private/tasks/` 配下を全削除（`index.ts`, `controller.ts`, `di/`, `_taskId@string/`）

### Step 3: サーバ共通 task 型・バリデータ削除
- [x] `server/common/validators/task.ts` 削除
- [x] `server/common/types/task.ts` 削除

### Step 4: 共通 ID 規約の整備（task 除去・ULID 方針）
- [x] `server/common/constants/index.ts` の `ID_NAME_LIST` から `'task'` を除去（暫定 `['user']`。新ドメイン ID は各ユニットで追記する方針をコメントで明記）
- [x] ULID ベースのエンティティ ID 生成方針を確認（既存 `ulid` パッケージを採用済み＝専用ヘルパー不要）
- [x] `brandedId.ts` が `ID_NAME_LIST` 駆動であることを確認。単一要素時に reduce の computed-key 型チェックが厳格化し型崩れする問題を発見、`Object.fromEntries` + キャストへ改修し**要素数非依存**に頑健化

### Step 5: Prisma スキーマから Task モデル削除
- [x] `server/prisma/schema.prisma` の `model Task { ... }` を削除
- [x] `model User` の `tasks Task[]` リレーションを削除
- [x] マイグレーションは未実行（U0 はスキーマ編集のみ。`prisma migrate` は破壊的のため U1 確定後にユーザー確認のうえ実行）

### Step 6: サーバ task テスト削除
- [x] `server/tests/api/private/tasks.test.ts` 削除
- [x] `server/tests/api/private/di.test.ts` 削除（全体が task の DI デモのため）
- [x] `server/tests/setup.ts` は task 参照なし（`info.task` は vitest の API）＝変更不要を確認

### Step 7: クライアント tasks フィーチャ削除
- [x] `client/features/tasks/` 配下を全削除（`TaskList.tsx`, `taskList.module.css`）

### Step 8: クライアント home ページの TaskList 参照除去
- [x] `client/app/page.tsx` から `TaskList` import と描画を除去し、プレースホルダ（`data-testid="home-container"`、U6u で置換予定）に差し替え

### Step 9: 型・ビルド健全性の確認
- [x] サーバ: `npm run generate`（frourio/prisma）＋ aspida 生成後 `tsc --noEmit` = **PASS（0 エラー）**。task 参照の残存・破損 import なし
- [x] 残存 `task`/`Task` 参照を grep で確認（aidlc-docs/・docs/ 除く）= import 参照 0 件
- [!] クライアント: `tsc` は `utils/$path` 未生成により 5 エラー。原因は **pathpida@0.24.0 と next@15 の非互換**（`next/dist/next-server/server/config` 不在）＝**U0 とは無関係の pre-existing ツール互換性問題**。改修した `app/page.tsx` はエラー対象外（コンパイル正常）。Build and Test / U6u で対応する

### Step 10: ドキュメント生成（サマリ）
- [x] `aidlc-docs/construction/U0/code/u0-summary.md` に変更ファイル一覧（削除/修正）と残作業（migrate 実行・pathpida 互換）を記録

---

## ストーリー・トレーサビリティ
| ストーリー | ステップ | 状態 |
|---|---|---|
| US-806（デモ削除） | Step 1–8 | [x] 実装完了 |

## 備考（安全性）
- `prisma migrate`（DB スキーマの破壊的変更）は本ステップでは**実行しない**。スキーマファイル編集のみ行い、実行は U1 スキーマ確定後にユーザー確認のうえ行う。
- 削除は Brownfield 規約に従い in-place（コピー作成しない）。
- 検証のため依存関係をインストール済み（root / server / client の `node_modules`）。

## 既知の課題（U0 で発生・後続対応）
1. **pathpida × next15 非互換**: `client` の `generate:path` が失敗し `utils/$path` 未生成 → クライアント型チェックが通らない。pathpida のバージョン更新または代替手段を Build and Test / U6u で検討（U0 のデモ削除とは独立）。
2. **prisma migrate 未実行**: スキーマから `Task` を削除済み。マイグレーション適用は U1 で User ロール拡張と合わせ、ユーザー確認のうえ実施。
