# コンポーネント定義（Application Design）

住家被害認定調査（水害）効率化アプリの高レベルコンポーネント設計。既存 CATAPULT の DDD 構造（`domain/{context}` = UseCase / Model / Store、`service/` = ACL/基盤、`api/private/` = プレゼンテーション）に準拠する。設計判断は AD1〜AD6・AD2-FU/AD2-FU2 の回答に従う。

## 設計判断の反映

| 判断 | 回答 | 反映 |
|---|---|---|
| AD1 計算エンジン境界 | A: 独立 | `assessment` を独立した境界づけられたコンテキスト（純粋ドメイン）として分離 |
| AD2 進捗保持 / AD2-FU | A: オフライン/ローカルファースト正式採用 | クライアント `LocalDraftStore`（IndexedDB）＋サーバ `survey` の状態。提出時に一括同期 |
| AD2-FU2 同期トリガ | A: 提出時一括 | `SyncOnSubmit`（提出操作で IndexedDB→サーバ送信） |
| AD3 マスタ保持 | A: コード内定数 | `assessment/constants`（バージョン管理されたソース定数） |
| AD4 PDF/CSV 生成 | A: サーバ側 | `export` コンポーネント（サーバ生成） |
| AD5 調査区分モデル | B: 別エンティティ | `FirstSurvey` / `SecondSurvey` を別エンティティ（別 domain サブモデル）に分離 |
| AD6 認可 | A: 多層防御 | `api/private/hooks` + 各 Model 層 `assert` の二層で強制 |

---

## 1. サーバ側コンポーネント（境界づけられたコンテキスト）

### 1.1 `auth`（認証・ユーザー・ロール）
- **責務**: Cognito 連携による認証（既存踏襲）、利用者の解決（findOrCreateUser）、ロール（調査員/管理者/閲覧者）の保持と判定の基盤提供。
- **含む**: `UserEntity`（+ `role`）、ロール定義、認可ヘルパー（`assertRole`, `assertOwnerOrRole`）。
- **依存**: `service/cognito`、`store`（user 永続化）。
- **要件**: FR-40, FR-41, FR-42, FR-43 / SECURITY-08。
- **種別**: Domain（既存 `user` ドメインを拡張）。

### 1.2 `survey`（調査集約 — 共通）
- **責務**: 1家屋=1調査の集約ルート。家屋識別情報・被災者 PII・GPS・状態機械（下書き→提出→承認→確定）・調査区分参照・正式判定の保持と遷移。第1次/第2次の共通親概念。
- **含む**: `SurveyEntity`（共通属性＋状態＋区分＋親第1次参照）、`OfficialDetermination`（正式判定）。
- **依存**: `assessment`（計算結果の格納）、`photo`、`auth`（認可）、`store`。
- **要件**: FR-01〜FR-09, FR-18, FR-19 / SECURITY-01, SECURITY-13。
- **種別**: Domain（集約ルート）。
- **備考**: AD5=B に従い、被害入力の実体は `FirstSurvey` / `SecondSurvey` の別エンティティで保持し、`Survey` がそれらを参照・統括する。

### 1.3 `firstSurvey`（第1次調査）
- **責務**: 外観目視の入力（外力・流失該当 / 傾斜実測 / 浸水深）と、その判定入力データの保持。
- **含む**: `FirstSurveyEntity`（外力フラグ・傾斜・浸水深・階按分入力）。
- **依存**: `survey`（親）、`assessment`（計算）、`store`。
- **要件**: FR-06, FR-07, FR-20〜22, FR-28。
- **種別**: Domain。

### 1.4 `secondSurvey`（第2次調査・再調査）
- **責務**: 内部立入の部位別損傷率（外部部位＋内部部位）の入力データ保持。確定済み第1次への関連付け（再調査）。
- **含む**: `SecondSurveyEntity`（部位別損傷率マップ・親第1次参照・階按分入力）。
- **依存**: `survey`（親）、`firstSurvey`（親参照）、`assessment`、`store`。
- **要件**: FR-07, FR-08, FR-23, FR-28 / AC-8。
- **種別**: Domain。

### 1.5 `assessment`（被害度計算エンジン — 独立コンテキスト）★AD1=A
- **責務**: 損害割合（％）と6区分の決定論的算出。第1次（外力・流失/傾斜/浸水深）と第2次（部位別損傷率×構成比、階按分）の全経路を**純粋関数**として実装。フレームワーク・永続化に非依存。
- **含む**: `calcFirst`, `calcSecond`, `classifyDamageLevel`（6区分マッピング）、`applyFloorRatio`（階按分）、`constants`（構成比・浸水深換算表・部位定義・既定按分）。
- **依存**: なし（純粋）。入力は値オブジェクト/プリミティブ、出力は `AssessmentResult`。
- **要件**: FR-11, FR-20〜28 / NFR-04 / §7 PBT。
- **種別**: Domain（純粋計算カーネル）。PBT 重点対象。

