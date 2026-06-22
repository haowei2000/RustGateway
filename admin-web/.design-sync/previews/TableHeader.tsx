import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "llm-gateway-admin-web"

const PROVIDERS = [
  { name: "OpenAI Production", region: "us-east", models: 12, ref: "openai-prod-01" },
  { name: "Anthropic", region: "us-west", models: 8, ref: "anthropic-prod-01" },
  { name: "Self-hosted vLLM", region: "eu-central", models: 3, ref: "vllm-internal-01" },
]

export function ProvidersHeaderTable() {
  return (
    <div style={{ maxWidth: 640 }}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Provider</TableHead>
            <TableHead>Region</TableHead>
            <TableHead>Models</TableHead>
            <TableHead>Key ref</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {PROVIDERS.map((p) => (
            <TableRow key={p.name}>
              <TableCell style={{ fontWeight: 600 }}>{p.name}</TableCell>
              <TableCell style={{ color: "var(--muted-foreground)" }}>{p.region}</TableCell>
              <TableCell>{p.models}</TableCell>
              <TableCell style={{ fontFamily: "monospace", fontSize: 13 }}>{p.ref}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
