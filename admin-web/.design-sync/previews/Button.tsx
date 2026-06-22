import { Button } from "llm-gateway-admin-web"
import { Plus, RotateCw, Trash2 } from "lucide-react"

export function Variants() {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <Button>Save changes</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  )
}

export function Sizes() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Add">
        <Plus className="icon-sm" aria-hidden="true" />
      </Button>
    </div>
  )
}

export function WithIcons() {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
      <Button>
        <Plus className="icon-sm" aria-hidden="true" />
        New API key
      </Button>
      <Button variant="outline">
        <RotateCw className="icon-sm" aria-hidden="true" />
        Rotate
      </Button>
      <Button variant="ghost">
        <Trash2 className="icon-sm" aria-hidden="true" />
        Delete
      </Button>
    </div>
  )
}

export function Disabled() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Button disabled>Disabled</Button>
      <Button variant="secondary" disabled>
        Disabled
      </Button>
    </div>
  )
}
