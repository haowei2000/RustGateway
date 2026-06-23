import { useState } from "react"
import { GripVertical, Loader2, Save, Shuffle, Trash2 } from "lucide-react"

import { AddItemModal } from "@/components/ui/add-item-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  useCreateMappingPolicy,
  useDeleteMappingPolicy,
  useUpdateMappingPolicy,
} from "@/hooks/use-admin-data"
import type {
  AdminData,
  MappingPolicy,
  RateLimitRule,
  RoutingStrategy,
  UsageLimitType,
} from "@/lib/api"
import { NEW_SIDEBAR_ITEM_ID } from "@/stores/admin-store"
import { useToast } from "@/stores/toast-store"

import {
  EmptyResourcePage,
  ReadOnlyField,
  ResourceCard,
  ResourceNotice,
  ResourcePageFrame,
  ResourcePageHeader,
  SubItemList,
  SubItemRow,
} from "./resource-page-parts"
import { formatDate, getSelectedItem } from "./resource-page-utils"

type PolicyPageProps = {
  data: AdminData | undefined
  isFetching: boolean
  selectedItemId: string
  onRefresh: () => void
}

type PolicyDraft = {
  epichust_model_id: string
  routing_strategy: RoutingStrategy
  rate_limit_rules: RateLimitRule[]
  enabled: boolean
  routes: PolicyRouteDraft[]
}

type PolicyRouteDraft = {
  provider_model_id: string
  provider_model_name: string
  provider_id: string
  provider_name: string
  weight: number
  priority: number
  enabled: boolean
}

const USAGE_LIMIT_TYPE_OPTIONS: UsageLimitType[] = [
  "requests_per_minute",
  "requests_per_day",
  "tokens_per_minute",
  "tokens_per_day",
]

const ROUTING_STRATEGY_OPTIONS: RoutingStrategy[] = ["weighted", "priority", "round_robin"]

function PolicyPage({ data, isFetching, selectedItemId, onRefresh }: PolicyPageProps) {
  if (!data) return <EmptyResourcePage message="Loading policy details." />
  if (selectedItemId === NEW_SIDEBAR_ITEM_ID)
    return <PolicyPageContent key="new-policy" data={data} isFetching={isFetching} onRefresh={onRefresh} />
  const item = getSelectedItem(data.policies, selectedItemId)
  if (!item) return <EmptyResourcePage message="Create or select a policy from the sidebar." />
  return <PolicyPageContent key={item.id} data={data} isFetching={isFetching} item={item} onRefresh={onRefresh} />
}

