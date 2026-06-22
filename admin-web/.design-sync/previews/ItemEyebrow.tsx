import { Item, ItemIcon, ItemContent, ItemTitle, ItemDetail, ItemEyebrow, ItemMeta } from "llm-gateway-admin-web"
import { Database } from "lucide-react"

const sidebar: React.CSSProperties = {
  position: "relative",
  background: "var(--sidebar)",
  paddingTop: 36,
  paddingBottom: 36,
  paddingLeft: 12,
  paddingRight: 150,
  borderRadius: 10,
  width: 360,
  display: "flex",
  flexDirection: "column",
  gap: 2,
}

const forceVisible: React.CSSProperties = {
  opacity: 1,
  transform: "translateX(0) translateY(-50%)",
}

export function Eyebrow() {
  return (
    <div style={sidebar}>
      <Item selected>
        <ItemIcon><Database className="icon-sm" aria-hidden="true" /></ItemIcon>
        <ItemContent><ItemTitle>openai-primary</ItemTitle></ItemContent>
        <ItemDetail style={forceVisible}>
          <ItemEyebrow>enabled</ItemEyebrow>
          <ItemMeta>gpt-4o · 12 models</ItemMeta>
        </ItemDetail>
      </Item>
    </div>
  )
}
