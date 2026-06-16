import { Children, useState, type ReactNode } from "react"
import { ChevronDown, Plus, RefreshCw, type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Item, ItemContent, ItemDetail, ItemIcon, ItemMeta, ItemTitle } from "@/components/ui/item"

type ResourcePageFrameProps = {
  children: ReactNode
  variant?: "key" | "provider" | "model" | "policy"
}

function ResourcePageFrame({ children, variant }: ResourcePageFrameProps) {
  return <div className={variant ? `resource-page resource-page-${variant}` : "resource-page"}>{children}</div>
}

type ResourcePageHeaderProps = {
  actions?: ReactNode
  description: string
  icon: LucideIcon
  isFetching: boolean
  status?: string
  statusVariant?: "success" | "secondary" | "outline" | "default" | "warning"
  title: string
  onRefresh: () => void
}

function ResourcePageHeader({
  actions,
  description,
  icon: Icon,
  isFetching,
  status,
  statusVariant = "secondary",
  title,
  onRefresh,
}: ResourcePageHeaderProps) {
  return (
    <Card className="resource-header-card">
      <CardHeader className="resource-header-card-inner">
        <div className="resource-header">
          <div className="resource-identity">
            <div className="resource-icon-box">
              <Icon className="icon-md" aria-hidden="true" />
            </div>
            <div className="resource-title-group">
              <div className="resource-title-row">
                <CardTitle className="resource-title">{title}</CardTitle>
                {status ? <Badge variant={status === "enabled" ? "success" : statusVariant}>{status}</Badge> : null}
              </div>
              <p className="resource-description">{description}</p>
            </div>
          </div>

          <div className="resource-header-actions">
            {actions}
            <Button
              className="resource-refresh-button"
              disabled={isFetching}
              size="sm"
              type="button"
              variant="outline"
              onClick={onRefresh}
            >
              <RefreshCw
                className={`icon-sm ${isFetching ? "refresh-icon-busy" : ""}`}
                aria-hidden="true"
              />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

type ResourceMetric = {
  label: string
  value: number | string
}

function ResourceMetrics({ metrics }: { metrics: ResourceMetric[] }) {
  return (
    <dl className="resource-metric-grid">
      {metrics.map((metric) => (
        <div key={metric.label} className="resource-metric">
          <dt className="resource-metric-label">{metric.label}</dt>
          <dd className="resource-metric-value">{metric.value}</dd>
        </div>
      ))}
    </dl>
  )
}

type ResourceCardProps = {
  children: ReactNode
  className?: string
  collapsible?: boolean
  defaultOpen?: boolean
  title: string
}

function ResourceCard({ children, className = "", collapsible = true, defaultOpen = true, title }: ResourceCardProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card className={className}>
      <CardHeader
        className={`resource-card-header ${collapsible ? "cursor-pointer select-none" : ""}`}
        onClick={collapsible ? () => setOpen((v) => !v) : undefined}
      >
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {collapsible ? (
            <ChevronDown
              className={`icon-sm shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
            />
          ) : null}
        </div>
      </CardHeader>
      {open ? <CardContent className="resource-card-content">{children}</CardContent> : null}
    </Card>
  )
}

type ResourceSectionHeaderProps = {
  actions?: ReactNode
  title: string
}

function ResourceSectionHeader({ actions, title }: ResourceSectionHeaderProps) {
  return (
    <div className="resource-section-header">
      <h3 className="resource-section-title">{title}</h3>
      {actions ? <div className="resource-section-actions">{actions}</div> : null}
    </div>
  )
}

function ResourceActions({ children }: { children: ReactNode }) {
  return <div className="resource-actions">{children}</div>
}

function ResourceNotice({ children }: { children: ReactNode }) {
  return <p className="resource-note">{children}</p>
}

function EmptyResourcePage({ message }: { message: string }) {
  return (
    <ResourcePageFrame>
      <p className="resource-empty">{message}</p>
    </ResourcePageFrame>
  )
}

function EmptyBlock({ children }: { children: ReactNode }) {
  return <p className="resource-empty">{children}</p>
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="resource-readonly-field">
      <span className="resource-readonly-label">{label}</span>
      <code className="resource-readonly-value">{value}</code>
    </div>
  )
}

type DangerActionProps = {
  action: ReactNode
  badge?: string
  description: string
  title: string
}

function DangerAction({ action, badge, description, title }: DangerActionProps) {
  return (
    <section className="resource-danger-zone">
      <div className="resource-danger-copy">
        <div className="resource-danger-title-row">
          <h3 className="resource-section-title">{title}</h3>
          {badge ? <Badge variant="destructive">{badge}</Badge> : null}
        </div>
        <p className="resource-danger-text">{description}</p>
      </div>
      {action}
    </section>
  )
}

// ── Sub-item list (child items under a parent resource) ────────────

type SubItemListProps = {
  addLabel?: string
  children: ReactNode
  footer?: ReactNode
  onAdd?: () => void
  title: string
}

function SubItemList({ addLabel, children, footer, onAdd, title }: SubItemListProps) {
  const hasChildren = Children.count(children) > 0

  return (
    <section className="item-list sub-item-list">
      <div className="item-list-header">
        <div className="item-list-title-group">
          <h2 className="item-list-title !text-foreground">{title}</h2>
        </div>
        {addLabel && onAdd ? (
          <button className="item-list-add-button" type="button" onClick={onAdd}>
            <Plus className="icon-sm" />
            <span className="item-list-add-label">{addLabel}</span>
          </button>
        ) : null}
      </div>
      <div className="sub-item-body">
        {hasChildren ? (
          <div className="item-list-body">{children}</div>
        ) : null}
      </div>
      {footer ? <div className="resource-config-footer">{footer}</div> : null}
    </section>
  )
}

type SubItemRowBadge = {
  text: string
  variant: "default" | "secondary" | "destructive" | "success" | "warning" | "outline"
}

type SubItemRowProps = {
  actions?: ReactNode
  badge?: SubItemRowBadge
  icon: LucideIcon
  onClick?: () => void
  subtitle?: string
  title: string
}

function SubItemRow({ actions, badge, icon: Icon, onClick, subtitle, title }: SubItemRowProps) {
  return (
    <Item onClick={onClick}>
      <ItemIcon>
        <Icon className="icon-sm opacity-60" />
      </ItemIcon>
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
      </ItemContent>
      {subtitle ? (
        <ItemDetail>
          <ItemMeta>{subtitle}</ItemMeta>
        </ItemDetail>
      ) : null}
      {badge ? <Badge variant={badge.variant}>{badge.text}</Badge> : null}
      {actions}
    </Item>
  )
}

export {
  DangerAction,
  EmptyBlock,
  EmptyResourcePage,
  ReadOnlyField,
  ResourceActions,
  ResourceCard,
  ResourceMetrics,
  ResourceNotice,
  ResourcePageFrame,
  ResourcePageHeader,
  ResourceSectionHeader,
  SubItemList,
  SubItemRow,
}
