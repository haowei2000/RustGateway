import {
  LongItem,
  LongItemIcon,
  LongItemBody,
  LongItemTitle,
  LongItemSubtitle,
  LongItemActions,
  Button,
} from "llm-gateway-admin-web"
import { KeyRound } from "lucide-react"

const stack: React.CSSProperties = {
  width: 520,
  display: "flex",
  flexDirection: "column",
  gap: 8,
}

export function TextBlock() {
  return (
    <div style={stack}>
      <LongItem>
        <LongItemIcon><KeyRound className="icon-sm" aria-hidden="true" /></LongItemIcon>
        <LongItemBody>
          <LongItemTitle>sk-epi-prod-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6</LongItemTitle>
          <LongItemSubtitle>Last used 4 minutes ago · bound to epichust-chat</LongItemSubtitle>
        </LongItemBody>
        <LongItemActions>
          <Button size="sm" variant="ghost">Manage</Button>
        </LongItemActions>
      </LongItem>
    </div>
  )
}
