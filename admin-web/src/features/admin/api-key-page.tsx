import { useState } from "react"
import { Ban, Check, KeyRound, Loader2, Pencil, Plus, RotateCcw, Save } from "lucide-react"

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
  useAttachApiKeyMappingPolicy,
  useCreateApiKey,
  useDetachApiKeyMappingPolicy,
} from "@/hooks/use-admin-data"
import type {
  AdminData,
  ApiKeyMappingPolicy,
  ApiKeySummary,
  MappingPolicy,
} from "@/lib/api"
import { NEW_SIDEBAR_ITEM_ID } from "@/stores/admin-store"

import {
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
} from "./resource-page-parts"
import { formatDate, formatNumber, getSelectedItem } from "./resource-page-utils"

type ApiKeyPageProps = {
  data: AdminData | undefined
  isFetching: boolean
  selectedItemId: string
  onRefresh: () => void
}

type ApiKeyDraft = {
  enabled: boolean
  key_name: string
  mappingPolicies: ApiKeyMappingPolicy[]
}

function attachablePolicies(data: AdminData, draft: ApiKeyDraft): MappingPolicy[] {
  const attachedIds = new Set(draft.mappingPolicies.map((mp) => mp.mapping_policy_id))
  return data.policies.filter((policy) => !attachedIds.has(policy.id))
}

function ApiKeyPage({ data, isFetching, selectedItemId, onRefresh }: ApiKeyPageProps) {
  if (!data) {
    return <EmptyResourcePage message="Loading API key details." />
  }

  if (selectedItemId === NEW_SIDEBAR_ITEM_ID) {
    return (
      <ApiKeyPageContent
        key="new-api-key"
        data={data}
        isFetching={isFetching}
        onRefresh={onRefresh}
      />
    )
  }

  const item = getSelectedItem(data.apiKeys, selectedItemId)
  if (!item) {
    return <EmptyResourcePage message="Create or select an API key from the sidebar." />
  }

  return (
    <ApiKeyPageContent
      key={item.id}
      data={data}
      isFetching={isFetching}
      item={item}
      onRefresh={onRefresh}
    />
  )
}

