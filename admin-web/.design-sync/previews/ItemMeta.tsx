import { Item, ItemIcon, ItemContent, ItemTitle, ItemDetail, ItemEyebrow, ItemMeta } from "llm-gateway-admin-web"
import { Shuffle } from "lucide-react"

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

export function Meta() {
  return (
    <div style={sidebar}>
      <Item selected>
        <ItemIcon><Shuffle className="icon-sm" aria-hidden="true" /></ItemIcon>
        <ItemContent><ItemTitle>weighted-route</ItemTitle></ItemContent>
        <ItemDetail style={forceVisible}>
          <ItemEyebrow>weighted</ItemEyebrow>
          <ItemMeta>2 routes · 100 req/min</ItemMeta>
        </ItemDetail>
      </Item>
    </div>
  )
}
