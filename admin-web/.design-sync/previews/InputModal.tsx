import * as React from "react"
import { InputModal } from "llm-gateway-admin-web"

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

export function NewKey() {
  return (
    <Stage height={300}>
      <InputModal
        open
        title="New API key"
        label="Key name"
        placeholder="production-backend"
        onClose={noop}
        onConfirm={noop}
      />
    </Stage>
  )
}
