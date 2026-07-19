import { Toaster as Sonner } from "sonner"

// shadcn の Toaster。標準の実装は next-themes に依存するが、
// このアプリはテーマ切り替えを持たないため CSS 変数だけで見た目を合わせる。
function Toaster({ ...props }: React.ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      className="toaster group"
      position="bottom-right"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
