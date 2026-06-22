import {
  LongItem,
  LongItemIcon,
  LongItemBody,
  LongItemTitle,
  LongItemSubtitle,
  LongItemActions,
  Button,
  Badge,
} from "llm-gateway-admin-web"
import { KeyRound, RotateCw, Trash2 } from "lucide-react"

const stack: React.CSSProperties = {
  width: 520,
  display: "flex",
  flexDirection: "column",
  gap: 8,
}

export function GhostActions() {
  return (
    <div style={stack}>
      <LongItem>
        <LongItemIcon><KeyRound className="icon-sm" aria-hidden="true" /></LongItemIcon>
        <LongItemBody>
          <LongItemTitle>sk-epi-a1b2</LongItemTitle>
          <LongItemSubtitle>Created Apr 12 · last used 4m ago</LongItemSubtitle>
        </LongItemBody>
        <LongItemActions>
          <Button size="sm" variant="ghost">
            <RotateCw className="icon-sm" aria-hidden="true" />
            Rotate
          </Button>
          <Button size="sm" variant="ghost">
            <Trash2 className="icon-sm" aria-hidden="true" />
            Delete
          </Button>
        </LongItemActions>
      </LongItem>
    </div>
  )
}

export function BadgeAndButton() {
  return (
    <div style={stack}>
      <LongItem>
        <LongItemIcon><KeyRound className="icon-sm" aria-hidden="true" /></LongItemIcon>
        <LongItemBody>
          <LongItemTitle>sk-epi-prod-9f3c</LongItemTitle>
          <LongItemSubtitle>Bound to epichust-chat · 2 policies</LongItemSubtitle>
        </LongItemBody>
        <LongItemActions>
          <Badge variant="success">enabled</Badge>
          <Button size="sm" variant="ghost">Manage</Button>
        </LongItemActions>
      </LongItem>
    </div>
  )
}
