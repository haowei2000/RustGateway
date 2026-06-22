import { ItemList } from "llm-gateway-admin-web"
import { KeyRound } from "lucide-react"

const noop = () => {}

export function ApiKeys() {
  return (
    <div style={{ background: "var(--sidebar)", padding: 12, borderRadius: 10, width: 240 }}>
      <ItemList
        title="API Keys"
        addLabel="New API key"
        emptyText="No items found."
        isAdding={false}
        selectedItemId="ak-1"
        items={[
          {
            id: "ak-1",
            title: "Production Gateway",
            icon: KeyRound,
            eyebrow: "enabled",
            meta: "2 policies · sk-epi-a1b2",
          },
          {
            id: "ak-2",
            title: "Staging Backend",
            icon: KeyRound,
            eyebrow: "enabled",
            meta: "1 policy · sk-epi-c3d4",
          },
          {
            id: "ak-3",
            title: "Analytics Reader",
            icon: KeyRound,
            eyebrow: "disabled",
            meta: "0 policies · sk-epi-e5f6",
          },
        ]}
        onAdd={noop}
        onSelect={noop}
      />
    </div>
  )
}

export function Empty() {
  return (
    <div style={{ background: "var(--sidebar)", padding: 12, borderRadius: 10, width: 240 }}>
      <ItemList
        title="API Keys"
        addLabel="New API key"
        emptyText="No API keys yet."
        isAdding={false}
        selectedItemId=""
        items={[]}
        onAdd={noop}
        onSelect={noop}
      />
    </div>
  )
}
