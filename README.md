# Kodou

[![Download](https://shieldcn.dev/github/release/Nlkomaru/kodou.svg)](https://github.com/Nlkomaru/kodou/releases/latest)
[![Docs](https://shieldcn.dev/badge/Docs-online-FFaaaa.svg?logo=readme)](https://kodou.vrc.nikomaru.dev)
[![Storybook](https://shieldcn.dev/badge/Storybook-online-FF4785.svg?logo=storybook)](https://kodou-sb.vrc.nikomaru.dev)

心拍数を監視し、それに基づいて VRChat のアバターを制御するデスクトップアプリです。
Tauri + React で作られたネイティブクライアントが心拍データを受信し、OSC 経由で VRChat にパラメーターを送信します。

## 機能

- **心拍モニタリング** — 心拍デバイスからの入力をリアルタイムに受信して表示
- **OSC 送信** — 心拍値や関連パラメーターを VRChat アバターへ OSC で送信
- **履歴** — 心拍イベントのログを記録・確認
- **自動接続** — 起動時に前回の接続先へ自動再接続

## ダウンロード

最新のビルドは [Releases](https://github.com/Nlkomaru/kodou/releases/latest) から取得できます。
macOS (Universal) / Windows / Linux 向けのバイナリを配布しています。

正式サポートは、Windows 11のみです。

## ドキュメント

- [ドキュメントサイト](https://kodou.vrc.nikomaru.dev) — 設定や使い方の詳しい説明
- [Storybook](https://kodou-sb.vrc.nikomaru.dev) — UI コンポーネントのカタログ

## 開発

このリポジトリは pnpm ワークスペースで構成されています。

| パッケージ | 説明                                         |
| ---------- | -------------------------------------------- |
| `app`      | Tauri + React のデスクトップクライアント本体 |
| `docs`     | Fumadocs ベースのドキュメントサイト         |

### セットアップ

```sh
# 依存関係のインストール
pnpm install

# アプリを開発モードで起動
pnpm run dev

# Storybook を起動
pnpm --dir app storybook

# ドキュメントを開発モードで起動
pnpm run docs
```

### 必要環境

- Node.js 24+
- pnpm 10.26.1+
- Rust（Tauri ビルド用）
- macOS / Windows / Linux の各プラットフォーム向け依存ライブラリ
  （詳細は [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) を参照）

## 技術スタック

- **デスクトップ:** Tauri 2 / Rust
- **フロントエンド:** React 19 / Vite / TypeScript / Tailwind CSS
- **状態管理:** Jotai
- **UI:** shadcn / Radix UI / lucide-react
- **ドキュメント:** Fumadocs / Next.js
- **コンポーネントカタログ:** Storybook 10
