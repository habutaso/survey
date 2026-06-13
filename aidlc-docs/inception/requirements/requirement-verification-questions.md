# 要件確認のための質問

対象アプリ: **住家被害認定調査の調査効率化アプリ**（タブレットで画像を撮影しながら被害度を入力し、最後に被害度を自動計算して被害度の段階を表示する）。

各質問の `[Answer]:` の後に選択肢の記号（A, B, C ...）を記入してください。該当するものがなければ最後の「X) Other」を選び、`[Answer]:` の後に自由記述してください。すべて記入し終えたら「完了」とお知らせください。

> 参考（内閣府「災害に係る住家の被害認定基準運用指針」の判定区分）:
> 損害割合 50%以上=全壊 / 40〜50%未満=大規模半壊 / 30〜40%未満=中規模半壊 / 20〜30%未満=半壊 / 10〜20%未満=準半壊 / 10%未満=準半壊に至らない（一部損壊）

---

## A. 機能要件

## Question A1
対象とする災害種別はどれですか？

A) 地震のみ

B) 水害（浸水）のみ

C) 地震 ＋ 水害

D) 地震 ＋ 水害 ＋ 風害など全般

X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question A2
対応する調査区分はどれですか？

A) 第1次調査（外観目視）のみ

B) 第2次調査（内部立入）のみ

C) 第1次・第2次の両方

X) Other (please describe after [Answer]: tag below)

[Answer]: A
外観、簡易調査、傾斜など1次調査の物を全て対応します。

## Question A3
最終的に表示・記録する被害度の判定区分はどれですか？

A) 公式6区分（全壊／大規模半壊／中規模半壊／半壊／準半壊／準半壊に至らない）

B) 簡易3区分（全壊／半壊／一部損壊）

C) 損害割合（％）のみ表示

D) 損害割合（％）＋ 公式6区分の両方

X) Other (please describe after [Answer]: tag below)

[Answer]: B

## Question A4
損害割合の算定方式はどれですか？

A) 部位別の損傷率 × 構成比の加重合計（運用指針準拠）

B) 浸水深ベースの簡易判定（水害向け）

C) 災害種別に応じて A と B を切り替え

X) Other (please describe after [Answer]: tag below)

[Answer]: C
住家被害認定調査における1次調査の計算方法は全て網羅します。

## Question A5
判定に用いる「部位」と「構成比（標準量）」の扱いはどれですか？

A) 運用指針の標準構成比を固定値として使用

B) 住家の種別（木造／非木造／プレハブ等）ごとに標準構成比を切替

C) 管理者が構成比マスタを編集できるようにする

X) Other (please describe after [Answer]: tag below)

[Answer]: A

## Question A6
画像の撮影単位はどれですか？

A) 部位ごとに紐付けて撮影（1部位に複数枚可）

B) 調査全体に対してまとめて撮影

C) 部位ごと ＋ 全体写真の両方

X) Other (please describe after [Answer]: tag below)

[Answer]: C

## Question A7
1件の調査の単位・識別方法はどれですか？

A) 1調査 ＝ 1家屋（住所・家屋番号等で識別）

B) 1調査 ＝ 1世帯

C) 1調査 ＝ 1棟（同一敷地に複数棟を想定）

X) Other (please describe after [Answer]: tag below)

[Answer]:A

## Question A8
調査データの状態管理（ワークフロー）はどれですか？

A) 下書き → 完了 の2状態

B) 下書き → 提出 → 承認 → 確定 の多段階承認

C) 状態管理は不要（入力即確定）

X) Other (please describe after [Answer]: tag below)

[Answer]:B

## Question A9
調査結果の出力形式はどれですか？

A) 画面表示のみ

B) 調査結果の PDF 出力

C) CSV／Excel エクスポート

D) PDF ＋ CSV の両方

X) Other (please describe after [Answer]: tag below)

[Answer]:D

## Question A10
利用者のロール構成はどれですか？

A) 調査員のみ（全員同一権限）

B) 調査員 ＋ 管理者

C) 調査員 ＋ 管理者 ＋ 閲覧者（自治体担当など）

