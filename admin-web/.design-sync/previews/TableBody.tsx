import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "llm-gateway-admin-web"

const MODELS = [
  { model: "gpt-4o", provider: "OpenAI Production", weight: 70, status: "enabled" },
  { model: "gpt-4o-mini", provider: "OpenAI Production", weight: 20, status: "enabled" },
  { model: "claude-opus-4", provider: "Anthropic", weight: 10, status: "enabled" },
  { model: "llama-3.1-70b", provider: "Self-hosted vLLM", weight: 0, status: "disabled" },
]

export function ModelRoutesBody() {
  return (
    <div style={{ maxWidth: 640 }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Provider model</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead style={{ textAlign: "right" }}>Weight</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {MODELS.map((m) => (
            <TableRow key={m.model}>
              <TableCell style={{ fontWeight: 600 }}>{m.model}</TableCell>
              <TableCell style={{ color: "var(--muted-foreground)" }}>{m.provider}</TableCell>
              <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {m.weight}%
              </TableCell>
              <TableCell>
                <Badge variant={m.status === "enabled" ? "success" : "outline"}>{m.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
