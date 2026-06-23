import { Database, KeyRound, Layers3, Plus, Shuffle, type LucideIcon } from "lucide-react"

import { useAdminData } from "@/hooks/use-admin-data"
import type { AdminData } from "@/lib/api"
import {
  NEW_SIDEBAR_ITEM_ID,
  useAdminStore,
  type SidebarResource,
} from "@/stores/admin-store"

type DotStatus = "healthy" | "enabled" | "disabled" | "none"

type ListRow = {
  id: string
  icon: LucideIcon
  title: string
  subtitle?: string
  status: DotStatus
}

const TITLES: Record<string, string> = {
  providers: "Providers",
  models: "Models",
  routes: "Routes",
  keys: "API Keys",
}

const ADD_LABELS: Record<string, string> = {
  providers: "New provider",
  models: "New model",
  routes: "New route",
  keys: "New API key",
}

function buildRows(resource: SidebarResource, data: AdminData | undefined): ListRow[] {
  if (!data) return []

  if (resource === "providers") {
    return data.providers.map((p) => ({
      id: p.id,
      icon: Database,
      title: p.provider_name,
      subtitle: `${p.provider_model_count} models · ${p.policy_count} policies`,
      status: "healthy",
    }))
  }

  if (resource === "models") {
    return data.models.map((m) => ({
      id: m.id,
      icon: Layers3,
      title: m.model_name,
      subtitle: m.model_type,
      status: "none",
    }))
  }

  if (resource === "routes") {
    return data.policies.map((p) => ({
      id: p.id,
      icon: Shuffle,
      title: p.epichust_model_name,
      subtitle: `${p.routing_strategy} · ${p.routes.length} targets`,
      status: p.enabled ? "enabled" : "disabled",
    }))
  }

  if (resource === "keys") {
    return data.apiKeys.map((k) => ({
      id: k.id,
      icon: KeyRound,
      title: k.key_name,
      subtitle: `${k.key_suffix ? `llmgw…${k.key_suffix}` : `${k.key_hash_prefix}…`} · ${k.mapping_policies.length} policies`,
      status: k.enabled ? "enabled" : "disabled",
    }))
  }

  return []
}

function ListPanel() {
  const adminData = useAdminData()
  const resource = useAdminStore((s) => s.sidebarResource)
  const selectedId = useAdminStore((s) => s.selectedSidebarItemId)
  const setSelectedId = useAdminStore((s) => s.setSelectedSidebarItemId)

  const rows = buildRows(resource, adminData.data)
  const isAdding = selectedId === NEW_SIDEBAR_ITEM_ID
  const effectiveId = isAdding ? NEW_SIDEBAR_ITEM_ID : selectedId || rows[0]?.id || ""

  return (
    <aside className="list-panel" aria-label={TITLES[resource]}>
      <header className="list-panel-head">
        <h2 className="list-panel-title">{TITLES[resource]}</h2>
        <span className="list-panel-count">{rows.length}</span>
        <button
          type="button"
          className="list-panel-add"
          aria-label={ADD_LABELS[resource]}
          title={ADD_LABELS[resource]}
          onClick={() => setSelectedId(NEW_SIDEBAR_ITEM_ID)}
        >
          <Plus className="icon-sm" aria-hidden="true" />
        </button>
      </header>

      <div className="list-panel-body scroll">
        {rows.length === 0 && !isAdding ? <p className="list-panel-empty">No items yet.</p> : null}

        {isAdding ? (
          <button type="button" className="list-row selected" aria-current="true">
            <span className="list-row-icon accent">
              <Plus className="icon-sm" aria-hidden="true" />
            </span>
            <span className="list-row-text">
              <span className="list-row-title">{ADD_LABELS[resource]}</span>
              <span className="list-row-sub">Unsaved draft</span>
            </span>
          </button>
        ) : null}

        {rows.map((row) => {
          const Icon = row.icon
          const selected = !isAdding && row.id === effectiveId
          return (
            <button
              key={row.id}
              type="button"
              className={`list-row${selected ? " selected" : ""}`}
              aria-current={selected ? "true" : undefined}
              onClick={() => setSelectedId(row.id)}
            >
              <span className={`list-row-icon${selected ? " accent" : ""}`}>
                <Icon className="icon-sm" aria-hidden="true" />
              </span>
              <span className="list-row-text">
                <span className="list-row-title">{row.title}</span>
                {row.subtitle ? <span className="list-row-sub">{row.subtitle}</span> : null}
              </span>
              {row.status !== "none" ? <span className={`status-dot ${row.status}`} /> : null}
            </button>
          )
        })}
      </div>
    </aside>
  )
}

export { ListPanel }
