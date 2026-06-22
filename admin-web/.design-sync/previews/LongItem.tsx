import {
  LongItem,
  LongItemIcon,
  LongItemBody,
  LongItemTitle,
  LongItemSubtitle,
  LongItemActions,
  Button,
} from "llm-gateway-admin-web"
import { Database, RotateCw, Trash2 } from "lucide-react"

const stack: React.CSSProperties = {
  width: 520,
  display: "flex",
  flexDirection: "column",
  gap: 8,
}

export function ProviderList() {
  return (
    <div style={stack}>
      <LongItem>
        <LongItemIcon><Database className="icon-sm" aria-hidden="true" /></LongItemIcon>
        <LongItemBody>
          <LongItemTitle>OpenAI Production</LongItemTitle>
          <LongItemSubtitle>12 models · 3 policies</LongItemSubtitle>
        </LongItemBody>
        <LongItemActions>
          <Button size="sm" variant="ghost" aria-label="Rotate key">
            <RotateCw className="icon-sm" aria-hidden="true" />
          </Button>
          <Button size="sm" variant="ghost" aria-label="Delete provider">
            <Trash2 className="icon-sm" aria-hidden="true" />
          </Button>
        </LongItemActions>
      </LongItem>
      <LongItem>
        <LongItemIcon><Database className="icon-sm" aria-hidden="true" /></LongItemIcon>
        <LongItemBody>
          <LongItemTitle>Anthropic Fallback</LongItemTitle>
          <LongItemSubtitle>8 models · 2 policies</LongItemSubtitle>
        </LongItemBody>
        <LongItemActions>
          <Button size="sm" variant="ghost" aria-label="Rotate key">
            <RotateCw className="icon-sm" aria-hidden="true" />
          </Button>
          <Button size="sm" variant="ghost" aria-label="Delete provider">
            <Trash2 className="icon-sm" aria-hidden="true" />
          </Button>
        </LongItemActions>
      </LongItem>
      <LongItem>
        <LongItemIcon><Database className="icon-sm" aria-hidden="true" /></LongItemIcon>
        <LongItemBody>
          <LongItemTitle>Azure OpenAI EU</LongItemTitle>
          <LongItemSubtitle>5 models · 1 policy</LongItemSubtitle>
        </LongItemBody>
        <LongItemActions>
          <Button size="sm" variant="ghost" aria-label="Rotate key">
            <RotateCw className="icon-sm" aria-hidden="true" />
          </Button>
          <Button size="sm" variant="ghost" aria-label="Delete provider">
            <Trash2 className="icon-sm" aria-hidden="true" />
          </Button>
        </LongItemActions>
      </LongItem>
    </div>
  )
}
