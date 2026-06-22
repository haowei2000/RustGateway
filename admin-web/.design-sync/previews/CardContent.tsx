import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "llm-gateway-admin-web"

export function ProviderDetailCard() {
  return (
    <div style={{ maxWidth: 480 }}>
      <Card>
        <CardHeader>
          <CardTitle>Anthropic Production</CardTitle>
        </CardHeader>
        <CardContent>
          <p style={{ margin: 0, fontSize: 14, color: "var(--muted-foreground)" }}>
            Upstream provider for Claude models. The provider key is stored as
            ciphertext and substituted at the gateway before each request is
            forwarded upstream.
          </p>
          <div style={{ display: "flex", gap: 24, marginTop: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 650, lineHeight: 1.1 }}>8</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>models</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 650, lineHeight: 1.1 }}>2</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--muted-foreground)" }}>policies</p>
            </div>
            <div style={{ marginLeft: "auto", alignSelf: "center" }}>
              <Badge variant="success">healthy</Badge>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Button size="sm">Sync models</Button>
            <Button size="sm" variant="outline">
              Rotate key
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
