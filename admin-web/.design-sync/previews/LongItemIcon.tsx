import {
  LongItem,
  LongItemIcon,
  LongItemBody,
  LongItemTitle,
  LongItemSubtitle,
} from "llm-gateway-admin-web"
import { KeyRound, Database, Layers3 } from "lucide-react"

const stack: React.CSSProperties = {
  width: 520,
  display: "flex",
  flexDirection: "column",
  gap: 8,
}

export function LeadingIcons() {
  return (
    <div style={stack}>
      <LongItem>
        <LongItemIcon><KeyRound className="icon-sm" aria-hidden="true" /></LongItemIcon>
        <LongItemBody>
          <LongItemTitle>API key · sk-epi-a1b2</LongItemTitle>
          <LongItemSubtitle>Client credential · SHA-256 hashed</LongItemSubtitle>
        </LongItemBody>
      </LongItem>
      <LongItem>
        <LongItemIcon><Database className="icon-sm" aria-hidden="true" /></LongItemIcon>
        <LongItemBody>
          <LongItemTitle>Provider · OpenAI Production</LongItemTitle>
          <LongItemSubtitle>Upstream API · 12 models</LongItemSubtitle>
        </LongItemBody>
      </LongItem>
      <LongItem>
        <LongItemIcon><Layers3 className="icon-sm" aria-hidden="true" /></LongItemIcon>
        <LongItemBody>
          <LongItemTitle>Model · epichust-chat</LongItemTitle>
          <LongItemSubtitle>Business model · weighted routing</LongItemSubtitle>
        </LongItemBody>
      </LongItem>
    </div>
  )
}
