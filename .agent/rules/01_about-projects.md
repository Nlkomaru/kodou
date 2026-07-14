## このアプリケーションの概要

「Kodou（鼓動）」は、心拍数を監視し、それに基づいて VRChat のアバターを制御するデスクトップアプリです。
Bluetooth LE 心拍デバイスから心拍データを受信し、OSC 経由で VRChat アバターへパラメーターを送信します。
また、心拍イベントの履歴を記録し、UI 上で可視化します。

## 主な技術スタック

### デスクトップアプリ本体 (`app/`)

- **Tauri 2** — Rust バックエンド + WebView フロントエンドのデスクトップアプリ基盤
- **Rust** — 心拍デバイス通信 (btleplug)、OSC 送信 (rosc)、記録保存 (Parquet/Arrow) などのネイティブ実装
- **React 19 + Vite** — フロントエンド UI
- **TypeScript** — フロントエンドの型安全な実装
- **Tailwind CSS v4** — スタイリング
- **Jotai** — 状態管理（アトム指向）
- **shadcn / Radix UI / lucide-react** — UI コンポーネント
- **Storybook 10** — UI コンポーネントのカタログ (`app/.storybook`)

### ドキュメントサイト (`docs/`)

- **Next.js + Fumadocs** — ドキュメントサイト（`kodou.vrc.nikomaru.dev` で公開）
- **GitHub Pages** — ドキュメントのデプロイ先

### インフラ・CI

- **Cloudflare Workers (Static Assets)** — Storybook のホスティング (`kodou-sb.vrc.nikomaru.dev`)
- **GitHub Actions** — リリースビルド (Tauri)、ドキュメントデプロイ、Storybook デプロイ、Release Drafter
- **pnpm ワークスペース** — `app` と `docs` の2パッケージ構成