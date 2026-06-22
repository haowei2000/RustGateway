import { Item, ItemIcon, ItemContent, ItemTitle } from "llm-gateway-admin-web"
import { KeyRound, Database } from "lucide-react"

const sidebar: React.CSSProperties = {
  background: "var(--sidebar)",
  padding: 12,
  borderRadius: 10,
  width: 240,
  display: "flex",
  flexDirection: "column",
  gap: 2,
}

export function TruncatingContent() {
  return (
    <div style={sidebar}>
      <Item>
        <ItemIcon><KeyRound className="icon-sm" aria-hidden="true" /></ItemIcon>
        <ItemContent><ItemTitle>sk-epi-a1b2c3d4</ItemTitle></ItemContent>
      </Item>
      <Item selected>
        <ItemIcon><Database className="icon-sm" aria-hidden="true" /></ItemIcon>
        <ItemContent><ItemTitle>openai-primary-us-east-failover</ItemTitle></ItemContent>
      </Item>
    </div>
  )
}
