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

export function NavRows() {
  return (
    <div style={sidebar}>
      <Item>
        <ItemIcon><KeyRound className="icon-sm" aria-hidden="true" /></ItemIcon>
        <ItemContent><ItemTitle>sk-epi-a1b2</ItemTitle></ItemContent>
      </Item>
      <Item>
        <ItemIcon><Database className="icon-sm" aria-hidden="true" /></ItemIcon>
        <ItemContent><ItemTitle>openai-primary</ItemTitle></ItemContent>
      </Item>
      <Item>
        <ItemIcon><Shuffle className="icon-sm" aria-hidden="true" /></ItemIcon>
        <ItemContent><ItemTitle>weighted-route</ItemTitle></ItemContent>
      </Item>
    </div>
  )
}

export function Selected() {
  return (
    <div style={sidebar}>
      <Item>
        <ItemIcon><KeyRound className="icon-sm" aria-hidden="true" /></ItemIcon>
        <ItemContent><ItemTitle>sk-epi-a1b2</ItemTitle></ItemContent>
      </Item>
      <Item selected>
        <ItemIcon><Layers3 className="icon-sm" aria-hidden="true" /></ItemIcon>
        <ItemContent><ItemTitle>epichust-chat</ItemTitle></ItemContent>
      </Item>
      <Item>
        <ItemIcon><Database className="icon-sm" aria-hidden="true" /></ItemIcon>
        <ItemContent><ItemTitle>anthropic-fallback</ItemTitle></ItemContent>
      </Item>
    </div>
  )
}
