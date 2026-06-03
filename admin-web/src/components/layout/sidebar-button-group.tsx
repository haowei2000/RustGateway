import { Database, KeyRound, Layers3, type LucideIcon } from "lucide-react"

import type { SidebarResource } from "@/stores/admin-store"
import { useAdminStore } from "@/stores/admin-store"

const resourceOptions: Array<{ icon: LucideIcon; label: string; resource: SidebarResource }> = [
  { resource: "keys", label: "API Key", icon: KeyRound },
  { resource: "providers", label: "Provider", icon: Database },
  { resource: "models", label: "Model", icon: Layers3 },
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
            className={isActive ? "sidebar-group-button active" : "sidebar-group-button"}
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