X) Other (please describe after [Answer]: tag below)

[Answer]:C

---

## B. 非機能要件

## Question B1
オフライン対応は必要ですか？（被災現場でネットワークが不通になる可能性）

A) 必須（オフラインで入力・撮影し、復帰時にサーバへ同期）

B) 不要（常時オンライン前提）

C) 望ましいが必須ではない（将来対応でよい）

X) Other (please describe after [Answer]: tag below)

[Answer]:C

## Question B2
想定する同時利用規模はどれですか？

A) 小規模（〜数十人）

B) 中規模（数百人）

C) 大規模（災害時に数千人が同時利用）

X) Other (please describe after [Answer]: tag below)

[Answer]:B

## Question B3
主たる利用端末はどれですか？

A) タブレット（ブラウザ／PWA で動作）

B) タブレット専用ネイティブアプリ

C) タブレット ＋ PC 両対応（ブラウザ）

X) Other (please describe after [Answer]: tag below)

[Answer]:A

## Question B4
位置情報（GPS）の記録は必要ですか？

A) 必要（調査地点・撮影位置を記録する）

B) 不要

X) Other (please describe after [Answer]: tag below)

[Answer]:A

## Question B5
被災者の個人情報（氏名・住所等）を取り扱いますか？

A) 取り扱う（罹災証明書発行などとの連携を想定）

B) 建物情報のみ。個人情報は保持しない

X) Other (please describe after [Answer]: tag below)

[Answer]:A

---

## C. 既存システム（CATAPULT）との関係

## Question C1
既存 CATAPULT テンプレートの構成（Cognito 認証 / S3 画像 / PostgreSQL / 型安全 HTTP-RPC / DDD）の活用範囲はどれですか？

A) すべてそのまま踏襲して新ドメインを構築

B) 一部のみ流用（[Answer] に流用する範囲を記述）

C) 新規構成にしたい

X) Other (please describe after [Answer]: tag below)

[Answer]:A

## Question C2
既存のデモ用 Task / User ドメイン（Todo 機能）はどう扱いますか？

A) 削除し、被害認定ドメインに置き換える

B) 残したまま新ドメインを追加する

X) Other (please describe after [Answer]: tag below)

[Answer]:A

---

## D. 拡張機能（AI-DLC オプトイン）

## Question D1: セキュリティ拡張
このプロジェクトでセキュリティ拡張ルールを適用しますか？

A) はい — すべての SECURITY ルールをブロッキング制約として強制する（本番品質のアプリに推奨）

B) いいえ — SECURITY ルールをすべてスキップする（PoC・プロトタイプ・実験用途向け）

X) Other (please describe after [Answer]: tag below)

[Answer]:A

## Question D2: レジリエンシー拡張
このプロジェクトにレジリエンシー・ベースラインを適用しますか？

（適用すると、AWS Well-Architected Framework（信頼性の柱）に基づく設計時のベストプラクティス指針が、要件・設計・コードに反映されます。フォールトトレランス・高可用性・可観測性・復旧性などをカバーします。なお、これは本番認定や可用性/RTO/RPO の保証ではなく、検証・堅牢化の出発点となる第一案です。）

A) はい — レジリエンシー・ベースラインを設計時の指針として適用する（災害対応など業務上重要なワークロードに推奨）

B) いいえ — レジリエンシー・ベースラインをスキップする（PoC・プロトタイプ向け）

X) Other (please describe after [Answer]: tag below)

[Answer]:B

## Question D3: プロパティベーステスト拡張
このプロジェクトでプロパティベーステスト（PBT）ルールを適用しますか？

A) はい — すべての PBT ルールをブロッキング制約として強制する（ビジネスロジック・データ変換・シリアライズ・状態を持つコンポーネントを含むプロジェクトに推奨）

B) 一部のみ — 純粋関数とシリアライズの往復のみ PBT を適用する（アルゴリズム的複雑度が限定的なプロジェクト向け）

C) いいえ — PBT ルールをすべてスキップする（単純な CRUD・UI のみ・薄い連携層など）

X) Other (please describe after [Answer]: tag below)

[Answer]:A
