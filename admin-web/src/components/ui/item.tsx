import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// ── Short Item (sidebar) ──────────────────────────────────────────

const itemVariants = cva(
  "group relative flex h-9 w-full items-center gap-x-2.5 rounded-md px-2 text-left transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      selected: {
        false:
          "bg-transparent text-sidebar-muted hover:bg-sidebar-accent/65 hover:text-sidebar-accent-foreground focus-visible:bg-sidebar-accent/65 focus-visible:text-sidebar-accent-foreground",
        true: "bg-sidebar-accent/65 text-sidebar-accent-foreground",
      },
    },
    defaultVariants: { selected: false },
  },
)

export type ItemProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof itemVariants>

function Item({ className, selected, ...props }: ItemProps) {
  return <button className={cn(itemVariants({ selected, className }))} type="button" {...props} />
}

function ItemIcon({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("flex shrink-0 items-center justify-center w-5", className)} {...props} />
}

function ItemContent({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("min-w-0 flex-1 truncate", className)} {...props} />
}

function ItemTitle({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("truncate text-sm font-semibold text-inherit", className)} {...props} />
}

function ItemDetail({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute left-[calc(100%+0.5rem)] top-1/2 z-30 grid min-w-40 max-w-64 translate-x-1 -translate-y-1/2 gap-1 rounded-lg bg-sidebar-accent px-3 py-2 text-sidebar-accent-foreground opacity-0 shadow-[0_12px_26px_rgb(0_0_0_/_0.2)] transition-[opacity,transform] duration-150 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100",
        className,
      )}
      {...props}
    />
  )
}

function ItemEyebrow({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("text-xs uppercase wrap-anywhere", className)} {...props} />
}

function ItemMeta({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("text-xs leading-snug wrap-anywhere", className)} {...props} />
}

// ── Long Item (main content row) ──────────────────────────────────

function LongItem({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex min-h-12 w-full items-center gap-3 rounded-md bg-secondary/60 px-3 py-2.5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function LongItemIcon({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("shrink-0 text-muted-foreground", className)} {...props} />
}

function LongItemBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("min-w-0 flex-1", className)} {...props} />
}

function LongItemTitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("truncate text-sm font-semibold", className)} {...props} />
}

function LongItemSubtitle({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("truncate text-xs text-muted-foreground", className)} {...props} />
}

function LongItemActions({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex shrink-0 items-center gap-1.5", className)} {...props} />
}

export {
  Item, ItemContent, ItemDetail, ItemEyebrow, ItemIcon, ItemMeta, ItemTitle,
  LongItem, LongItemIcon, LongItemBody, LongItemTitle, LongItemSubtitle, LongItemActions,
}
