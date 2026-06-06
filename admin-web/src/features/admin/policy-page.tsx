import { useState } from "react"
import { Loader2, Plus, RotateCcw, Save, Shuffle, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  ResourceMetrics,
  ResourceNotice,
  ResourcePageFrame,
  ResourcePageHeader,
  ResourceSectionHeader,
} from "./resource-page-parts"
import { formatDate, formatNumber, getSelectedItem } from "./resource-page-utils"

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

const ROUTING_STRATEGY_OPTIONS: RoutingStrategy[] = [
  "weighted",
  "priority",
  "round_robin",
]

function PolicyPage({ data, isFetching, selectedItemId, onRefresh }: PolicyPageProps) {
  if (!data) {
    return <EmptyResourcePage message="Loading policy details." />
  }

  if (selectedItemId === NEW_SIDEBAR_ITEM_ID) {
    return (
      <PolicyPageContent
        key="new-policy"
        data={data}
        isFetching={isFetching}
        onRefresh={onRefresh}
      />
    )
  }

  const item = getSelectedItem(data.policies, selectedItemId)
  if (!item) {
    return <EmptyResourcePage message="Create or select a policy from the sidebar." />
  }

  return (
    <PolicyPageContent
      key={item.id}
      data={data}
      isFetching={isFetching}
      item={item}
      onRefresh={onRefresh}
    />
  )
}

