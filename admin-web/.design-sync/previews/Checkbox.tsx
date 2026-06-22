import { Checkbox, Label } from "llm-gateway-admin-web"

export function States() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Checkbox id="cb-stream" defaultChecked />
        <Label htmlFor="cb-stream">Enable SSE streaming</Label>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Checkbox id="cb-audit" />
        <Label htmlFor="cb-audit">Log audit events</Label>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Checkbox id="cb-quota" disabled />
        <Label htmlFor="cb-quota">Per-key quota (coming soon)</Label>
      </div>
    </div>
  )
}
