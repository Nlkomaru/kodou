# ディレクトリ配置規則

## ワークスペース構成

プロジェクトは pnpm ワークスペースで、`app` と `docs` の2パッケージから構成されます。

## `app/` — デスクトップアプリ本体

- `app/src/` — React フロントエンドのソース
  - `components/` — UI コンポーネント（`ui/` は shadcn のプリミティブ）
  - `pages/` — 各画面（dashboard / history / osc / settings）
  - `hooks/` — カスタムフック
  - `state/` — Jotai のアトム定義
  - `lib/` — 汎用ユーティリティ
  - `assets/` — 画像などの静的アセット
- `app/src-tauri/src/` — Rust バックエンド
  - `lib.rs` — Tauri アプリのエントリポイント・コマンド定義
  - `heart_rate.rs` — 心拍デバイス通信
  - `osc.rs` — OSC 送信
  - `recorder.rs` — 心拍データの記録保存
- `app/.storybook/` — Storybook の設定
- `app/wrangler.jsonc` — Cloudflare Workers (Storybook デプロイ) 設定

## `docs/` — ドキュメントサイト

- `docs/content/` — Fumadocs の mdx ドキュメント
- `docs/app/` — Next.js アプリのソース
- `docs/public/` — 静的アセット

## `.github/`

- `workflows/` — GitHub Actions のワークフロー
  - `tauri-release.yml` — リリースビルド
  - `docs-pages.yml` — ドキュメントのデプロイ
  - `storybook-deploy.yml` — Storybook のデプロイ
  - `release-drafter.yml` — リリースドラフトの自動更新
- `release-drafter.yml` — Release Drafter の設定