function PolicyPageContent({
  data,
  isFetching,
  item,
  onRefresh,
}: {
  data: AdminData
  isFetching: boolean
  item?: MappingPolicy
  onRefresh: () => void
}) {
  const [draft, setDraft] = useState<PolicyDraft>(() => createPolicyDraft(item))
  const [notice, setNotice] = useState("")
  const [selectedProviderModelId, setSelectedProviderModelId] = useState("")

  const effectiveProviderModelId =
    selectedProviderModelId || data.providerModels[0]?.id || ""
  const isNew = !item
  const enabledRouteCount = draft.routes.filter((r) => r.enabled).length
  const createMutation = useCreateMappingPolicy()
  const updateMutation = useUpdateMappingPolicy()
  const deleteMutation = useDeleteMappingPolicy()

  async function handleSave() {
    try {
      if (isNew) {
        const created = await createMutation.mutateAsync({
          epichust_model_id: draft.epichust_model_id,
          routing_strategy: draft.routing_strategy,
          rate_limit_rules: draft.rate_limit_rules,
          enabled: draft.enabled,
          routes: draft.routes.map((r) => ({
            provider_model_id: r.provider_model_id,
            weight: r.weight,
            priority: r.priority,
            enabled: r.enabled,
          })),
        })
        setNotice(`Policy "${created.id}" created.`)
        onRefresh()
      } else if (item) {
        await updateMutation.mutateAsync({
          id: item.id,
          input: {
            routing_strategy: draft.routing_strategy,
            rate_limit_rules: draft.rate_limit_rules.length > 0 ? draft.rate_limit_rules : undefined,
            enabled: draft.enabled,
            routes: draft.routes.map((r) => ({
              provider_model_id: r.provider_model_id,
              weight: r.weight,
              priority: r.priority,
              enabled: r.enabled,
            })),
          },
        })
        setNotice(`Policy "${item.id}" updated.`)
        onRefresh()
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to save policy.")
    }
  }

  async function handleDelete() {
    if (!item) return
    try {
      await deleteMutation.mutateAsync(item.id)
      setNotice(`Policy "${item.id}" deleted.`)
      onRefresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to delete policy.")
    }
  }

  function addRateLimitRule() {
    const limitType = USAGE_LIMIT_TYPE_OPTIONS.find(
      (t) => !draft.rate_limit_rules.some((r) => r.limit_type === t),
    )
    if (!limitType) {
      setNotice("All limit types are already configured. Remove one before adding.")
      return
    }

    setDraft((current) => ({
      ...current,
      rate_limit_rules: [
        ...current.rate_limit_rules,
        { limit_type: limitType, limit_value: 100 },
      ],
    }))
    setNotice("")
  }

  function removeRateLimitRule(index: number) {
    setDraft((current) => ({
      ...current,
      rate_limit_rules: current.rate_limit_rules.filter((_, i) => i !== index),
    }))
  }

  function addProviderRoute() {
    const pm = data.providerModels.find(
      (m) => m.id === effectiveProviderModelId,
    )
    if (!pm) return

    const alreadyAdded = draft.routes.some(
      (r) => r.provider_model_id === pm.id,
    )
    if (alreadyAdded) {
      setNotice("That provider model is already in the route list.")
      return
    }

    const provider = data.providers.find((p) => p.id === pm.provider_id)
    const route: PolicyRouteDraft = {
      provider_model_id: pm.id,
      provider_model_name: pm.model_name,
      provider_id: pm.provider_id,
      provider_name: provider?.provider_name ?? "Unknown",
      weight: 1,
      priority: 1,
      enabled: true,
    }

    setDraft((current) => ({
      ...current,
      routes: [...current.routes, route],
    }))
    setSelectedProviderModelId("")
    setNotice("")
  }

  function removeProviderRoute(providerModelId: string) {
    setDraft((current) => ({
      ...current,
      routes: current.routes.filter(
        (r) => r.provider_model_id !== providerModelId,
      ),
    }))
  }

  return (
    <ResourcePageFrame variant="policy">
      <ResourcePageHeader
        description={
          item ? `Policy ${item.id}` : "New mapping policy draft"
        }
        icon={Shuffle}
        isFetching={isFetching}
        status={draft.routing_strategy}
        title={
          draft.epichust_model_id
            ? data.models.find((m) => m.id === draft.epichust_model_id)
                ?.model_name ?? "Mapping Policy"
            : "New Mapping Policy"
        }
        onRefresh={onRefresh}
      />

      <div className="resource-layout resource-layout-policy">
        {/* Card 1: Policy Settings */}
        <ResourceCard title="Policy Settings">
          <div className="resource-form-grid">
            <div className="resource-field">
              <Label htmlFor="policy-model">Epichust Model</Label>
              <select
                id="policy-model"
                className="resource-select"
                value={draft.epichust_model_id}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    epichust_model_id: event.target.value,
                  }))
                }
              >
                <option value="">Select a model…</option>
                {data.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.model_name} ({model.model_type})
                  </option>
                ))}
              </select>
            </div>
            <div className="resource-field">
              <Label htmlFor="policy-strategy">Routing Strategy</Label>
              <select
                id="policy-strategy"
                className="resource-select"
                value={draft.routing_strategy}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    routing_strategy: event.target.value as RoutingStrategy,
                  }))
                }
              >
                {ROUTING_STRATEGY_OPTIONS.map((strategy) => (
                  <option key={strategy} value={strategy}>
                    {strategy}
                  </option>
                ))}
              </select>
            </div>
            <div className="resource-field">
              <Label htmlFor="policy-enabled">Enabled</Label>
              <select
                id="policy-enabled"
                className="resource-select"
                value={draft.enabled ? "true" : "false"}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    enabled: event.target.value === "true",
                  }))
                }
              >
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

        {/* Card 2: Rate Limit Rules */}
        <ResourceCard title="Rate Limit Rules">
          <ResourceSectionHeader
            actions={
              <Button
                disabled={draft.rate_limit_rules.length >= USAGE_LIMIT_TYPE_OPTIONS.length}
                type="button"
                variant="outline"
                onClick={addRateLimitRule}
              >
                <Plus className="icon-sm" aria-hidden="true" />
                Add Rule
              </Button>
            }
            title="Rate limit rules"
          />

          {draft.rate_limit_rules.length > 0 ? (
            <Table className="resource-inline-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Limit Type</TableHead>
                  <TableHead>Limit Value</TableHead>
                  <TableHead className="resource-actions-cell">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.rate_limit_rules.map((rule, index) => (
                  <TableRow key={rule.limit_type}>
                    <TableCell>
                      <select
                        className="resource-select resource-select-compact"
                        value={rule.limit_type}
                        onChange={(event) =>
                          setDraft((current) => {
                            const rules = [...current.rate_limit_rules]
                            const newType = event.target.value as UsageLimitType
                            if (
                              current.rate_limit_rules.some(
                                (r, i) => i !== index && r.limit_type === newType,
                              )
                            ) {
                              setNotice(
                                `Limit type "${newType}" is already configured.`,
                              )
                              return current
                            }
                            rules[index] = { ...rules[index], limit_type: newType }
                            setNotice("")
                            return { ...current, rate_limit_rules: rules }
                          })
                        }
                      >
                        {USAGE_LIMIT_TYPE_OPTIONS.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input
                        className="resource-number-input"
                        min={1}
                        type="number"
                        value={rule.limit_value}
                        onChange={(event) =>
                          setDraft((current) => {
                            const rules = [...current.rate_limit_rules]
                            rules[index] = {
                              ...rules[index],
                              limit_value: Math.max(
                                1,
                                Number(event.target.value) || 1,
                              ),
                            }
                            return { ...current, rate_limit_rules: rules }
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={() => removeRateLimitRule(index)}
                      >
                        <Trash2 className="icon-sm" aria-hidden="true" />
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyBlock>No rate limit rules configured.</EmptyBlock>
          )}
        </ResourceCard>
      </div>

      {/* Card 3: Provider Routes (full width) */}
      <ResourceCard title="Provider Routes">
        <ResourceSectionHeader
          actions={
            <>
              <select
                className="resource-select"
                value={effectiveProviderModelId}
                onChange={(event) =>
                  setSelectedProviderModelId(event.target.value)
                }
              >
                {data.providerModels.length > 0 ? (
                  data.providerModels.map((pm) => {
                    const provider = data.providers.find(
                      (p) => p.id === pm.provider_id,
                    )
                    return (
                      <option key={pm.id} value={pm.id}>
                        {provider?.provider_name ?? "Unknown"} / {pm.model_name}
                      </option>
                    )
                  })
                ) : (
                  <option value="">No provider models available</option>
                )}
              </select>
              <Button
                disabled={!effectiveProviderModelId}
                type="button"
                variant="outline"
                onClick={addProviderRoute}
              >
                <Plus className="icon-sm" aria-hidden="true" />
                Add Route
              </Button>
            </>
          }
          title="Provider route mappings"
        />

        {draft.routes.length > 0 ? (
          <Table className="resource-inline-table">
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Weight</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="resource-actions-cell">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.routes.map((route, index) => (
                <TableRow key={route.provider_model_id}>
                  <TableCell>
                    <span className="resource-policy-route-provider">
                      {route.provider_name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="resource-policy-route-model">
                      {route.provider_model_name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="resource-number-input"
                      min={0}
                      type="number"
                      value={route.weight}
                      onChange={(event) =>
                        setDraft((current) => {
                          const routes = [...current.routes]
                          routes[index] = {
                            ...routes[index],
                            weight: Math.max(
                              0,
                              Number(event.target.value) || 0,
                            ),
                          }
                          return { ...current, routes }
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="resource-number-input"
                      min={0}
                      type="number"
                      value={route.priority}
                      onChange={(event) =>
                        setDraft((current) => {
                          const routes = [...current.routes]
                          routes[index] = {
                            ...routes[index],
                            priority: Math.max(
                              0,
                              Number(event.target.value) || 0,
                            ),
                          }
                          return { ...current, routes }
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        route.enabled
                          ? "resource-status-ok"
                          : "resource-status-off"
                      }
                    >
                      {String(route.enabled)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ResourceActions>
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() =>
                          setDraft((current) => {
                            const routes = [...current.routes]
                            routes[index] = {
                              ...routes[index],
                              enabled: !routes[index].enabled,
                            }
                            return { ...current, routes }
                          })
                        }
                      >
                        {route.enabled ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={() =>
                          removeProviderRoute(route.provider_model_id)
                        }
                      >
                        <Trash2 className="icon-sm" aria-hidden="true" />
                        Remove
                      </Button>
                    </ResourceActions>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyBlock>No provider routes configured.</EmptyBlock>
        )}
      </ResourceCard>

      <ResourceMetrics
        metrics={[
          {
            label: "Routes",
            value: `${draft.routes.length} (${enabledRouteCount} enabled)`,
          },
          {
            label: "Rate Limit Rules",
            value: formatNumber(draft.rate_limit_rules.length),
          },
          { label: "Enabled Routes", value: formatNumber(enabledRouteCount) },
        ]}
      />

      <ResourceActions>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDraft(createPolicyDraft(item))
            setNotice("Draft reset.")
          }}
        >
          <RotateCcw className="icon-sm" aria-hidden="true" />
          Reset
        </Button>
        <Button
          disabled={
            !draft.epichust_model_id ||
            createMutation.isPending ||
            updateMutation.isPending
          }
          type="button"
          onClick={handleSave}
        >
          {createMutation.isPending || updateMutation.isPending ? (
            <Loader2 className="icon-sm refresh-icon-busy" aria-hidden="true" />
          ) : (
            <Save className="icon-sm" aria-hidden="true" />
          )}
          {createMutation.isPending || updateMutation.isPending
            ? "Saving…"
            : isNew
              ? "Create policy"
              : "Save changes"}
        </Button>
        {!isNew ? (
          <Button
            disabled={deleteMutation.isPending}
            type="button"
            variant="ghost"
            onClick={handleDelete}
          >
            {deleteMutation.isPending ? (
              <Loader2 className="icon-sm refresh-icon-busy" aria-hidden="true" />
            ) : (
              <Trash2 className="icon-sm" aria-hidden="true" />
            )}
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        ) : null}
      </ResourceActions>

      {notice ? <ResourceNotice>{notice}</ResourceNotice> : null}
    </ResourcePageFrame>
  )
}

function createPolicyDraft(item?: MappingPolicy): PolicyDraft {
  if (!item) {
    return {
      epichust_model_id: "",
      routing_strategy: "weighted",
      rate_limit_rules: [],
      enabled: true,
      routes: [],
    }
  }

  return {
    epichust_model_id: item.epichust_model_id,
    routing_strategy: item.routing_strategy,
    rate_limit_rules: (item.rate_limit_rules ?? []).map((rule) => ({
      ...rule,
    })),
    enabled: item.enabled,
    routes: item.routes.map((route) => ({
      provider_model_id: route.provider_model_id,
      provider_model_name: route.provider_model_name,
      provider_id: route.provider_id,
      provider_name: route.provider_name,
      weight: route.weight,
      priority: route.priority,
      enabled: route.enabled,
    })),
  }
}

export { PolicyPage }
