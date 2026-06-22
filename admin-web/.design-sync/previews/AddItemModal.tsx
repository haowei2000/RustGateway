import * as React from "react"
import { AddItemModal } from "llm-gateway-admin-web"

const POLICIES = [
  { id: "mp-1", label: "epichust-chat", subtitle: "weighted · 3 routes" },
  { id: "mp-2", label: "epichust-fast", subtitle: "priority · 2 routes" },
  { id: "mp-3", label: "epichust-vision", subtitle: "weighted · 1 route" },
]

const noop = () => {}

// The modal renders a position:fixed full-screen overlay. A `transform` on the
// wrapper makes it the containing block for that fixed layer, so the modal +
// dimmed backdrop render fully inside this box instead of escaping the card.
function Stage({ height, children }: { height: number; children: React.ReactNode }) {
  return (
    <div style={{ position: "relative", width: 460, height, transform: "translateZ(0)", overflow: "hidden", borderRadius: 12 }}>
      {children}
    </div>
  )
}

export function SelectItems() {
  return (
    <Stage height={420}>
      <AddItemModal
        open
        title="Attach mapping policy"
        emptyText="No policies available."
        confirmLabel="Attach selected"
        items={POLICIES}
        onClose={noop}
        onConfirm={noop}
      />
    </Stage>
  )
}

export function EmptyState() {
  return (
    <Stage height={260}>
      <AddItemModal
        open
        title="Attach mapping policy"
        emptyText="All policies are already attached to this key."
        items={[]}
        onClose={noop}
        onConfirm={noop}
      />
    </Stage>
  )
}
