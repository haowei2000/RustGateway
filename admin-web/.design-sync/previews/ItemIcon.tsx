import { Item, ItemIcon, ItemContent, ItemTitle } from "llm-gateway-admin-web"
import { KeyRound, Database, Layers3, Shuffle } from "lucide-react"

const sidebar: React.CSSProperties = {
  background: "var(--sidebar)",
  padding: 12,
  borderRadius: 10,
  width: 240,
  display: "flex",
  flexDirection: "column",
  gap: 2,
}

export function Icons() {
  return (
    <div style={sidebar}>
      <Item>
        <ItemIcon><KeyRound className="icon-sm" aria-hidden="true" /></ItemIcon>
        <ItemContent><ItemTitle>API keys</ItemTitle></ItemContent>
      </Item>
      <Item>
        <ItemIcon><Database className="icon-sm" aria-hidden="true" /></ItemIcon>
        <ItemContent><ItemTitle>Providers</ItemTitle></ItemContent>
      </Item>
      <Item>
        <ItemIcon><Layers3 className="icon-sm" aria-hidden="true" /></ItemIcon>
        <ItemContent><ItemTitle>Models</ItemTitle></ItemContent>
      </Item>
      <Item>
        <ItemIcon><Shuffle className="icon-sm" aria-hidden="true" /></ItemIcon>
        <ItemContent><ItemTitle>Policies</ItemTitle></ItemContent>
      </Item>
    </div>
  )
}
