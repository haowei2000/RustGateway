import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "llm-gateway-admin-web"

export function ProviderCard() {
  return (
    <div style={{ maxWidth: 420 }}>
      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <CardTitle>OpenAI Production</CardTitle>
            <Badge variant="success">enabled</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted-foreground)" }}>
            Upstream provider serving 12 models across 3 mapping policies. Keys are
            stored encrypted and never logged.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Button size="sm">Manage models</Button>
            <Button size="sm" variant="outline">
              Edit
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function StatCard() {
  return (
    <div style={{ maxWidth: 420 }}>
      <Card>
        <CardHeader>
          <CardTitle>Requests today</CardTitle>
        </CardHeader>
        <CardContent>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 650, lineHeight: 1.1 }}>48,210</p>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted-foreground)" }}>
            +12.4% vs. yesterday · 0.3% auth failures
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
