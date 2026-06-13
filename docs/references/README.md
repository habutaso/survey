# 参考資料インデックス（住家被害認定調査）

これらは住家被害認定調査アプリの設計・実装の根拠とする内閣府防災の公式資料です。
被害度の判定ロジック（部位別損害割合 × 構成比の合算）や調査票の項目は、本資料に準拠します。

- **出典ドメイン**: bousai.go.jp（内閣府 政策統括官（防災担当））
- **取得元ページ**: https://www.bousai.go.jp/taisaku/unyou.html
- **取得日**: 2026-06-12
- **版**: 運用指針【令和7年7月】ほか（一部 令和3年版を含む）
- **権利**: 内閣府（Cabinet Office, Disaster Management）著作物。利用にあたり出典明記。

## ダウンロード済みファイル

| ファイル | 内容 | 元URL |
|---|---|---|
| 01_higai_nintei_gaiyou.pdf | 災害に係る住家の被害認定（概要・判定区分表） | /taisaku/pdf/r605higai_nintei.pdf |
| 02_shishin_hyoshi_jobun_mokuji.pdf | 運用指針 表紙・序文・目次 | /taisaku/pdf/r605shishin_0.pdf |
| 03_shishin_sosoku.pdf | 運用指針 総則 | /taisaku/pdf/r605shishin_1.pdf |
| 04_shishin_1_jishin.pdf | 運用指針 第1編 地震による被害 | /taisaku/pdf/r303shishin_2.pdf |
| 05_shishin_2_suigai.pdf | 運用指針 第2編 水害による被害 | /taisaku/pdf/r605shishin_3.pdf |
| 06_shishin_chosahyo.pdf | 住家被害認定調査票（様式群） | /taisaku/pdf/r605shishin_chousa.pdf |
| 07_chosahyo_about.pdf | 住家被害認定調査票について | /taisaku/pdf/chosa_about.pdf |
| 08_jishin_mokuzo_tebiki.pdf | 地震・木造/プレハブ 調査票 記入の手引き | /taisaku/pdf/jishin_mokuzo_tebiki.pdf |
| 09_suigai_mokuzo_tebiki.pdf | 水害・木造/プレハブ 調査票 記入の手引き | /taisaku/pdf/suigai_mokuzo_tebiki.pdf |

## 被害の程度（損害基準判定）

公式概要資料 (01) より、住家全体の損害割合に基づく区分:

| 被害の程度 | 損害割合 |
|---|---|
| 全壊 | 50％以上 |
| 大規模半壊 | 40％以上 50％未満 |
| 中規模半壊 | 30％以上 40％未満 |
| 半壊 | 20％以上 30％未満 |
| 準半壊 | 10％以上 20％未満 |
| 準半壊に至らない（一部損壊） | 10％未満 |

算定方式（概要資料より）: 原則として、部位（基礎・柱等）別の損害割合を算出し、それらを合計して住家全体の損害割合を算出して判定する。災害種別（地震／水害／風害／地盤被害）および住家種別（木造・プレハブ／非木造）ごとに調査票・構成比が定められている。

> 注: A3/A4 の「損傷程度の例示」参考資料（数十MB）は容量が大きいため未取得。必要になった段階で同じく bousai.go.jp から取得可能です。
