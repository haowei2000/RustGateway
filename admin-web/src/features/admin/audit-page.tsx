import { useMemo, useState, type ReactNode } from "react"
import { RotateCw, X } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAdminData } from "@/hooks/use-admin-data"
import type { AdminData, AuditLogEntry } from "@/lib/api"

function statusColor(code: number): string {
  if (code >= 500) return "#EE2B47"
  if (code === 429 || (code >= 400 && code < 500)) return "#c98a12"
  return "#1f9d57"
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function useLookups(data: AdminData | undefined) {
  return useMemo(() => {
    const keyById = new Map((data?.apiKeys ?? []).map((k) => [k.id, k.key_name]))
    const providerById = new Map((data?.providers ?? []).map((p) => [p.id, p.provider_name]))
    return { keyById, providerById }
  }, [data])
}

function Field({ label, mono, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <label className="drawer-field">
      <span className="drawer-field-label">{label}</span>
      <span className={`drawer-field-value${mono ? " mono" : ""}`}>{children}</span>
    </label>
  )
}

function AuditDrawer({
  log,
  data,
  onClose,
}: {
  log: AuditLogEntry
  data: AdminData
  onClose: () => void
}) {
  const { keyById, providerById } = useLookups(data)
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer scroll" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <span
            className="drawer-status tnum"
            style={{ color: statusColor(log.status_code) }}
          >
            <span className="status-dot" style={{ background: statusColor(log.status_code) }} />
            {log.status_code}
          </span>
          <h2 className="drawer-title">{log.method} {log.path}</h2>
          <button type="button" className="ibtn" aria-label="Close" title="Close" onClick={onClose}>
            <X className="icon-sm" />
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-row">
            <Field label="Model">{log.epichust_model_name ?? "—"}</Field>
            <Field label="Timestamp">{formatTime(log.created_at)}</Field>
          </div>
          <div className="drawer-row">
            <Field label="API key">{log.api_key_id ? keyById.get(log.api_key_id) ?? log.api_key_id : "—"}</Field>
            <Field label="Latency">{log.latency_ms} ms</Field>
          </div>
          <div className="drawer-row">
            <Field label="Upstream provider">
              {log.provider_id ? providerById.get(log.provider_id) ?? log.provider_id : "—"}
            </Field>
            <Field label="Upstream model" mono>{log.provider_model_name ?? "—"}</Field>
          </div>
          <Field label="Total tokens">{log.total_tokens != null ? log.total_tokens.toLocaleString() : "—"}</Field>
          <Field label="Request ID" mono>{log.request_id}</Field>
        </div>
      </div>
    </div>
  )
}

function AuditPage() {
  const adminData = useAdminData()
  const data = adminData.data
  const [open, setOpen] = useState<AuditLogEntry | null>(null)

  const rows = useMemo(() => {
    if (!data) return []
    return [...data.auditLogs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
  }, [data])
  const { keyById, providerById } = useLookups(data)

  if (!data) {
    return (
      <div className="console-screen">
        <p className="resource-empty">
          {adminData.isError
            ? "Failed to load admin data. Check whether `admin-api` is running on port 9000."
            : "Loading audit log…"}
        </p>
      </div>
    )
  }

  return (
    <div className="console-screen fade-in">
      <header className="console-head">
        <h1 className="console-head-title">Audit</h1>
        <span className="console-head-meta tab-active">Request traces</span>
        <div className="console-head-actions">
          <span className="console-head-meta">{rows.length} entries</span>
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
        <div className="panel no-pad">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Upstream</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={7}>
                    No requests recorded yet.
                  </TableCell>
                </TableRow>
              ) : null}
              {rows.map((log) => (
                <TableRow
                  key={log.request_id}
                  className="cursor-pointer"
                  onClick={() => setOpen(log)}
                >
                  <TableCell className="tnum whitespace-nowrap text-muted-foreground">
                    {formatTime(log.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">
                    {log.api_key_id ? keyById.get(log.api_key_id) ?? "—" : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.epichust_model_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.provider_id ? providerById.get(log.provider_id) ?? "—" : "—"}
                  </TableCell>
                  <TableCell className="tnum text-muted-foreground">
                    {log.total_tokens != null ? log.total_tokens.toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="tnum font-semibold">{log.latency_ms} ms</TableCell>
                  <TableCell>
                    <span
                      className="tnum status-pill"
                      style={{ color: statusColor(log.status_code) }}
                    >
                      <span className="status-dot" style={{ background: statusColor(log.status_code) }} />
                      {log.status_code}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {open ? <AuditDrawer log={open} data={data} onClose={() => setOpen(null)} /> : null}
    </div>
  )
}

export { AuditPage }
