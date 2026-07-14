# 推奨される書き方

## 状態管理 (Jotai)
- グローバルな状態は `app/src/state/` にアトムとして定義し、`useAtom` / `useAtomValue` / `useSetAtom` で参照してください。
- ローカルな UI 状態は `useState` で十分な場合は無理にアトム化しないでください。
- 派生状態には `useAtomValue` と派生アトム（`atom((get) => ...)`）を組み合わせてください。

## Tauri IPC
- フロントエンドから Rust 側を呼ぶ際は `@tauri-apps/api` の `invoke("<command>", args)` を使用してください。
- Rust からのイベント受信は `listen("<event>", callback)` を使用してください。
- コマンド名・イベント名はスネークケースで統一し、フロントエンド側でも同じ名前を使用してください。

## 非同期 / エラーハンドリング
- Tauri コマンドは `Result<T, String>` を返し、エラーはフロントエンドで `toast` 等で表示してください。
- BLE 接続や OSC 送信など失敗しやすい処理は、指数バックオフで再接続するなど耐障害性を持たせてください。

## スタイリング
- Tailwind CSS v4 のユーティリティを優先し、カラートークン（`bg-background` / `text-foreground` など）を使用してください。
- `cva`（class-variance-authority）でバリアントを管理し、shadcn の記法に合わせてください。

## Test
- テストは主要な分岐点をカバーする程度に留め、過度な網羅は避けてください。
- テストケースの説明は英語で短く記述してください。

## 正式サポート環境
- 正式サポートは Windows 11 のみです。ただし macOS / Linux 向けのビルドも配布しています。プラットフォーム固有のコードを書く際はこの点に留意してください。