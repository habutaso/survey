# AI-DLC State Tracking

## Project Information
- **Project Type**: Brownfield
- **Project Name**: CATAPULT (aspida + frourio FullStack TypeScript テンプレート)
- **Start Date**: 2026-06-12T13:42:11+09:00
- **Current Stage**: CONSTRUCTION - U5 (結果出力・一覧) Code Generation COMPLETE 2026-06-15T22:20+09:00（承認待ち）; U4 COMPLETE & APPROVED

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
- [x] **U1** 認証・ユーザー/ロール基盤 — Functional Design APPROVED 2026-06-13T19:21:11+09:00; Code Generation **COMPLETE & APPROVED** 2026-06-13T22:48:57+09:00
  - Functional Design: DONE & APPROVED (domain-entities/business-logic-model/business-rules). NFR Req/Design + Infra: SKIP.
  - Code Generation: DONE. tsc --noEmit PASS. `npm test` = 34 tests PASS, coverage 100% (domain/**, common/**, api/**/{controller,hooks,validators}.ts). Migration `20260613132539_add_user_roles` applied (Role enum + User.roles[] + demo Task drop + displayName NOT NULL). fast-check@3.23.2 pinned. Summary: `aidlc-docs/construction/U1/code/u1-summary.md`.
  - Resume answers: Q-RESUME-1=A (plan approved), Q-RESUME-2=A (fast-check added), Q-RESUME-3=A (migrate dev executed).
  - Key decisions: Q1=B(DB source of truth), Q3=B(multi-role any-match), Q4=B(no-role=deny-all), Q5=A(en enum+JP map), Q6=A(ForbiddenError→403 fail-closed), Q7=A(viewer all-read), Q8=B(surveyor mutual draft edit), Q9=B+FU-1=B(admin needs surveyor role for input/submit/2nd-start), FU-2=A(env/seed initial admin), FU-3=A(admin-only role mgmt API + self-lock & last-admin guards), Q11=A(PBT authz matrix).
- [x] **U-Cross** 横断（監査ログ・入力検証・暗号化・セキュア既定） — Functional Design APPROVED 2026-06-13T23:04; Infra(light) DONE; Code Generation **COMPLETE & APPROVED** 2026-06-14T01:32:28+09:00。tsc PASS, `npm test` 53 passed, coverage 100%。migration `20260613142321_add_audit_log` 適用。Summary: `construction/U-Cross/code/u-cross-summary.md`。
- [x] **U2** 調査管理（Survey 集約）＋提出時一括同期 API — Functional Design **APPROVED** 2026-06-14T13:44:21+09:00。NFR Req/Design + Infra SKIP (Q8=A)。Code Generation Part 1 (Planning) APPROVED 2026-06-14T16:32:45。**Code Generation COMPLETE & APPROVED** 2026-06-14T17:35:34+09:00。
  - Code Generation: DONE。tsc --noEmit PASS、`npm test` 16ファイル/110テスト PASS、coverage ALL FILES 100%（domain/**・common/**・api/**/{controller,hooks,validators}.ts）。eslint クリーン。migration `20260614074112_add_survey`（加法的）適用。generate=prisma+frourio($server)+aspida($api)。Summary: `aidlc-docs/construction/U2/code/u2-summary.md`。計画27チェックボックス全 [x]。
  - 構成: domain/survey（model: surveyType/surveyMethod/surveyDispatch/surveyPolicy/surveyAudit、ports: assessmentPort/photoPort[velona depend スタブ]、store: toSurveyDto/surveyCommand/surveyQuery、surveyUseCase[ingest/approve/confirm/chooseOfficial/get/list/getHouseResults]）、common/types/survey.ts・common/validators/survey.ts、api/private/surveys（7 endpoints: submission POST / GET list / GET :id / approve / confirm / official / results[US-605, 計画6に+1]）、Prisma Survey/FirstSurvey/SecondSurvey。
  - 申し送り: U3a/U3b=assessmentPort 実装注入、U4=photoPort S3 実装、U3c=部位/階按分マスタ、U5=検索/一覧、U6f/U6u=クライアント同期、reject 後続。
