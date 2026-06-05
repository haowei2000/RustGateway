import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const itemVariants = cva(
  "group relative grid min-h-8 w-full items-center rounded-md border px-2 text-left transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      selected: {
        false:
          "border-transparent bg-transparent text-sidebar-muted hover:border-sidebar-muted/20 hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground focus-visible:border-sidebar-muted/20 focus-visible:bg-sidebar-accent/65 focus-visible:text-sidebar-accent-foreground",
        true: "border-sidebar-muted/20 bg-sidebar-accent/65 text-sidebar-accent-foreground",
      },
    },
    defaultVariants: {
      selected: false,
    },
  },
)

export type ItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof itemVariants>

function Item({ className, selected, ...props }: ItemProps) {
  return <button className={cn(itemVariants({ selected, className }))} type="button" {...props} />
}

function ItemTitle({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "truncate text-sm font-semibold text-inherit wrap-anywhere",
        className,
      )}
      {...props}
    />
  )
}

function ItemDetail({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-30 grid min-w-40 max-w-64 translate-x-1 -translate-y-1/2 gap-1 rounded-lg border border-sidebar-muted/20 bg-sidebar-accent px-3 py-2 text-sidebar-accent-foreground opacity-0 shadow-[0_12px_26px_rgb(0_0_0_/_0.2)] transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
        className,
      )}
      {...props}
    />
  )
}

function ItemEyebrow({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "text-xs uppercase wrap-anywhere",
        className,
      )}
      {...props}
    />
  )
}

function ItemMeta({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "text-xs leading-snug wrap-anywhere",
        className,
      )}
      {...props}
    />
  )
}

export { Item, ItemDetail, ItemEyebrow, ItemMeta, ItemTitle }
