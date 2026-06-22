import { Card, CardContent, CardHeader, CardTitle } from "llm-gateway-admin-web"

export function SettingsTitleCard() {
  return (
    <div style={{ maxWidth: 480 }}>
      <Card>
        <CardHeader>
          <CardTitle>Gateway settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "var(--muted-foreground)" }}>Upstream key ref</span>
              <span style={{ fontWeight: 600 }}>openai-prod-01</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "var(--muted-foreground)" }}>Auto migrate</span>
              <span style={{ fontWeight: 600 }}>enabled</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span style={{ color: "var(--muted-foreground)" }}>SSE passthrough</span>
              <span style={{ fontWeight: 600 }}>on</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
