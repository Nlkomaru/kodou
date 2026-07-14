---
title: VRC Heart Rate との互換性
description: べこのみせ様の VRC Heart Rate 対応アバターを Kodou で使う方法
---

[べこのみせ様の VRC Heart Rate](https://shop.beko.ooo/category/-vrc-heart-rate/) は、VRChat 向けに配布されている心拍表示アバターギミックです。

このギミックは VRCOSC の Heartrate モジュールが送る Avatar Parameter を前提としています。
そのため Kodou から使う場合は、設定画面で **VRCOSC 互換** を有効にしてください。
Kodou 標準の `/avatar/parameters/Kodou/...` に加えて `/avatar/parameters/VRCOSC/Heartrate/...` へも同じ値が送られるため、ギミック側の改変なしで動作します。

送信されるパラメータの対応表は [VRCOSC との互換性](/docs/config/compatible/osc) を参照してください。

:::warn
Kodou はべこのみせ様の公式サポート対象ではありません。
互換モードで動作しない場合は、べこのみせ様ではなく [Kodou のリポジトリ](https://github.com/Nikomaru0102/kodou) へご報告ください。
:::
