import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "llm-gateway-admin-web"

const POLICIES = [
  { name: "weighted-chat-routing", strategy: "weighted", routes: 3 },
  { name: "failover-embeddings", strategy: "priority", routes: 2 },
  { name: "round-robin-vision", strategy: "round-robin", routes: 4 },
]

export function PoliciesColumnHeaders() {
  return (
    <div style={{ maxWidth: 640 }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mapping policy</TableHead>
            <TableHead>Strategy</TableHead>
            <TableHead style={{ textAlign: "right" }}>Routes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {POLICIES.map((p) => (
            <TableRow key={p.name}>
              <TableCell style={{ fontWeight: 600 }}>{p.name}</TableCell>
              <TableCell style={{ color: "var(--muted-foreground)" }}>{p.strategy}</TableCell>
              <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {p.routes}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
