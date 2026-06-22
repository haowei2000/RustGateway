import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "llm-gateway-admin-web"

const LIMITS = [
  { policy: "weighted-chat-routing", type: "requests/min", limit: 600, state: "active" },
  { policy: "failover-embeddings", type: "tokens/min", limit: 120000, state: "active" },
  { policy: "round-robin-vision", type: "requests/min", limit: 90, state: "throttled" },
]

export function RateLimitCells() {
  return (
    <div style={{ maxWidth: 640 }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mapping policy</TableHead>
            <TableHead>Limit type</TableHead>
            <TableHead style={{ textAlign: "right" }}>Limit</TableHead>
            <TableHead>State</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {LIMITS.map((r) => (
            <TableRow key={r.policy}>
              <TableCell style={{ fontWeight: 600 }}>{r.policy}</TableCell>
              <TableCell style={{ color: "var(--muted-foreground)" }}>{r.type}</TableCell>
              <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {r.limit.toLocaleString()}
              </TableCell>
              <TableCell>
                <Badge variant={r.state === "active" ? "success" : "warning"}>{r.state}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
