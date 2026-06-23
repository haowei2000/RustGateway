import type { CSSProperties } from "react"
import { Activity, AlertTriangle, Gauge, KeyRound, RotateCw, ScrollText, type LucideIcon } from "lucide-react"

import { useAdminData } from "@/hooks/use-admin-data"
import type { AdminData, AuditLogEntry } from "@/lib/api"

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx]
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "—"
  const s = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

const HOUR = 3600_000

/** Count audit logs into N hourly buckets ending now (oldest first). */
function hourlyBuckets(logs: AuditLogEntry[], buckets: number): number[] {
  const now = Date.now()
  const out = new Array(buckets).fill(0)
  for (const log of logs) {
    const t = new Date(log.created_at).getTime()
    if (Number.isNaN(t)) continue
    const hoursAgo = Math.floor((now - t) / HOUR)
    if (hoursAgo < 0 || hoursAgo >= buckets) continue
    out[buckets - 1 - hoursAgo] += 1
  }
  return out
}

type Stat = {
  id: string
  label: string
  value: string
  sub: string
  icon: LucideIcon
  spark: number[]
  accent: string
}

function computeStats(data: AdminData): Stat[] {
  const logs = data.auditLogs
  const now = Date.now()
  const last24 = logs.filter((l) => now - new Date(l.created_at).getTime() <= 24 * HOUR)
  const latencies = last24.map((l) => l.latency_ms).filter((n) => Number.isFinite(n))
  const errors = last24.filter((l) => l.status_code >= 400).length
  const errRate = last24.length ? (errors / last24.length) * 100 : 0
  const enabledKeys = data.apiKeys.filter((k) => k.enabled).length

  return [
    {
      id: "req",
      label: "Requests · 24h",
      value: last24.length.toLocaleString(),
      sub: `${logs.length.toLocaleString()} total logged`,
      icon: Activity,
      spark: hourlyBuckets(last24, 12),
      accent: "var(--ix)",
    },
    {
      id: "lat",
      label: "p95 latency",
      value: latencies.length ? `${percentile(latencies, 95)} ms` : "—",
      sub: latencies.length ? `${Math.round(percentile(latencies, 50))} ms median` : "no traffic",
      icon: Gauge,
      spark: [],
      accent: "var(--ix)",
    },
    {
      id: "err",
      label: "Error rate",
      value: `${errRate.toFixed(2)}%`,
      sub: `${errors} failed of ${last24.length}`,
      icon: AlertTriangle,
      spark: [],
      accent: errRate > 1 ? "#EE2B47" : "#1f9d57",
    },
    {
      id: "keys",
      label: "Active keys",
      value: enabledKeys.toLocaleString(),
      sub: `${data.apiKeys.length} total`,
      icon: KeyRound,
      spark: [],
      accent: "var(--ix)",
    },
  ]
}

function StatCard({ stat }: { stat: Stat }) {
  const Icon = stat.icon
  const max = Math.max(1, ...stat.spark)
  return (
    <div className="stat-card">
      <div className="stat-card-head">
        <Icon className="icon-sm stat-card-icon" aria-hidden="true" />
        <span className="stat-card-label">{stat.label}</span>
      </div>
      <div className="stat-card-value tnum">{stat.value}</div>
      <div className="stat-card-foot">
        <span className="stat-card-sub">{stat.sub}</span>
        {stat.spark.length ? (
          <span className="spark" style={{ "--spark-accent": stat.accent } as CSSProperties}>
            {stat.spark.map((v, i) => (
              <i key={i} style={{ height: `${(v / max) * 100}%` }} />
            ))}
          </span>
        ) : null}
      </div>
    </div>
  )
}

type ProviderMix = { id: string; name: string; share: number; p95: number; errRate: number; count: number }

function computeProviderMix(data: AdminData): ProviderMix[] {
  const total = data.auditLogs.length || 1
  return data.providers
    .map((p) => {
      const rows = data.auditLogs.filter((l) => l.provider_id === p.id)
      const latencies = rows.map((l) => l.latency_ms).filter((n) => Number.isFinite(n))
      const errs = rows.filter((l) => l.status_code >= 400).length
      return {
        id: p.id,
        name: p.provider_name,
        share: Math.round((rows.length / total) * 100),
        p95: latencies.length ? percentile(latencies, 95) : 0,
        errRate: rows.length ? (errs / rows.length) * 100 : 0,
        count: rows.length,
      }
    })
    .sort((a, b) => b.count - a.count)
}

