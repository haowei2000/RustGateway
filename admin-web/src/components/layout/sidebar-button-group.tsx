import { Database, KeyRound, Layers3, Shuffle, type LucideIcon } from "lucide-react"

import type { SidebarResource } from "@/stores/admin-store"
import { useAdminStore } from "@/stores/admin-store"

const resourceOptions: Array<{ icon: LucideIcon; label: string; resource: SidebarResource; className: string }> = [
  { resource: "keys", label: "API Key", icon: KeyRound, className: "sidebar-group-btn-keys" },
  { resource: "providers", label: "Provider", icon: Database, className: "sidebar-group-btn-providers" },
  { resource: "models", label: "Model", icon: Layers3, className: "sidebar-group-btn-models" },
  { resource: "policies", label: "Policy", icon: Shuffle, className: "sidebar-group-btn-policies" },
]

function SidebarButtonGroup() {
  const sidebarResource = useAdminStore((state) => state.sidebarResource)
  const setSidebarResource = useAdminStore((state) => state.setSidebarResource)

  return (
    <div className="sidebar-button-group" role="group" aria-label="Sidebar resource type">
      {resourceOptions.map((item) => {
        const Icon = item.icon
        const isActive = sidebarResource === item.resource

        return (
          <button
            key={item.resource}
            aria-label={item.label}
            aria-pressed={isActive}
            className={isActive ? `sidebar-group-button active ${item.className}` : "sidebar-group-button"}
            type="button"
            onClick={() => setSidebarResource(item.resource)}
          >
            <Icon className="icon-sm" aria-hidden="true" />
            <span className="sidebar-group-label">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export { SidebarButtonGroup }
