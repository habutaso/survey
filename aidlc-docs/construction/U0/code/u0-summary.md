# U0 コード生成サマリ（デモ削除・基盤整備）

**ユニット**: U0 / **ストーリー**: US-806（デモ削除部分） / **実施日**: 2026-06-13

## 削除（Deleted）
- `server/domain/task/`（`taskUseCase.ts`, `model/taskType.ts`, `model/taskMethod.ts`, `store/taskQuery.ts`, `store/taskCommand.ts`, `store/toTaskDto.ts`）
- `server/api/private/tasks/`（`index.ts`, `controller.ts`, `di/`, `_taskId@string/`）
- `server/common/validators/task.ts`
- `server/common/types/task.ts`
- `server/tests/api/private/tasks.test.ts`
- `server/tests/api/private/di.test.ts`（task の DI デモ全体）
- `client/features/tasks/`（`TaskList.tsx`, `taskList.module.css`）

## 修正（Modified）
- `server/common/constants/index.ts` — `ID_NAME_LIST` から `'task'` を除去（`['user']`）。新ドメイン ID 追記方針と ULID 採番方針をコメント追記
- `server/common/validators/brandedId.ts` — 単一要素 ID リストで型崩れする問題を修正。`reduce` から `Object.fromEntries` + キャストへ変更し要素数非依存に頑健化
- `server/prisma/schema.prisma` — `model Task` 削除、`User.tasks` リレーション削除
- `client/app/page.tsx` — `TaskList` の import/描画を除去、`data-testid="home-container"` のプレースホルダに差替（U6u で置換予定）

## 検証（Verification）
- **サーバ型チェック**: `tsc --noEmit` = PASS（0 エラー）。frourio/prisma/aspida 生成後に確認
- **task 参照残存**: import 参照 0 件（aidlc-docs/・docs/ 除く）
- **クライアント型チェック**: `utils/$path` 未生成により 5 エラー。原因は pathpida@0.24.0 × next@15 非互換（U0 と無関係の pre-existing 問題）。修正した `page.tsx` はエラー対象外

## 残作業（Follow-up）
1. **prisma migrate**: スキーマ編集済み。マイグレーション適用は U1（User ロール拡張）と合わせユーザー確認のうえ実施（破壊的操作）
2. **pathpida × next15 非互換**: `generate:path` 失敗。Build and Test / U6u でバージョン更新または代替を検討

## 備考
- 検証のため root / server / client の依存関係をインストール済み
