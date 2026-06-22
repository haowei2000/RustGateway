import { Badge } from "llm-gateway-admin-web"

export function Variants() {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <Badge>default</Badge>
      <Badge variant="secondary">secondary</Badge>
      <Badge variant="destructive">destructive</Badge>
      <Badge variant="success">success</Badge>
      <Badge variant="warning">warning</Badge>
      <Badge variant="outline">outline</Badge>
    </div>
  )
}

export function StatusLabels() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: "var(--foreground)" }}>
        <span>openai-primary</span>
        <Badge variant="success">enabled</Badge>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: "var(--foreground)" }}>
        <span>anthropic-fallback</span>
        <Badge variant="secondary">disabled</Badge>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14, color: "var(--foreground)" }}>
        <span>epichust-chat</span>
        <Badge variant="warning">rate limited</Badge>
      </div>
    </div>
  )
}
