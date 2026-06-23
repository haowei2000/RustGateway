import { create } from "zustand"

export type ToastKind = "success" | "error" | "info"

export type Toast = {
  id: number
  kind: ToastKind
  message: string
}

type ToastStore = {
  toasts: Toast[]
  push: (kind: ToastKind, message: string) => void
  dismiss: (id: number) => void
}

let counter = 0

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = ++counter
    set((state) => ({ toasts: [...state.toasts, { id, kind, message }] }))
    // Errors linger a little longer; everything auto-dismisses.
    const ttl = kind === "error" ? 6000 : 4000
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, ttl)
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

/** Classify a free-text notice string as error vs success for auto-toasting. */
function looksLikeError(message: string): boolean {
  return /\b(fail|failed|error|invalid|cannot|can't|unable|denied|not found)\b/i.test(message)
}

export function useToast() {
  const push = useToastStore((s) => s.push)
  return {
    success: (m: string) => push("success", m),
    error: (m: string) => push("error", m),
    info: (m: string) => push("info", m),
    /** Auto-classify a free-text message (used to wrap existing setNotice calls). */
    auto: (m: string) => {
      if (!m) return
      push(looksLikeError(m) ? "error" : "success", m)
    },
  }
}