function DashboardPage() {
  const adminData = useAdminData()
  const data = adminData.data

  if (!data) {
    return (
      <div className="console-screen">
        <p className="resource-empty">
          {adminData.isError
            ? "Failed to load admin data. Check whether `admin-api` is running on port 9000."
            : "Loading dashboard…"}
        </p>
      </div>
    )
  }

  const stats = computeStats(data)
  const volume = hourlyBuckets(data.auditLogs, 24)
  const volumeMax = Math.max(1, ...volume)
  const mix = computeProviderMix(data)
  const recent = [...data.auditLogs]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
  const hasErrors = stats.find((s) => s.id === "err")?.value !== "0.00%"

  return (
    <div className="console-screen fade-in">
      <header className="console-head">
        <h1 className="console-head-title">Overview</h1>
        <span className="console-head-status">
          <span className={`status-dot ${hasErrors ? "enabled" : "healthy"}`} />
          {data.auditLogs.length ? "All systems operational" : "No traffic yet"}
        </span>
        <div className="console-head-actions">
          <span className="console-head-meta">Last 24h</span>
          <button
            type="button"
            className="ibtn"
            title="Refresh"
            aria-label="Refresh"
            onClick={() => adminData.refetch()}
          >
            <RotateCw className={`icon-sm ${adminData.isFetching ? "refresh-icon-busy" : ""}`} />
          </button>
        </div>
      </header>

      <div className="console-body scroll">
        <div className="stat-grid">
          {stats.map((s) => (
            <StatCard key={s.id} stat={s} />
          ))}
        </div>

        <div className="dash-split">
          <section className="panel">
            <div className="panel-head">
              <h3 className="panel-title">Request volume</h3>
              <span className="panel-sub">last 24 hours · req/h</span>
            </div>
            <div className="bars">
              {volume.map((v, i) => (
                <span key={i} className="bar-wrap" title={`${v} req`}>
                  <span className="bar" style={{ height: `${(v / volumeMax) * 100}%` }} />
                </span>
              ))}
            </div>
          </section>

          <section className="panel">
            <h3 className="panel-title">Provider mix</h3>
            <div className="mix-list">
              {mix.length === 0 ? <p className="resource-empty">No providers.</p> : null}
              {mix.map((p) => (
                <div key={p.id} className="mix-row">
                  <div className="mix-row-head">
                    <span className="mix-row-name">
                      <span className={`status-dot ${p.count ? "healthy" : "disabled"}`} /> {p.name}
                    </span>
                    <span className="tnum mix-row-share">{p.share}%</span>
                  </div>
                  <div className="meter">
                    <div className="meter-fill" style={{ width: `${p.share}%`, opacity: p.count ? 1 : 0.35 }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="dash-split even">
          <section className="panel">
            <h3 className="panel-title">Recent activity</h3>
            {recent.length === 0 ? <p className="resource-empty">No requests recorded.</p> : null}
            {recent.map((log) => (
              <div key={log.request_id} className="feed-row">
                <ScrollText className="icon-sm feed-icon" aria-hidden="true" />
                <span className="feed-text">
                  <b>{log.epichust_model_name ?? "unknown model"}</b>{" "}
                  <span className="muted">· {log.status_code}</span>
                </span>
                <span className="tnum feed-time">{timeAgo(log.created_at)}</span>
              </div>
            ))}
          </section>

          <section className="panel">
            <h3 className="panel-title">Upstream health</h3>
            {mix.length === 0 ? <p className="resource-empty">No providers.</p> : null}
            {mix.map((p) => (
              <div key={p.id} className="feed-row">
                <span className={`status-dot ${p.count ? "healthy" : "disabled"}`} />
                <span className="feed-text">{p.name}</span>
                <span className="tnum feed-metric">{p.count ? `${p.p95} ms` : "—"}</span>
                <span className={`tnum feed-metric ${p.errRate > 1 ? "danger" : "muted"}`}>
                  {p.count ? `${p.errRate.toFixed(1)}%` : "—"}
                </span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}

export { DashboardPage }
