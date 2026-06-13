# AI-DLC State Tracking

## Project Information
- **Project Type**: Brownfield
- **Project Name**: CATAPULT (aspida + frourio FullStack TypeScript テンプレート)
- **Start Date**: 2026-06-12T13:42:11+09:00
- **Current Stage**: INCEPTION - Units Generation complete (Part 2 artifacts generated), awaiting approval to enter CONSTRUCTION

## Workspace State
- **Existing Code**: Yes
- **Programming Languages**: TypeScript
- **Build System**: npm (monorepo: root / client / server), esbuild, Prisma, frourio, aspida
- **Project Structure**: Monorepo (Next.js client + Fastify server)
- **Reverse Engineering Needed**: Yes
- **Workspace Root**: /root/environment/survey

## Code Location Rules
- **Application Code**: Workspace root (NEVER in aidlc-docs/)
- **Documentation**: aidlc-docs/ only
- **Structure patterns**: See code-generation.md Critical Rules

## Extension Configuration
| Extension | Enabled | Decided At |
|---|---|---|
| Security Baseline | Yes | Requirements Analysis |
| Resiliency Baseline | No | Requirements Analysis |
| Property-Based Testing | Yes (Full enforcement) | Requirements Analysis |

## Reverse Engineering Status
- [x] Reverse Engineering - Completed on 2026-06-12T13:42:11+09:00
- **Artifacts Location**: aidlc-docs/inception/reverse-engineering/

## Execution Plan Summary
- **Stages to Execute**: Application Design, Units Generation, Functional Design, NFR Requirements, NFR Design, Infrastructure Design (light), Code Generation, Build and Test
- **Stages to Skip**: なし（全構築ステージを実行）
- **Plan Location**: aidlc-docs/inception/plans/execution-plan.md

## Stage Progress

### 🔵 INCEPTION PHASE
- [x] Workspace Detection - Completed 2026-06-12T13:42:11+09:00
- [x] Reverse Engineering - Completed 2026-06-12T13:42:11+09:00
- [x] Requirements Analysis - Completed & Approved 2026-06-12T16:17:17+09:00 (RE-APPROVED after offline/local-first loop-back 2026-06-13T12:31:29+09:00)
- [x] User Stories - Completed & Approved 2026-06-12T17:48:50+09:00 (reconciled US-204/US-207 for local-first 2026-06-13)
- [x] Workflow Planning - Completed & Approved 2026-06-12T18:49:50+09:00
- [x] Application Design - Completed & Approved 2026-06-13T12:47:45+09:00
- [x] Units Generation - Completed (Part 1 approved + Part 2 artifacts generated) 2026-06-13T15:44:56+09:00 — awaiting final approval to enter CONSTRUCTION

### 🟢 CONSTRUCTION PHASE (per-unit loop)
**Build order**: U0 → U1 → U-Cross → U2 → U3c → U3a → U3b → U4 → U5 → U6f → U6u

- [x] **U0** デモ削除・基盤整備 — Completed & Approved 2026-06-13T18:14:10+09:00
  - Functional/NFR/Infra Design: SKIP
  - Code Generation: DONE (Part 1 approved + Part 2 executed). Server typecheck PASS. Client typecheck blocked by pre-existing pathpida×next15 incompat (unrelated to U0). prisma migrate deferred to U1.