### 1.6 `photo`（画像）
- **責務**: 部位/全体の写真の S3 連携、調査・部位・ステップへの紐付け。
- **含む**: `PhotoEntity`（s3Key・区分・部位参照・撮影日時・任意 GPS）。
- **依存**: `service/s3`、`survey`、`store`。
- **要件**: FR-12, FR-13, FR-14 / SECURITY-01。
- **種別**: Domain。

### 1.7 `export`（PDF/CSV 出力 — サーバ生成）★AD4=A
- **責務**: 調査票様式 PDF（単票）と CSV/Excel（複数件）をサーバ側で生成。認可制御下で出力。
- **含む**: `buildSurveyPdf`、`buildSurveyCsv`、様式テンプレート定義。
- **依存**: `survey`（読み取り Query）、`assessment`（結果整形）、`auth`（認可）。
- **要件**: FR-31, FR-32, FR-33 / SECURITY-08。
- **種別**: Domain/Service 複合（生成は副作用境界）。

### 1.8 横断（既存基盤の拡張）
- **`service/cognito` / `service/s3` / `service/prismaClient`**: 既存 ACL/基盤を踏襲・拡張。
- **`api/private/hooks`**: 認証＋ロール注入（多層防御の第1層、AD6=A）。
- **監査ログ基盤**: 状態遷移・PII/確定変更の監査記録（NFR-08, SECURITY-13/14）。
- **入力検証**: `common/validators`（zod）を境界で適用（SECURITY-05）。

---

## 2. クライアント側コンポーネント（ローカルファースト）★AD2-FU=A

### 2.1 `SurveyWizard`（ガイド付きステップ進行）
- **責務**: 標準ステップ順序（住民情報入力→1次/2次選択→調査入力→（該当時）2階割合→計算結果確認）の進行制御、進捗パンくず（ステッパー）表示、ステップ間移動、スキップ判定。
- **依存**: `LocalDraftStore`（入力保持）、`api`（提出時）、クライアント計算プレビュー（任意）。
- **要件**: FR-15, FR-16, FR-17 / US-205, US-206, US-404。
- **種別**: Frontend（features/components）。

### 2.2 `LocalDraftStore`（IndexedDB 永続化）★AD2-FU=A
- **責務**: 入力内容・進捗状態・撮影画像（バイナリ）をオフラインでも IndexedDB に保持。再読込・スリープ復帰を跨いで復元。アプリ層暗号化で PII・画像を保護。
- **依存**: ブラウザ IndexedDB、暗号化ユーティリティ（Web Crypto）。
- **要件**: FR-18 / NFR-02 / SECURITY-01 / US-204, US-207。
- **種別**: Frontend（hooks/utils）。

### 2.3 `SyncOnSubmit`（提出時一括同期）★AD2-FU2=A
- **責務**: 「提出（下書き→提出）」操作時に IndexedDB の入力・画像をサーバへ一括送信。不通時はキューイング→オンライン復帰後に再試行。同期成功確認後にローカルの PII・画像を消去。
- **依存**: `LocalDraftStore`、`api`（aspida クライアント）、ネットワーク状態監視。
- **要件**: FR-19 / NFR-02 / SECURITY-01 / US-207。
- **種別**: Frontend（hooks/utils）。

### 2.4 `ResultView` / `ExportTrigger`
- **責務**: 計算結果（損害割合・6区分）の表示、第1次/第2次併記表示、PDF/CSV 出力のトリガ（生成はサーバ）。
- **依存**: `api`、`SurveyWizard`。
- **要件**: FR-30, FR-09 / FR-31, FR-32 / US-402, US-605, US-701, US-702。
- **種別**: Frontend。

---

## 3. コンポーネント関係サマリー（テキスト）

```text
[Client]
  SurveyWizard ──uses──> LocalDraftStore(IndexedDB, encrypted)
        │                      │
        │ submit               │ on submit
        ▼                      ▼
     api(aspida) <──── SyncOnSubmit (queue/retry/purge-after-sync)
        │
        ▼ HTTPS (TLS)
[Server: api/private/* + hooks(authz L1)]
        │
        ▼
   survey(UseCase) ──> firstSurvey / secondSurvey (Model, authz L2 assert)
        │   │
        │   ├──> assessment (pure calc kernel) ★独立
        │   ├──> photo (S3)
        │   └──> auth (role/ownership)
        ▼
   export (PDF/CSV server-side)
        │
        ▼
   service(prisma/s3/cognito) ──> PostgreSQL / S3 / Cognito
```

## 4. 削除対象（既存デモ）
- 既存 `task` ドメインおよびサンプル（controller/tests/UI）は本ドメイン群へ置換・削除（SECURITY-09, C2=A）。`user` ドメインはロール拡張のうえ流用。