function PolicyPageContent({
  data, isFetching, item, onRefresh,
}: { data: AdminData; isFetching: boolean; item?: MappingPolicy; onRefresh: () => void }) {
  const [draft, setDraft] = useState<PolicyDraft>(() => createPolicyDraft(item))
  const [notice, setNoticeState] = useState("")
  const toast = useToast()
  const setNotice = (message: string) => {
    setNoticeState(message)
    toast.auto(message)
  }
  const [showRateLimitModal, setShowRateLimitModal] = useState(false)
  const [showAddRoute, setShowAddRoute] = useState(false)
  const [newRouteModelId, setNewRouteModelId] = useState("")
  const [newRouteWeight, setNewRouteWeight] = useState(1)
  const [newRoutePriority, setNewRoutePriority] = useState(1)
  const isNew = !item
  const createMutation = useCreateMappingPolicy()
  const updateMutation = useUpdateMappingPolicy()
  const deleteMutation = useDeleteMappingPolicy()

  async function handleSave() {
    try {
      if (isNew) {
        await createMutation.mutateAsync({
          epichust_model_id: draft.epichust_model_id,
          routing_strategy: draft.routing_strategy,
          rate_limit_rules: draft.rate_limit_rules,
          enabled: draft.enabled,
          routes: draft.routes.map((r) => ({
            provider_model_id: r.provider_model_id, weight: r.weight,
            priority: r.priority, enabled: r.enabled,
          })),
        })
        setNotice("Policy created.")
        onRefresh()
      } else if (item) {
        await updateMutation.mutateAsync({
          id: item.id,
          input: {
            routing_strategy: draft.routing_strategy,
            // Always send the array (empty = clear all rules). Sending undefined
            // would make the backend keep the existing rules.
            rate_limit_rules: draft.rate_limit_rules,
            enabled: draft.enabled,
            routes: draft.routes.map((r) => ({
              provider_model_id: r.provider_model_id, weight: r.weight,
              priority: r.priority, enabled: r.enabled,
            })),
          },
        })
        setNotice("Policy updated.")
        onRefresh()
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to save policy.")
    }
  }

  async function handleDelete() {
    if (!item) return
    try { await deleteMutation.mutateAsync(item.id); setNotice("Policy deleted."); onRefresh() }
    catch (error) { setNotice(error instanceof Error ? error.message : "Failed to delete.") }
  }

  const availableLimitTypes = USAGE_LIMIT_TYPE_OPTIONS.filter(
    (t) => !draft.rate_limit_rules.some((r) => r.limit_type === t),
  )

  const availableRouteModels = data.providerModels.filter(
    (pm) => !draft.routes.some((r) => r.provider_model_id === pm.id),
  )

  function handleAddRateLimitRules(selectedIds: string[]) {
    const newRules = selectedIds.map((limitType) => ({
      limit_type: limitType as UsageLimitType,
      limit_value: 100,
    }))
    setDraft((c) => ({ ...c, rate_limit_rules: [...c.rate_limit_rules, ...newRules] }))
    setShowRateLimitModal(false)
  }

  const effectiveNewRouteModelId = newRouteModelId || availableRouteModels[0]?.id || ""

  function addRouteInline() {
    const pm = data.providerModels.find((m) => m.id === effectiveNewRouteModelId)
    if (!pm || draft.routes.some((r) => r.provider_model_id === pm.id)) return
    const provider = data.providers.find((p) => p.id === pm.provider_id)
    setDraft((c) => ({
      ...c,
      routes: [...c.routes, {
        provider_model_id: pm.id, provider_model_name: pm.model_name,
        provider_id: pm.provider_id, provider_name: provider?.provider_name ?? "Unknown",
        weight: newRouteWeight, priority: newRoutePriority, enabled: true,
      }],
    }))
    setNewRouteModelId("")
    setNewRouteWeight(1)
    setNewRoutePriority(1)
  }

  const modelName = draft.epichust_model_id
    ? data.models.find((m) => m.id === draft.epichust_model_id)?.model_name ?? "—"
    : "—"

  return (
    <ResourcePageFrame variant="policy">
      <ResourcePageHeader
        actions={
          <>
            {!isNew && (
              <Button variant="ghost" disabled={deleteMutation.isPending} onClick={handleDelete}>
                {deleteMutation.isPending ? <Loader2 className="icon-sm refresh-icon-busy" /> : <Trash2 className="icon-sm" />}
                Delete
              </Button>
            )}
            <Button disabled={!draft.epichust_model_id || createMutation.isPending || updateMutation.isPending}
              onClick={handleSave}>
              {(createMutation.isPending || updateMutation.isPending) ? (
                <Loader2 className="icon-sm refresh-icon-busy" />
              ) : (<Save className="icon-sm" />)}
              {isNew ? "Create" : "Save"}
            </Button>
          </>
        }
        description={item ? `Policy · ${item.id}` : "New mapping policy"}
        icon={Shuffle}
        isFetching={isFetching}
        status={draft.routing_strategy}
        statusVariant="outline"
        title={modelName}
        onRefresh={onRefresh}
      />

      {/* ── Status Part ── */}
      <ResourceCard title="Status">
        <div className="resource-status-grid">
          <div className="resource-field">
            <Label htmlFor="policy-model">Epichust Model</Label>
            <select id="policy-model" className="resource-select" value={draft.epichust_model_id}
              onChange={(e) => setDraft((c) => ({ ...c, epichust_model_id: e.target.value }))}>
              <option value="">Select a model…</option>
              {data.models.map((m) => <option key={m.id} value={m.id}>{m.model_name} ({m.model_type})</option>)}
            </select>
          </div>
          <div className="resource-field">
            <Label htmlFor="policy-strategy">Routing Strategy</Label>
            <select id="policy-strategy" className="resource-select" value={draft.routing_strategy}
              onChange={(e) => setDraft((c) => ({ ...c, routing_strategy: e.target.value as RoutingStrategy }))}>
              {ROUTING_STRATEGY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="resource-field">
            <Label htmlFor="policy-enabled">Enabled</Label>
            <select id="policy-enabled" className="resource-select" value={draft.enabled ? "true" : "false"}
              onChange={(e) => setDraft((c) => ({ ...c, enabled: e.target.value === "true" }))}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          {item ? (
            <>
              <ReadOnlyField label="Policy ID" value={item.id} />
              <ReadOnlyField label="Created" value={formatDate(item.created_at)} />
            </>
          ) : (
            <ReadOnlyField label="Mode" value="New draft" />
          )}
        </div>
      </ResourceCard>

      {/* ── Rate Limit Rules ── */}
      <SubItemList
        title="Rate Limit Rules"
        addLabel="Add rule"
        onAdd={() => setShowRateLimitModal(true)}
      >
        {draft.rate_limit_rules.map((rule, index) => (
          <SubItemRow
            key={rule.limit_type}
            icon={GripVertical}
            title={rule.limit_type}
            subtitle={`${rule.limit_value} requests`}
            actions={
              <div className="flex items-center gap-2">
                <Input className="w-24 h-8 text-xs" type="number" min={1} value={rule.limit_value}
                  onChange={(e) => setDraft((c) => {
                    const rules = [...c.rate_limit_rules]
                    rules[index] = { ...rules[index], limit_value: Math.max(1, Number(e.target.value) || 1) }
                    return { ...c, rate_limit_rules: rules }
                  })} />
                <span
                  className="sub-item-action"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setDraft((c) => ({ ...c, rate_limit_rules: c.rate_limit_rules.filter((_, i) => i !== index) })) } }}
                  onClick={(e) => { e.stopPropagation(); setDraft((c) => ({ ...c, rate_limit_rules: c.rate_limit_rules.filter((_, i) => i !== index) })) }}
                >
                  <Trash2 className="icon-sm" />
                </span>
              </div>
            }
          />
        ))}
      </SubItemList>

      {/* ── Provider Routes ── */}
      <SubItemList
        title="Provider Routes"
        addLabel="Add route"
        onAdd={() => { setShowAddRoute(true); setNewRouteModelId(availableRouteModels[0]?.id ?? "") }}
      >
        {showAddRoute ? (
          <div className="add-route-card">
            {availableRouteModels.length === 0 ? (
              <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--muted-foreground)" }}>
                No provider models available. Add models in the Provider page first.
              </p>
            ) : (
              <div className="add-route-card-row">
                <select className="resource-select" style={{ flex: 1 }}
                  value={effectiveNewRouteModelId}
                  onChange={(e) => setNewRouteModelId(e.target.value)}>
                  {availableRouteModels.map((pm) => {
                    const provider = data.providers.find((p) => p.id === pm.provider_id)
                    return <option key={pm.id} value={pm.id}>{provider?.provider_name ?? "?"} / {pm.model_name}</option>
                  })}
                </select>
                <Label style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>Weight</Label>
                <Input className="w-16 h-8 text-xs" type="number" min={1}
                  value={newRouteWeight}
                  onChange={(e) => setNewRouteWeight(Math.max(1, Number(e.target.value) || 1))} />
                <Label style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}>Priority</Label>
                <Input className="w-16 h-8 text-xs" type="number" min={1}
                  value={newRoutePriority}
                  onChange={(e) => setNewRoutePriority(Math.max(1, Number(e.target.value) || 1))} />
                <Button size="sm" disabled={!effectiveNewRouteModelId} onClick={() => { addRouteInline() }}>
                  <Save className="icon-sm" /> Add
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddRoute(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        ) : null}
        {draft.routes.map((route, index) => (
          <SubItemRow
            key={route.provider_model_id}
            icon={GripVertical}
            title={`${route.provider_name} / ${route.provider_model_name}`}
            subtitle={`weight: ${route.weight} · priority: ${route.priority}`}
            actions={
              <div className="flex items-center gap-1">
                <span
                  className="sub-item-action"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setDraft((c) => {
                    const routes = [...c.routes]
                    routes[index] = { ...routes[index], enabled: !routes[index].enabled }
                    return { ...c, routes }
                  }) } } }
                  onClick={(e) => { e.stopPropagation(); setDraft((c) => {
                    const routes = [...c.routes]
                    routes[index] = { ...routes[index], enabled: !routes[index].enabled }
                    return { ...c, routes }
                  }) }}
                >
                  {route.enabled ? "Disable" : "Enable"}
                </span>
                <span
                  className="sub-item-action"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setDraft((c) => ({ ...c, routes: c.routes.filter((r) => r.provider_model_id !== route.provider_model_id) })) } }}
                  onClick={(e) => { e.stopPropagation(); setDraft((c) => ({ ...c, routes: c.routes.filter((r) => r.provider_model_id !== route.provider_model_id) })) }}
                >
                  <Trash2 className="icon-sm" />
                </span>
              </div>
            }
          />
        ))}
      </SubItemList>

      {notice && <ResourceNotice>{notice}</ResourceNotice>}

      <AddItemModal
        confirmLabel="Add rules"
        emptyText="All limit types already configured."
        items={availableLimitTypes.map((t) => ({ id: t, label: t }))}
        open={showRateLimitModal}
        title="Add Rate Limit Rule"
        onClose={() => setShowRateLimitModal(false)}
        onConfirm={handleAddRateLimitRules}
      />

    </ResourcePageFrame>
  )
}

function createPolicyDraft(item?: MappingPolicy): PolicyDraft {
  if (!item) return { epichust_model_id: "", routing_strategy: "weighted", rate_limit_rules: [], enabled: true, routes: [] }
  return {
    epichust_model_id: item.epichust_model_id,
    routing_strategy: item.routing_strategy,
    rate_limit_rules: (item.rate_limit_rules ?? []).map((r) => ({ ...r })),
    enabled: item.enabled,
    routes: item.routes.map((r) => ({
      provider_model_id: r.provider_model_id, provider_model_name: r.provider_model_name,
      provider_id: r.provider_id, provider_name: r.provider_name,
      weight: r.weight, priority: r.priority, enabled: r.enabled,
    })),
  }
}

export { PolicyPage }
