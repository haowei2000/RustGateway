import { SidebarResizeHandle } from "llm-gateway-admin-web"

export function InContext() {
  return (
    <div style={{ display: "flex", height: 200, width: 420 }}>
      <div style={{ width: 180, background: "var(--sidebar)" }} />
      <SidebarResizeHandle />
      <div style={{ flex: 1, background: "var(--background)" }} />
    </div>
  )
}