function ApiKeyPageContent({
  data,
  isFetching,
  item,
  onRefresh,
}: {
  data: AdminData
  isFetching: boolean
  item?: ApiKeySummary
  onRefresh: () => void
}) {
  const [draft, setDraft] = useState<ApiKeyDraft>(() => createApiKeyDraft(item))
  const [editingPolicyId, setEditingPolicyId] = useState("")
  const [policyToAddId, setPolicyToAddId] = useState("")
  const [notice, setNotice] = useState("")
  const createApiKeyMutation = useCreateApiKey()
  const attachPolicyMutation = useAttachApiKeyMappingPolicy()
  const detachPolicyMutation = useDetachApiKeyMappingPolicy()

  const availablePolicies = attachablePolicies(data, draft)
  const effectivePolicyToAddId =
    policyToAddId || availablePolicies[0]?.id || ""
  const routeCount = draft.mappingPolicies.reduce(
    (count, mp) => count + mp.routes.length,
    0,
  )
  const isNew = !item

  async function handleSave() {
    if (isNew) {
      try {
        const result = await createApiKeyMutation.mutateAsync({
          key_name: draft.key_name.trim() || "New API Key",
        })
        setNotice(
          `API key created! Copy your key now: ${result.plaintext_api_key}`,
        )
        onRefresh()
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Failed to create API key.")
      }
    }
  }

  async function addMappingPolicy() {
    const policy = data.policies.find(
      (candidate) => candidate.id === effectivePolicyToAddId,
    )
    if (!policy) return

    if (item) {
      try {
        await attachPolicyMutation.mutateAsync({
          apiKeyId: item.id,
          input: { mapping_policy_id: policy.id },
        })
        setNotice(`Policy "${policy.epichust_model_name}" attached to API key.`)
        setPolicyToAddId("")
        onRefresh()
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Failed to attach policy.")
      }
      return
    }

    const mp: ApiKeyMappingPolicy = {
      enabled: true,
      epichust_model_id: policy.epichust_model_id,
      epichust_model_name: policy.epichust_model_name,
      mapping_policy_id: policy.id,
      routing_strategy: policy.routing_strategy,
      rate_limit_rules: (policy.rate_limit_rules ?? []).map((rule) => ({
        ...rule,
      })),
      routes: policy.routes.map((route) => ({ ...route })),
    }

    setDraft((current) => ({
      ...current,
      mappingPolicies: [...current.mappingPolicies, mp],
    }))
    setPolicyToAddId("")
    setNotice("Mapping policy added to the local draft.")
  }

  async function removeMappingPolicy(policyId: string) {
    if (item) {
      try {
        await detachPolicyMutation.mutateAsync({
          apiKeyId: item.id,
          mappingPolicyId: policyId,
        })
        setNotice("Policy detached from API key.")
        setEditingPolicyId("")
        onRefresh()
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Failed to detach policy.")
      }
      return
    }

    setDraft((current) => ({
      ...current,
      mappingPolicies: current.mappingPolicies.filter(
        (mp) => mp.mapping_policy_id !== policyId,
      ),
    }))
    setEditingPolicyId("")
    setNotice("Mapping policy removed from the local draft.")
  }

  function revokeApiKey() {
    setDraft((current) => ({ ...current, enabled: false }))
    setNotice("Revoke is queued in the local draft.")
  }

  return (
    <ResourcePageFrame variant="key">
      <ResourcePageHeader
        description={
          item ? `Hash prefix ${item.key_hash_prefix}` : "New API key draft"
        }
        icon={KeyRound}
        isFetching={isFetching}
        status={draft.enabled ? "enabled" : "disabled"}
        title={draft.key_name || "New API Key"}
        onRefresh={onRefresh}
      />

      <ResourceMetrics
        metrics={[
          { label: "Policies", value: draft.mappingPolicies.length },
          { label: "Routes", value: formatNumber(routeCount) },
          {
            label: "Last Used",
            value: item ? formatDate(item.last_used_at) : "-",
          },
          { label: "Created", value: item ? formatDate(item.created_at) : "-" },
        ]}
      />

      <div className="resource-layout resource-layout-key">
        <ResourceCard className="resource-card-main" title="Mapping Policies">
          <ResourceSectionHeader
            actions={
              <>
                <select
                  className="resource-select"
                  disabled={availablePolicies.length === 0}
                  value={effectivePolicyToAddId}
                  onChange={(event) =>
                    setPolicyToAddId(event.target.value)
                  }
                >
                  {availablePolicies.length > 0 ? (
                    availablePolicies.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy.epichust_model_name} ({policy.routing_strategy})
                      </option>
                    ))
                  ) : (
                    <option value="">All policies attached</option>
                  )}
                </select>
                <Button
                  disabled={!effectivePolicyToAddId}
                  type="button"
                  variant="outline"
                  onClick={addMappingPolicy}
                >
                  <Plus className="icon-sm" aria-hidden="true" />
                  Add policy
                </Button>
              </>
            }
            title="Attached mapping policies"
          />

          {draft.mappingPolicies.length > 0 ? (
            <Table className="resource-inline-table resource-key-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Routes</TableHead>
                  <TableHead>Usage limit</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="resource-actions-cell">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.mappingPolicies.map((mp) => {
                  const isEditing = editingPolicyId === mp.mapping_policy_id

                  return (
                    <TableRow key={mp.mapping_policy_id}>
                      <TableCell>
                        <span className="resource-field-label">
                          {mp.epichust_model_name}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="resource-strategy-badge">
                          {mp.routing_strategy}
                        </span>
                      </TableCell>
                      <TableCell>
                        {mp.routes.length > 0 ? (
                          <ul className="resource-route-list">
                            {mp.routes.map((route) => (
                              <li key={route.provider_model_id}>
                                {route.provider_name} / {route.provider_model_name}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="resource-muted-text">No routes</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {mp.rate_limit_rules.length > 0 ? (
                          <ul className="resource-route-list">
                            {mp.rate_limit_rules.map((rule) => (
                              <li key={rule.limit_type}>
                                {rule.limit_type}: {rule.limit_value}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="resource-muted-text">Unlimited</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            mp.enabled
                              ? "resource-status-ok"
                              : "resource-status-off"
                          }
                        >
                          {String(mp.enabled)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ResourceActions>
                          <Button
                            size="sm"
                            type="button"
                            variant={
                              isEditing ? "secondary" : "outline"
                            }
                            onClick={() =>
                              setEditingPolicyId(
                                isEditing ? "" : mp.mapping_policy_id,
                              )
                            }
                          >
                            {isEditing ? (
                              <Check className="icon-sm" aria-hidden="true" />
                            ) : (
                              <Pencil className="icon-sm" aria-hidden="true" />
                            )}
                            {isEditing ? "Done" : "Edit"}
                          </Button>
                          <Button
                            size="sm"
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              removeMappingPolicy(mp.mapping_policy_id)
                            }
                          >
                            Remove
                          </Button>
                        </ResourceActions>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <EmptyBlock>No mapping policies attached.</EmptyBlock>
          )}
        </ResourceCard>

        <div className="resource-side-stack">
          <ResourceCard title="Identity">
            <div className="resource-form-grid">
              <div className="resource-field">
                <Label htmlFor="api-key-name">Name</Label>
                <Input
                  id="api-key-name"
                  value={draft.key_name}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      key_name: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="resource-field">
                <Label htmlFor="api-key-enabled">Enabled</Label>
                <select
                  id="api-key-enabled"
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
                  <ReadOnlyField label="Hash prefix" value={item.key_hash_prefix} />
                  <ReadOnlyField label="ID" value={item.id} />
                  <ReadOnlyField label="Created" value={formatDate(item.created_at)} />
                </>
              ) : (
                <ReadOnlyField label="Mode" value="New draft" />
              )}
            </div>
          </ResourceCard>

          {item ? (
            <DangerAction
              action={
                <Button
                  className="resource-danger-button"
                  disabled={!draft.enabled}
                  type="button"
                  variant="outline"
                  onClick={revokeApiKey}
                >
                  <Ban className="icon-sm" aria-hidden="true" />
                  Revoke
                </Button>
              }
              badge="special action"
              description="Enabled changes to false in the current draft."
              title="Revoke API key"
            />
          ) : null}

          <ResourceActions>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(createApiKeyDraft(item))
                setEditingPolicyId("")
                setNotice("Draft reset.")
              }}
            >
              <RotateCcw className="icon-sm" aria-hidden="true" />
              Reset
            </Button>
            {isNew ? (
              <Button
                disabled={createApiKeyMutation.isPending}
                type="button"
                onClick={handleSave}
              >
                {createApiKeyMutation.isPending ? (
                  <Loader2 className="icon-sm refresh-icon-busy" aria-hidden="true" />
                ) : (
                  <Save className="icon-sm" aria-hidden="true" />
                )}
                {createApiKeyMutation.isPending ? "Saving…" : "Create API key"}
              </Button>
            ) : (
              <Button type="button" onClick={() => setNotice("Draft staged locally.")}>
                <Save className="icon-sm" aria-hidden="true" />
                Save draft
              </Button>
            )}
          </ResourceActions>
        </div>
      </div>

      {notice ? <ResourceNotice>{notice}</ResourceNotice> : null}
    </ResourcePageFrame>
  )
}

function createApiKeyDraft(item?: ApiKeySummary): ApiKeyDraft {
  if (!item) {
    return {
      enabled: true,
      key_name: "",
      mappingPolicies: [],
    }
  }

  return {
    enabled: item.enabled,
    key_name: item.key_name,
    mappingPolicies: item.mapping_policies.map((mp) => ({
      ...mp,
      rate_limit_rules: (mp.rate_limit_rules ?? []).map((rule) => ({ ...rule })),
      routes: mp.routes.map((route) => ({ ...route })),
    })),
  }
}

export { ApiKeyPage }
