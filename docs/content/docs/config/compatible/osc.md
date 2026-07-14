---
title: VRCOSC との互換性
description: VRCOSC 向けに作られたアバターを Kodou でそのまま使う方法
---

[VRCOSC](https://vrcosc.com/) は VRChat 向けの OSC モジュールプラットフォームで、心拍表示アバターの多くが VRCOSC の Heartrate モジュールを前提に作られています。

VRCOSC 向けアバターは `/avatar/parameters/VRCOSC/Heartrate/...` というアドレスのパラメータを受け取ります。
Kodou は標準では `/avatar/parameters/Kodou/...` へ送信するため、そのままでは VRCOSC 向けアバターは反応しません。

## 使い方

設定画面で **VRCOSC 互換** を有効にすると、Kodou 標準のアドレスに加えて VRCOSC のアドレスにも同じ値を複製送信します。アバター側の改変は不要です。

| VRCOSC パラメータ | Kodou 標準での対応 |
| --- | --- |
| `Connected` | `Kodou/Connected` |
| `Value` | `Kodou/HR` |
| `Normalised` | `Kodou/HRNormalised` |
| `Average` | `Kodou/HRAverage` |
| `Beat` | `Kodou/BeatToggle` / `Kodou/BeatPulse` |
| `Enabled` / `Units` / `Tens` / `Hundreds` | `Kodou/Legacy/*` |

アドレスと型の完全な一覧は [送信される情報](/docs/osc) を参照してください。

## iron-heart との互換性

[iron-heart](https://github.com/nullstalgia/iron-heart) は `/avatar/parameters/HR` や `/avatar/parameters/isHRConnected` のように、接頭辞なしの短いパラメータ名を使います。
こちらも設定画面の **iron-heart 互換** を有効にすることで、同じ要領で対応できます。

iron-heart の `RRInterval` は、値が大きく変化しやすいため同期用途には向かず主にローカルデバッグ用、と README で説明されています。
アバター側で拍の揺らぎを表現したい場合は、`RRTwitchUp` / `RRTwitchDown` のような bool トリガーのほうが扱いやすいです。

:::warn
VRCOSC や iron-heart 本体と Kodou を同時に起動すると、同じ Avatar Parameter へ両方から送信することになり値が競合します。
どれか一つだけを使ってください。
:::
