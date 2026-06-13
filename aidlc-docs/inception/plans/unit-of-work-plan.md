# ユニット・オブ・ワーク 計画（Units Generation - Part 1: Planning）

要件（`requirements.md`）、ストーリー（`stories.md`）、アプリケーション設計（`application-design/`）に基づき、システムを開発単位（Unit of Work）へ分解する計画。下部の質問（`[Answer]:`）にご回答ください。回答後に Part 2（成果物生成）へ進みます。

---

## 1. 実行チェックリスト（Part 2 で生成）
- [x] `aidlc-docs/inception/application-design/unit-of-work.md`（ユニット定義と責務）
- [x] `aidlc-docs/inception/application-design/unit-of-work-dependency.md`（依存マトリクス）
- [x] `aidlc-docs/inception/application-design/unit-of-work-story-map.md`（ストーリー→ユニット対応）
- [x] ユニット境界・依存の検証
- [x] 全ストーリーのユニット割当を保証

---

## 2. ユニット分解案（execution-plan.md からの提案 / 確定は本計画で）

| ユニット | 名称 | 主な責務 | 関連コンポーネント | 関連ストーリー（案） |
|---|---|---|---|---|
| **U0** | デモ削除・基盤整備 | 既存 task ドメイン/サンプル削除、common 規約・ID 追加 | task 削除, common | （横断, US-806 一部） |
| **U1** | 認証・ユーザー/ロール基盤 | Cognito 連携、User＋role、認可基盤（hooks L1 + assert L2） | auth | US-101〜103, US-802, US-806 |
| **U2** | 調査管理（Survey 集約） | 調査作成・PII・GPS・状態機械・第1次/第2次関連・正式判定 | survey, firstSurvey, secondSurvey | US-201〜206, US-501〜505, US-601, US-605, US-606, US-803, US-804 |
| **U3** | 被害度計算エンジン | 第1次/第2次の計算、6区分、階按分、マスタ定数、PBT | assessment | US-401〜404, US-602〜604, US-805, US-801 |
| **U4** | 画像管理 | 撮影・S3 保存・部位/全体紐付け | photo | US-304, US-305 |
| **U5** | 結果出力・一覧 | PDF/CSV 生成（サーバ）、一覧・検索 | export | US-701〜703 |
| **U6** | フロントエンド（タブレット UI／ローカルファースト） | ウィザード・ステッパー・IndexedDB・提出時同期・結果表示 | SurveyWizard, LocalDraftStore, SyncOnSubmit, ResultView | US-204, US-205, US-206, US-207, US-301〜305, US-402, US-404, US-605, US-701, US-702 |

> クリティカルパス（案）: U0 → U1 → U2 → U3。U4/U5 は U2 に依存、U6 は API 確定に追従（並行着手可）。

---

## 3. 確認質問（分解品質のための明確化）

### Question UG1: ユニットの粒度（モジュール vs サービス）
本アプリは既存どおり**単一デプロイ（1 Docker コンテナーのモノリス）**を踏襲します。ユニットを「同一アプリ内の論理モジュール」として扱う前提でよいですか？

A) はい。単一デプロイのモノリス内の**論理モジュール**として分解する（独立デプロイはしない）

B) いいえ。一部を独立サービス（別デプロイ）に分離したい（→ どれを分離するか X で記述）

X) Other（[Answer]: の後に記述）

[Answer]: A

### Question UG2: 計算エンジン（U3）の分割粒度
被害度計算エンジン（assessment）は PBT 重点・中核ロジックです。U3 を 1 ユニットとしてまとめますか、第1次計算と第2次計算で分けますか？

A) 1 ユニット（U3）にまとめる（マスタ定数・第1次・第2次・6区分・階按分を一体で構築）

B) 第1次計算と第2次計算を別ユニットに分ける（U3a/U3b）

X) Other（[Answer]: の後に記述）

[Answer]: B

### Question UG3: フロントエンド（U6）の分割
フロントエンドを 1 ユニットにまとめますか、機能ジャーニー単位で分割しますか？（ローカルファースト基盤＝IndexedDB/同期は横断的に必要）

A) 1 ユニット（U6）にまとめる（ローカルファースト基盤含む）

B) 「ローカルファースト基盤（IndexedDB＋同期）」を別ユニットに切り出し、画面ジャーニーと分ける

C) ジャーニー単位（認証画面/調査入力/結果・出力）で複数に分割

X) Other（[Answer]: の後に記述）

[Answer]: B

