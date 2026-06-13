# U1 コード生成 — 再開時の確認事項（Resume Questions）

再開地点: **CONSTRUCTION → U1（認証・ユーザー/ロール基盤）/ Code Generation Part 1（計画）完了・承認待ち**。
以下に回答いただければ Part 2（Steps 0–14, 実コード生成）を実行します。各項目の `[回答]:` 欄に記入してください。

---

## Q-RESUME-1. U1 コード生成計画の承認（GATE）
`aidlc-docs/construction/plans/U1-code-generation-plan.md`（Steps 0–14）の内容で Part 2 実行に進んでよいですか？

- **A)** 承認する（このまま Part 2 を実行）
- **B)** 修正したい（修正点を記載してください）

[回答]: A

---

## Q-RESUME-2. `fast-check`（PBT ライブラリ）の追加
Q11=A によりプロパティベーステスト（INV-1〜5）を実装します。`server` の devDependencies に `fast-check` を**固定版**（例: `3.23.2`）で追加してよいですか？

- **A)** はい、固定版で追加してよい
- **B)** いいえ（代替方針を指定 / PBT は例示テストのみに縮小 など）

[回答]: A

---

## Q-RESUME-3. `prisma migrate`（破壊的操作）の実行可否
`User.roles`（`Role` enum + 配列）追加には DB マイグレーションが必要です。`prisma migrate dev`（既存データに影響しうる破壊的操作）を U1 実行時に行ってよいですか？

- **A)** はい、U1 実行時に `prisma migrate dev` を実行してよい
- **B)** いいえ、`schema.prisma` 編集 + `prisma generate`（型生成）までに留め、マイグレーション適用は **Build and Test フェーズ**へ保留する

[回答]: A

---

> 補足: いずれも `aidlc-state.md` の Resume Notes（2026-06-13T19:27）に記録済みの保留事項です。
> 回答後、Step 0 から順に実行し、完了時に `U1/code/u1-summary.md` に変更一覧・検証結果を記録します。
