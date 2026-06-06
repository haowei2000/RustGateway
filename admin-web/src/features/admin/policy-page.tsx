import { useState } from "react"
import { GripVertical, Loader2, Plus, RotateCcw, Save, Shuffle, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  LongItem,
  LongItemActions,
  LongItemBody,
  LongItemIcon,
  LongItemSubtitle,
  LongItemTitle,
} from "@/components/ui/item"
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

import {
  EmptyBlock,
  EmptyResourcePage,
  ReadOnlyField,
  ResourceActions,
  ResourceCard,
  ResourceNotice,
  ResourcePageFrame,
  ResourcePageHeader,
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
  const [notice, setNotice] = useState("")
  const [selectedProviderModelId, setSelectedProviderModelId] = useState("")
  const isNew = !item
  const createMutation = useCreateMappingPolicy()
  const updateMutation = useUpdateMappingPolicy()
  const deleteMutation = useDeleteMappingPolicy()

  const effectiveProviderModelId = selectedProviderModelId || data.providerModels[0]?.id || ""

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
            rate_limit_rules: draft.rate_limit_rules.length > 0 ? draft.rate_limit_rules : undefined,
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

  function addRateLimitRule() {
    const next = USAGE_LIMIT_TYPE_OPTIONS.find((t) => !draft.rate_limit_rules.some((r) => r.limit_type === t))
    if (!next) { setNotice("All limit types already configured."); return }
    setDraft((c) => ({ ...c, rate_limit_rules: [...c.rate_limit_rules, { limit_type: next, limit_value: 100 }] }))
    setNotice("")
  }

  function addProviderRoute() {
    const pm = data.providerModels.find((m) => m.id === effectiveProviderModelId)
    if (!pm) return
    if (draft.routes.some((r) => r.provider_model_id === pm.id)) {
      setNotice("That provider model is already in the route list."); return
    }
    const provider = data.providers.find((p) => p.id === pm.provider_id)
    setDraft((c) => ({
      ...c,
      routes: [...c.routes, {
        provider_model_id: pm.id, provider_model_name: pm.model_name,
        provider_id: pm.provider_id, provider_name: provider?.provider_name ?? "Unknown",
        weight: 1, priority: 1, enabled: true,
      }],
    }))
    setSelectedProviderModelId("")
  }

  const modelName = draft.epichust_model_id
    ? data.models.find((m) => m.id === draft.epichust_model_id)?.model_name ?? "—"
    : "—"

  return (
    <ResourcePageFrame variant="policy">
      <ResourcePageHeader
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

      {/* ── Config Part: Rate Limit Rules ── */}
      <ResourceCard title="Rate Limit Rules">
        <div className="resource-config-list">
          {draft.rate_limit_rules.map((rule, index) => (
            <LongItem key={rule.limit_type}>
              <LongItemIcon><GripVertical className="icon-sm" /></LongItemIcon>
              <LongItemBody>
                <LongItemTitle>{rule.limit_type}</LongItemTitle>
                <LongItemSubtitle>{rule.limit_value} requests</LongItemSubtitle>
              </LongItemBody>
              <div className="flex items-center gap-2">
                <Input className="w-24" type="number" min={1} value={rule.limit_value}
                  onChange={(e) => setDraft((c) => {
                    const rules = [...c.rate_limit_rules]
                    rules[index] = { ...rules[index], limit_value: Math.max(1, Number(e.target.value) || 1) }
                    return { ...c, rate_limit_rules: rules }
                  })} />
                <Button size="sm" variant="ghost" onClick={() =>
                  setDraft((c) => ({ ...c, rate_limit_rules: c.rate_limit_rules.filter((_, i) => i !== index) }))}>
                  <Trash2 className="icon-sm" />
                </Button>
              </div>
            </LongItem>
          ))}
          {draft.rate_limit_rules.length === 0 && <EmptyBlock>No rate limit rules configured.</EmptyBlock>}
        </div>
        <div className="resource-config-footer">
          <Button variant="outline" size="sm"
            disabled={draft.rate_limit_rules.length >= USAGE_LIMIT_TYPE_OPTIONS.length}
            onClick={addRateLimitRule}>
            <Plus className="icon-sm" /> Add Rule
          </Button>
        </div>
      </ResourceCard>

      {/* ── Config Part: Provider Routes ── */}
      <ResourceCard title="Provider Routes">
        <div className="resource-config-list">
          {draft.routes.map((route, index) => (
            <LongItem key={route.provider_model_id}>
              <LongItemIcon><GripVertical className="icon-sm" /></LongItemIcon>
              <LongItemBody>
                <LongItemTitle>{route.provider_name} / {route.provider_model_name}</LongItemTitle>
                <LongItemSubtitle>
                  weight: {route.weight} · priority: {route.priority} · {route.enabled ? "enabled" : "disabled"}
                </LongItemSubtitle>
              </LongItemBody>
              <Badge variant={route.enabled ? "default" : "secondary"}>{route.enabled ? "on" : "off"}</Badge>
              <LongItemActions>
                <Button size="sm" variant="outline"
                  onClick={() => setDraft((c) => {
                    const routes = [...c.routes]
                    routes[index] = { ...routes[index], enabled: !routes[index].enabled }
                    return { ...c, routes }
                  })}>
                  {route.enabled ? "Disable" : "Enable"}
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={() => setDraft((c) => ({
                    ...c, routes: c.routes.filter((r) => r.provider_model_id !== route.provider_model_id),
                  }))}>
                  <Trash2 className="icon-sm" />
                </Button>
              </LongItemActions>
            </LongItem>
          ))}
          {draft.routes.length === 0 && <EmptyBlock>No provider routes configured.</EmptyBlock>}
        </div>
        <div className="resource-config-footer">
          <select className="resource-select" value={effectiveProviderModelId}
            onChange={(e) => setSelectedProviderModelId(e.target.value)}>
            {data.providerModels.length > 0 ? (
              data.providerModels.map((pm) => {
                const provider = data.providers.find((p) => p.id === pm.provider_id)
                return <option key={pm.id} value={pm.id}>{provider?.provider_name ?? "?"} / {pm.model_name}</option>
              })
            ) : (<option value="">No provider models</option>)}
          </select>
          <Button variant="outline" size="sm" disabled={!effectiveProviderModelId}
            onClick={addProviderRoute}>
            <Plus className="icon-sm" /> Add Route
          </Button>
        </div>
      </ResourceCard>

      {/* ── Actions ── */}
      <ResourceActions>
        <Button variant="outline" onClick={() => { setDraft(createPolicyDraft(item)); setNotice("Draft reset.") }}>
          <RotateCcw className="icon-sm" /> Reset
        </Button>
        <Button disabled={!draft.epichust_model_id || createMutation.isPending || updateMutation.isPending}
          onClick={handleSave}>
          {(createMutation.isPending || updateMutation.isPending) ? (
            <Loader2 className="icon-sm refresh-icon-busy" />
          ) : (<Save className="icon-sm" />)}
          {isNew ? "Create policy" : "Save changes"}
        </Button>
        {!isNew && (
          <Button variant="ghost" disabled={deleteMutation.isPending} onClick={handleDelete}>
            {deleteMutation.isPending ? <Loader2 className="icon-sm refresh-icon-busy" /> : <Trash2 className="icon-sm" />}
            Delete
          </Button>
        )}
      </ResourceActions>

      {notice && <ResourceNotice>{notice}</ResourceNotice>}
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
