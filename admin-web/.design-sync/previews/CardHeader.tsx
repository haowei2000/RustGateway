import { Badge, Card, CardContent, CardHeader, CardTitle } from "llm-gateway-admin-web"

export function PolicyHeaderCard() {
  return (
    <div style={{ maxWidth: 480 }}>
      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <CardTitle>weighted-chat-routing</CardTitle>
            <Badge variant="success">enabled</Badge>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted-foreground)" }}>
            Mapping policy · strategy: weighted · 3 routes
          </p>
        </CardHeader>
        <CardContent>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted-foreground)" }}>
            Distributes traffic for epichust-chat across two OpenAI keys and one
            Anthropic fallback. Rate limit: 600 req/min.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
