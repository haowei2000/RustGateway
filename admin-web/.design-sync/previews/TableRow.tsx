import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "llm-gateway-admin-web"

const KEYS = [
  { prefix: "sk-epi-7f3a…", policy: "weighted-chat-routing", reqs: "48,210" },
  { prefix: "sk-epi-2b91…", policy: "failover-embeddings", reqs: "12,884" },
  { prefix: "sk-epi-c40d…", policy: "round-robin-vision", reqs: "6,073" },
  { prefix: "sk-epi-9e15…", policy: "weighted-chat-routing", reqs: "2,440" },
  { prefix: "sk-epi-001a…", policy: "failover-embeddings", reqs: "318" },
]

export function ApiKeysZebraTable() {
  return (
    <div style={{ maxWidth: 640 }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>API key</TableHead>
            <TableHead>Mapping policy</TableHead>
            <TableHead style={{ textAlign: "right" }}>Requests (24h)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {KEYS.map((k) => (
            <TableRow key={k.prefix}>
              <TableCell style={{ fontFamily: "monospace", fontSize: 13 }}>{k.prefix}</TableCell>
              <TableCell style={{ color: "var(--muted-foreground)" }}>{k.policy}</TableCell>
              <TableCell style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {k.reqs}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
