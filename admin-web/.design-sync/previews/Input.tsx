import { Input, Label } from "llm-gateway-admin-web"

export function Labeled() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 320 }}>
      <Label htmlFor="in-key-name">Key name</Label>
      <Input id="in-key-name" placeholder="production-backend" />
    </div>
  )
}

export function WithValue() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 320 }}>
      <Label htmlFor="in-base-url">Provider base URL</Label>
      <Input id="in-base-url" defaultValue="https://api.openai.com/v1" />
    </div>
  )
}

export function Disabled() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 320 }}>
      <Label htmlFor="in-prefix">Key prefix</Label>
      <Input id="in-prefix" defaultValue="ek-7f3a" disabled />
    </div>
  )
}
