import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "llm-gateway-admin-web"

const ROUTES = [
  { model: "gpt-4o", provider: "OpenAI Production", weight: 70, status: "enabled" },
  { model: "gpt-4o-mini", provider: "OpenAI Production", weight: 20, status: "enabled" },
  { model: "claude-opus-4", provider: "Anthropic", weight: 10, status: "enabled" },
  { model: "llama-3.1-70b", provider: "Self-hosted vLLM", weight: 0, status: "disabled" },
]

export function RoutesTable() {
  return (
    <div style={{ maxWidth: 640 }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Provider model</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Weight</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ROUTES.map((r) => (
            <TableRow key={r.model}>
              <TableCell style={{ fontWeight: 600 }}>{r.model}</TableCell>
              <TableCell style={{ color: "var(--muted-foreground)" }}>{r.provider}</TableCell>
              <TableCell>{r.weight}%</TableCell>
              <TableCell>
                <Badge variant={r.status === "enabled" ? "success" : "outline"}>{r.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
