import { Input, Label } from "llm-gateway-admin-web"

export function FormFields() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 320 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Label htmlFor="lbl-policy">Mapping policy</Label>
        <Input id="lbl-policy" placeholder="epichust-chat" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Label htmlFor="lbl-model">Upstream model</Label>
        <Input id="lbl-model" defaultValue="gpt-4o-mini" />
      </div>
    </div>
  )
}
