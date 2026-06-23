import { AlertCircle, CheckCircle2, Info, X, type LucideIcon } from "lucide-react"

import { useToastStore, type ToastKind } from "@/stores/toast-store"

const ICONS: Record<ToastKind, LucideIcon> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  return (
    <div className="toaster" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind]
        return (
          <div key={t.id} className={`toast toast-${t.kind}`} role="status">
            <Icon className="toast-icon" aria-hidden="true" />
            <span className="toast-msg">{t.message}</span>
            <button
              type="button"
              className="toast-close"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
            >
              <X className="icon-sm" aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export { Toaster }