### Question UG4: 構築順序（実装シーケンス）
ユニットの構築順序は execution-plan.md の提案（U0→U1→U2→U3→U4→U5→U6）でよいですか？

A) 提案どおり（基盤→ドメイン→計算→画像→出力→UI）

B) 別の順序を希望（X で記述）

X) Other（[Answer]: の後に記述）

[Answer]:A 

### Question UG5: 監査ログ・横断的関心事の所属
監査ログ・入力検証・暗号化などの横断的関心事を、どのユニットに含めますか？

A) U1（認証・基盤）に横断基盤として集約し、各ユニットが利用する

B) 専用の横断ユニット（U-Cross）として独立させる

C) 各ユニット内にそれぞれ実装（共通規約に従う）

X) Other（[Answer]: の後に記述）

[Answer]: B

### Question UG6: ローカルファースト同期 API（提出時一括）の所属
提出時一括同期の受け口（`POST /api/private/surveys/submission` → `ingestSubmission`）は、サーバ側ではどのユニットに置きますか？

A) U2（調査管理）に含める（survey 集約の一部として）

B) U6 と対になるサーバ側同期ユニットを新設する

X) Other（[Answer]: の後に記述）

[Answer]: 

### Question UG7: ストーリー割当の確認
上表「関連ストーリー（案）」のユニット割当に異論はありますか？（特に US-207 同期、US-803/804 セキュリティ、US-801 検証の所属）

A) 案のとおりで良い

B) 変更したい（X で記述）

X) Other（[Answer]: の後に記述）

[Answer]: A

---

## 3.1 フォローアップ質問（UG6 未回答＋回答分析で検出した論点）

### Question UG6（未回答・必須）: ローカルファースト同期 API（提出時一括）の所属
提出時一括同期の受け口（`POST /api/private/surveys/submission` → `ingestSubmission`）は、サーバ側ではどのユニットに置きますか？

A) U2（調査管理）に含める（survey 集約の一部として）

B) U6 と対になるサーバ側同期ユニットを新設する

C) UG3=B で切り出す「ローカルファースト基盤ユニット」のサーバ側カウンターパートとして、同期専用ユニットにまとめる

X) Other（[Answer]: の後に記述）

[Answer]: A — 同期 API（ingestSubmission）は U2（調査管理）に含める。

### Question UG2-FU（必須）: 計算エンジン分割（U3a/U3b）時の共有要素の所属
UG2=B で第1次（U3a）/第2次（U3b）を別ユニットに分けると、両者が共有する要素（**マスタ定数**＝構成比・浸水深換算・部位定義・既定按分、**6区分マッピング** `classifyDamageLevel`、**階按分** `applyFloorRatio`、**結果不変条件/PBT ハーネス**）の置き場所が必要です。どうしますか？

A) 共有コアユニット **U3c（assessment-core）** を新設し、U3a/U3b が依存する（推奨：重複回避・PBT 一元化）

B) U3a（第1次）に共有要素を置き、U3b が U3a に依存する

C) 横断ユニット U-Cross（UG5=B）に含める

X) Other（[Answer]: の後に記述）

[Answer]: A — 共有コアユニット U3c（assessment-core）を新設し、U3a/U3b が依存する。

### Question UG4-FU（必須）: 新ユニット構成での構築順序の確定
UG2=B / UG3=B / UG5=B により、ユニット構成が当初提案（U0〜U6）から変わります。更新後の想定ユニット:
U0（デモ削除）, U1（認証/ロール）, **U-Cross（横断：監査/検証/暗号化）**, U2（調査管理）, **U3c（計算コア・共有, UG2-FU=A の場合）**, **U3a（第1次計算）**, **U3b（第2次計算）**, U4（画像）, U5（出力・一覧）, **U6f（ローカルファースト基盤：IndexedDB＋同期）**, **U6u（画面ジャーニー UI）**。

構築順序の希望は？

A) 推奨順: U0 → U1 → U-Cross → U2 → U3c → U3a → U3b → U4 → U5 → U6f → U6u

B) 当初の提案順を踏襲（依存が許す範囲で）

X) Other（[Answer]: の後に記述）

[Answer]: A — 推奨順: U0 → U1 → U-Cross → U2 → U3c → U3a → U3b → U4 → U5 → U6f → U6u。

---

## 4. 回答後の流れ
1. 回答の曖昧性を分析（必要ならフォローアップ質問を追加）
2. 計画の承認を依頼
3. 承認後、Part 2 で unit-of-work.md / unit-of-work-dependency.md / unit-of-work-story-map.md を生成
