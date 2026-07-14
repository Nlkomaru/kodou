---
title: VRCOSC との互換性
description: VRCOSC 向けに作られたアバターを Kodou でそのまま使う方法
---

[VRCOSC](https://vrcosc.com/) は VRChat 向けの OSC モジュールプラットフォームで、心拍表示アバターの多くが VRCOSC の Heartrate モジュールを前提に作られています。

VRCOSC 向けアバターは `/avatar/parameters/VRCOSC/Heartrate/...` というアドレスのパラメータを受け取ります。
Kodou は**既定でこのアドレスへ送信する**ため、VRCOSC 向けアバターは設定なしでそのまま動作します。アバター側の改変も不要です。

| VRCOSC パラメータ | Kodou の設定キー | 既定で送信 |
| --- | --- | --- |
| `Connected` | `connected` | はい |
| `Value` | `hr` | はい |
| `Normalised` | `hrNormalised` | はい |
| `Average` | `hrAverage` | はい |
| `Beat` | `beatToggle` | はい |

VRCOSC の旧形式パラメータ（`Enabled` / `Units` / `Tens` / `Hundreds`。BPM を3桁に分解して送るもの）には対応していません。

## 他のアドレス体系へ合わせる

送信先アドレスはパラメータごとに自由に指定できます。
別のギミックに合わせたい場合は、`config.conf` の `compatibility` セクションでアドレスを書き換えてください。

1つのパラメータに複数のアドレスを書くと、同じ値がすべてのアドレスへ送られます。
VRCOSC 向けアバターと独自ギミックを同時に動かしたい場合に使えます。

```text
compatibility {
  hr = [
    "/avatar/parameters/VRCOSC/Heartrate/Value",
    "/avatar/parameters/HR"
  ]
}
```

書式の詳細は [設定ファイル](/docs/config/config-file) を参照してください。

:::warn
VRCOSC 本体と Kodou を同時に起動すると、同じ Avatar Parameter へ両方から送信することになり値が競合します。
どちらか一方だけを使ってください。
:::
