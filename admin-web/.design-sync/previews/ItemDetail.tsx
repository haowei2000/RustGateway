import { Item, ItemIcon, ItemContent, ItemTitle, ItemDetail, ItemEyebrow, ItemMeta } from "llm-gateway-admin-web"
import { KeyRound } from "lucide-react"

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

export function PopoverDetail() {
  return (
    <div style={sidebar}>
      <Item selected>
        <ItemIcon><KeyRound className="icon-sm" aria-hidden="true" /></ItemIcon>
        <ItemContent><ItemTitle>sk-epi-a1b2</ItemTitle></ItemContent>
        <ItemDetail style={forceVisible}>
          <ItemEyebrow>enabled</ItemEyebrow>
          <ItemMeta>3 policies · sk-epi-a1b2</ItemMeta>
        </ItemDetail>
      </Item>
    </div>
  )
}