- [ ] **U1** 認証・ユーザー/ロール基盤 — Functional Design APPROVED 2026-06-13T19:21:11+09:00; Code Generation **COMPLETE (Part 1 + Part 2 executed)** 2026-06-13T22:42+09:00 — awaiting approval to proceed to U-Cross
  - Functional Design: DONE & APPROVED (domain-entities/business-logic-model/business-rules). NFR Req/Design + Infra: SKIP.
  - Code Generation: DONE. tsc --noEmit PASS. `npm test` = 34 tests PASS, coverage 100% (domain/**, common/**, api/**/{controller,hooks,validators}.ts). Migration `20260613132539_add_user_roles` applied (Role enum + User.roles[] + demo Task drop + displayName NOT NULL). fast-check@3.23.2 pinned. Summary: `aidlc-docs/construction/U1/code/u1-summary.md`.
  - Resume answers: Q-RESUME-1=A (plan approved), Q-RESUME-2=A (fast-check added), Q-RESUME-3=A (migrate dev executed).
  - Key decisions: Q1=B(DB source of truth), Q3=B(multi-role any-match), Q4=B(no-role=deny-all), Q5=A(en enum+JP map), Q6=A(ForbiddenError→403 fail-closed), Q7=A(viewer all-read), Q8=B(surveyor mutual draft edit), Q9=B+FU-1=B(admin needs surveyor role for input/submit/2nd-start), FU-2=A(env/seed initial admin), FU-3=A(admin-only role mgmt API + self-lock & last-admin guards), Q11=A(PBT authz matrix).
- [ ] U-Cross / U2 / U3c / U3a / U3b / U4 / U5 / U6f / U6u — Pending
- [ ] Build and Test - EXECUTE (after all units)

### 🟡 OPERATIONS PHASE
- [ ] Operations - PLACEHOLDER

## Current Status
- **Lifecycle Phase**: CONSTRUCTION
- **Current Stage**: U1 (auth/user/role foundation) — Code Generation **COMPLETE (Part 1 + Part 2)**, awaiting approval to proceed to U-Cross
- **Next Action**: User reviews U1 implementation + `u1-summary.md` → approve → start **U-Cross** (error→HTTP 401/403/404 refinement + audit wiring)
- **Status (U1 code-gen complete 2026-06-13T22:42)**: U0 & U1 complete. fast-check@3.23.2 pinned. Migration `20260613132539_add_user_roles` applied. tsc PASS; `npm test` 34 passed, coverage 100%. Local `client/.env`/`server/.env` (gitignored) created + docker compose stack used for API tests. NOTE: `npm run generate` does not regenerate `$api.ts`; run `npx aspida` (dev uses `frourio --watch`). Known pre-existing: client pathpida×next15.

### Resume Notes (2026-06-13T22:42 — U1 CODE GENERATION COMPLETE)
**WHERE WE ARE**: CONSTRUCTION → U1 完了。実装・マイグレーション・テスト（34 件 PASS / カバレッジ100%）・型チェック（PASS）すべて完了。サマリは `aidlc-docs/construction/U1/code/u1-summary.md`。

**RESUME = ユーザーが U1 実装を承認したら U-Cross に進む**。U-Cross の主眼:
1. 共通エラーハンドラの精緻化（`NotFoundError`→404、認証失敗→401、`ForbiddenError`→403）。現状は非GET例外→403/GET例外→404。
2. ロール変更の監査記録（実施者・対象・前後 roles・日時）の実体接続（NFR-08 / SECURITY-13）。`userUseCase.assignRoles` に呼出点コメント済み。
3. 認可失敗の監査・レスポンス整理。

**U1 申し送り（u1-summary.md「残作業」参照）**: NotFound は U1 では PATCH で 403（テストにコメント済、U-Cross で 404 化）。ユーザー一覧/検索 API は U6u。オブジェクト認可の状態別 allowed 呼び分けは U2。

**環境メモ**: API テスト実行には docker compose（postgres/magnito/minio/inbucket）が必要。disk 逼迫時は `npm cache clean --force`。

---

### (Archived) Application Design Resume Notes
- Application Design questions ALL answered: **AD1=A**, **AD2=B+IndexedDB → resolved via AD2-FU=A**, **AD2-FU2=A** (bulk sync on submit), **AD3=A**, **AD4=A**, **AD5=B**, **AD6=A**. CONFIRMED.
- offline/local-first 採用に伴う Requirements 改定（NFR-02, FR-18/19, §5 Local Draft, SECURITY-01拡張, PBT-02, AC-12 等）は反映済み。
