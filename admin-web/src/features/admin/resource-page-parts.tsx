import type { ReactNode } from "react"
import { RefreshCw, type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ResourcePageFrameProps = {
  children: ReactNode
  variant?: "key" | "provider" | "model"
}

function ResourcePageFrame({ children, variant }: ResourcePageFrameProps) {
  return <div className={variant ? `resource-page resource-page-${variant}` : "resource-page"}>{children}</div>
}

type ResourcePageHeaderProps = {
  description: string
  icon: LucideIcon
  isFetching: boolean
  status?: string
  title: string
  onRefresh: () => void
}

function ResourcePageHeader({
  description,
  icon: Icon,
  isFetching,
  status,
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
                {status ? <Badge variant={status === "enabled" ? "success" : "secondary"}>{status}</Badge> : null}
              </div>
              <p className="resource-description">{description}</p>
            </div>
          </div>

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
  title: string
}

function ResourceCard({ children, className = "", title }: ResourceCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="resource-card-header">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="resource-card-content">{children}</CardContent>
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
}
