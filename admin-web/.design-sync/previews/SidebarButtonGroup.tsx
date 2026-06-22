import { SidebarButtonGroup } from "llm-gateway-admin-web"

export function Default() {
  return (
    <div style={{ background: "var(--sidebar)", padding: 12, borderRadius: 10, width: 230 }}>
      <SidebarButtonGroup />
    </div>
  )
}
