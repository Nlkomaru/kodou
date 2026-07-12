import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const baseChecked = "bg-primary text-primary-foreground"

function Checkbox({
  className,
  checked,
  onCheckedChange,
  disabled,
  ...props
}: Omit<React.ComponentProps<"button">, "onChange"> & {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked ?? false}
      data-state={checked ? "checked" : "unchecked"}
      disabled={disabled}
      data-slot="checkbox"
      onClick={() => onCheckedChange?.(!(checked ?? false))}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-sm border border-input transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? baseChecked : "bg-transparent",
        className,
      )}
      {...props}
    >
      {checked ? <Check className="size-3" strokeWidth={4} /> : null}
    </button>
  )
}

export { Checkbox }