- [x] **U3c** 計算コア（assessment-core） — Functional Design DONE; Code Generation **COMPLETE & APPROVED** 2026-06-15T08:36:34+09:00。tsc PASS、`npm test` 20ファイル/156テスト PASS、coverage All files 100%、eslint クリーン、Prisma 変更なし。正準型 `common/types/assessment.ts`、`domain/assessment/**`（round/lookupBandRatio/classifyDamageLevel/applyFloorRatio/computeFirst/computeSecond/constants）。PBT INV-1〜8 網羅。Summary: `aidlc-docs/construction/U3c/code/u3c-summary.md`。
- [x] **U3a** 第1次判定（calcFirst 本実装注入） — Functional/NFR/Infra SKIP; Code Generation **COMPLETE & APPROVED** 2026-06-15T08:58+09:00。tsc PASS、`npm test` 20ファイル/157テスト PASS、coverage All files 100%、eslint クリーン、Prisma 変更なし。`assessmentPort.calcFirst` の既定 compute を `computeFirstAssessment` へ差替（呼出点不変、calcSecond はスタブ据置）。surveys.test.ts を実値検証へ更新＋外力true(全壊)ケース追加。Summary: `aidlc-docs/construction/U3a/code/u3a-summary.md`。
  - [x] **U3b** 第2次判定（calcSecond 本実装注入） — Functional/NFR/Infra SKIP; Code Generation **COMPLETE & APPROVED** 2026-06-15T09:11+09:00。tsc PASS、`npm test` 20ファイル/157テスト PASS、coverage All files 100%、eslint クリーン、Prisma 変更なし。`assessmentPort.calcSecond` の既定 compute を `computeSecondAssessment` へ差替。`surveyDispatch.assessmentInput` の second 分岐で structureType を合成し SecondAssessmentInput を構成（呼出点不変）。Summary: `aidlc-docs/construction/U3b/code/u3b-summary.md`。
  - [x] **U4** 画像管理（写真の S3 保存） — Functional/Infrastructure Design APPROVED 2026-06-15T09:21+09:00; Code Generation **COMPLETE & APPROVED** 2026-06-15T12:21+09:00。tsc PASS / `npm test` 21ファイル171テスト PASS / coverage All files 100% / eslint クリーン / schema 差分=Photo モデル+Survey.photos のみ。`photoPort` を presigned PUT URL 方式の本実装へ（Photo pending 作成→PUT 15分発行→提出応答に tickets 同梱）、`photoUseCase`（confirmUploaded 冪等＋listForSurvey uploaded のみ GET 24h）、API GET photos / POST photos/confirm、Prisma Photo + migration `20260615002626_add_photo`（加法的）、`s3.putSignedUrl`。PBT INV-P1/P3。コミット済み（git 38428da, 2026-06-15）。Summary: `construction/U4/code/u4-summary.md`。
  - [x] **U5** 結果出力・一覧 — Functional Design **APPROVED** 2026-06-15T12:41 / Infrastructure Design（軽量）**APPROVED** 2026-06-15T12:45 / Code Generation Part 1 計画 **APPROVED** 2026-06-15T22:18。**Code Generation COMPLETE（承認待ち）2026-06-15T22:20**。tsc PASS / `npm test` 24ファイル201テスト PASS / coverage All files 100% / eslint クリーン / schema 差分=Survey 4インデックス追加のみ + migration `20260615035439_add_survey_search_indexes`。pdfkit 0.19.1・@types/pdfkit 0.17.6 pinned、IPAexゴシック同梱。domain/export(exportUseCase velona DI / exportFormat / csvRenderer)、service/pdfRenderer.ts(coverage除外)、API: surveys一覧拡張 / `_surveyId/pdf` / `export/csv`。計画29チェック全[x]。判断: Q-U5-1=A(pdfkit)/2=A(CSV BOM)/3=B(拡張filter)/4=A(offset+total)/5=B(surveyor=自分のみ)/6=C(PDF admin)/7=A(CSV admin+PII)/8=B(S3 presigned)/9=A(list拡張)/10=B(家屋単位)/11=A(font同梱)。コミット済み（git 38428da, 2026-06-15）。Summary: `construction/U5/code/u5-summary.md`。
  - [ ] U6f / U6u — Pending
- [ ] Build and Test - EXECUTE (after all units)

### 🟡 OPERATIONS PHASE
- [ ] Operations - PLACEHOLDER

## Current Status
- **Lifecycle Phase**: CONSTRUCTION
- **Current Stage**: U5（結果出力・一覧）— **Code Generation COMPLETE、承認待ち**。
- **Next Action**: ユーザー承認後 U6f / U6u（クライアント）へ。
- **U5 Status**: **COMPLETE（承認待ち）2026-06-15T22:20+09:00**。tsc PASS / `npm test` 24ファイル201テスト PASS / coverage All files 100% / eslint クリーン / schema 差分=Survey 4インデックス追加のみ + migration `20260615035439_add_survey_search_indexes`。検索/一覧（scopeForList ロールスコープ・buildSurveyWhere・offset ページング）、家屋単位 PDF（pdfkit・admin・PII・同梱フォント）、CSV（admin・PII・BOM・RFC4180）を S3+presigned(15分) で配信。domain は純粋＋velona DI。Summary: `construction/U5/code/u5-summary.md`。コミット済み（git 38428da, 2026-06-15）。
- **Next Action (旧)**: ユーザー承認後 U5（検索/一覧）へ。
- **U4 Status**: **COMPLETE（承認待ち）2026-06-15T10:05+09:00**。tsc PASS / `npm test` 21ファイル171テスト PASS / coverage All files 100% / eslint クリーン / schema 差分=Photo モデル+Survey.photos のみ。`photoPort` presigned PUT 本実装、`photoUseCase`（confirm 冪等・閲覧 uploaded のみ）、API GET/confirm、Prisma Photo + migration `20260615002626_add_photo`、`s3.putSignedUrl`。PBT INV-P1/P3。Summary: `construction/U4/code/u4-summary.md`。
- **U3b Status**: **COMPLETE & APPROVED 2026-06-15T09:11+09:00**。tsc PASS / `npm test` 20ファイル157テスト PASS / coverage All files 100% / eslint クリーン / Prisma 変更なし。`assessmentPort.calcSecond` 本実装バインド、structureType は surveyDispatch で合成（呼出点不変）。Summary: `aidlc-docs/construction/U3b/code/u3b-summary.md`。
- **U3c Status**: **COMPLETE & APPROVED 2026-06-15T08:36:34+09:00**（git 739f38d）。Summary: `aidlc-docs/construction/U3c/code/u3c-summary.md`。
- **U2 Status**: **COMPLETE & APPROVED 2026-06-14T17:35:34+09:00**。Summary: `aidlc-docs/construction/U2/code/u2-summary.md`。

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
