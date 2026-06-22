import {
  LongItem,
  LongItemIcon,
  LongItemBody,
  LongItemTitle,
  LongItemSubtitle,
  Button,
  LongItemActions,
} from "llm-gateway-admin-web"
import { Database } from "lucide-react"

const stack: React.CSSProperties = {
  width: 520,
  display: "flex",
  flexDirection: "column",
  gap: 8,
}

export function Subtitle() {
  return (
    <div style={stack}>
      <LongItem>
        <LongItemIcon><Database className="icon-sm" aria-hidden="true" /></LongItemIcon>
        <LongItemBody>
          <LongItemTitle>OpenAI Production</LongItemTitle>
          <LongItemSubtitle>gpt-4o · gpt-4o-mini · 48,210 requests today · 0.3% errors</LongItemSubtitle>
        </LongItemBody>
        <LongItemActions>
          <Button size="sm" variant="ghost">Details</Button>
        </LongItemActions>
      </LongItem>
    </div>
  )
}
