import {
  Database,
  Gauge,
  KeyRound,
  Layers3,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  Shuffle,
  type LucideIcon,
} from "lucide-react"

import { useAdminStore, type SidebarResource } from "@/stores/admin-store"

type NavItem = { id: SidebarResource; label: string; icon: LucideIcon }

const NAV: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "providers", label: "Providers", icon: Database },
  { id: "models", label: "Models", icon: Layers3 },
  { id: "routes", label: "Routes", icon: Shuffle },
  { id: "keys", label: "API Keys", icon: KeyRound },
  { id: "audit", label: "Audit", icon: ScrollText },
]

function NavButton({
  item,
  active,
  expanded,
  onClick,
}: {
  item: NavItem
  active: boolean
  expanded: boolean
  onClick: () => void
}) {
  const Icon = item.icon
  return (
    <button
      type="button"
      className={`rail-btn${active ? " active" : ""}${expanded ? " expanded" : ""}`}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      title={expanded ? undefined : item.label}
      onClick={onClick}
    >
      {active ? <span className="rail-btn-marker" /> : null}
      <Icon className="rail-btn-icon" aria-hidden="true" />
      {expanded ? <span className="rail-btn-label">{item.label}</span> : null}
    </button>
  )
}

function IconRail() {
  const sidebarResource = useAdminStore((s) => s.sidebarResource)
  const setSidebarResource = useAdminStore((s) => s.setSidebarResource)
  const expanded = useAdminStore((s) => s.navExpanded)
  const setNavExpanded = useAdminStore((s) => s.setNavExpanded)

  return (
    <nav className={`icon-rail${expanded ? " expanded" : ""}`} aria-label="Primary">
      <div className="rail-brand">
        <span className="rail-logo">
          <Shuffle className="rail-btn-icon" aria-hidden="true" />
        </span>
        {expanded ? (
          <div className="rail-brand-text">
            <div className="rail-brand-title">EpicHust</div>
            <div className="rail-brand-sub">LLM Gateway</div>
          </div>
        ) : null}
      </div>

      <div className="rail-nav">
        {NAV.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            active={sidebarResource === item.id}
            expanded={expanded}
            onClick={() => setSidebarResource(item.id)}
          />
        ))}
      </div>

      <div className="rail-footer">
        <button
          type="button"
          className={`rail-btn${expanded ? " expanded" : ""}`}
          aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
          title={expanded ? undefined : "Expand"}
          onClick={() => setNavExpanded(!expanded)}
        >
          {expanded ? (
            <PanelLeftClose className="rail-btn-icon" aria-hidden="true" />
          ) : (
            <PanelLeftOpen className="rail-btn-icon" aria-hidden="true" />
          )}
          {expanded ? <span className="rail-btn-label">Collapse</span> : null}
        </button>

        <div className={`rail-user${expanded ? " expanded" : ""}`} title={expanded ? undefined : "li.wei · Admin"}>
          <span className="rail-avatar">LW</span>
          {expanded ? (
            <div className="rail-brand-text">
              <div className="rail-user-name">li.wei</div>
              <div className="rail-brand-sub">Admin</div>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  )
}

export { IconRail }
