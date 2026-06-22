import {
  LongItem,
  LongItemIcon,
  LongItemBody,
  LongItemTitle,
  LongItemSubtitle,
  Button,
  LongItemActions,
} from "llm-gateway-admin-web"
import { Layers3 } from "lucide-react"

const stack: React.CSSProperties = {
  width: 520,
  display: "flex",
  flexDirection: "column",
  gap: 8,
}

export function Title() {
  return (
    <div style={stack}>
      <LongItem>
        <LongItemIcon><Layers3 className="icon-sm" aria-hidden="true" /></LongItemIcon>
        <LongItemBody>
          <LongItemTitle>epichust-chat</LongItemTitle>
          <LongItemSubtitle>Business model · weighted routing</LongItemSubtitle>
        </LongItemBody>
        <LongItemActions>
          <Button size="sm" variant="ghost">Edit</Button>
        </LongItemActions>
      </LongItem>
    </div>
  )
}
