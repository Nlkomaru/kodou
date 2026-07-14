---
title: VRC Heart Rate との互換性
description: べこのみせ様の VRC Heart Rate 対応アバターを Kodou で使う方法
---

[べこのみせ様の VRC Heart Rate](https://shop.beko.ooo/category/-vrc-heart-rate/) は、VRChat 向けに配布されている心拍表示アバターギミックです。

このギミックは VRCOSC の Heartrate モジュールが送る Avatar Parameter を前提としています。
Kodou は既定で `/avatar/parameters/VRCOSC/Heartrate/...` へ送信するため、追加の設定なしで動作します。ギミック側の改変も不要です。

心拍データを送るには、アプリの OSC 画面で「送信を有効化」をオンにしてください。

送信されるパラメータの対応表は [VRCOSC との互換性](/docs/config/compatible/osc) を参照してください。

:::warn
Kodou はべこのみせ様の公式サポート対象ではありません。
互換モードで動作しない場合は、べこのみせ様ではなく [Kodou のリポジトリ](https://github.com/Nikomaru0102/kodou) へご報告ください。
:::
