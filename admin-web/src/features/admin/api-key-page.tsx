import { useState } from "react"
import { Ban, KeyRound, Layers3, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react"

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
  useAttachApiKeyMappingPolicy,
  useCreateApiKey,
  useDetachApiKeyMappingPolicy,
} from "@/hooks/use-admin-data"
import type { AdminData, ApiKeyMappingPolicy, ApiKeySummary, MappingPolicy } from "@/lib/api"
import { NEW_SIDEBAR_ITEM_ID } from "@/stores/admin-store"

import {
  DangerAction,
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
  if (!data) return <EmptyResourcePage message="Loading API key details." />
  if (selectedItemId === NEW_SIDEBAR_ITEM_ID)
    return <ApiKeyPageContent key="new-api-key" data={data} isFetching={isFetching} onRefresh={onRefresh} />
  const item = getSelectedItem(data.apiKeys, selectedItemId)
  if (!item) return <EmptyResourcePage message="Create or select an API key from the sidebar." />
  return <ApiKeyPageContent key={item.id} data={data} isFetching={isFetching} item={item} onRefresh={onRefresh} />
}

function ApiKeyPageContent({
  data, isFetching, item, onRefresh,
}: { data: AdminData; isFetching: boolean; item?: ApiKeySummary; onRefresh: () => void }) {
  const [draft, setDraft] = useState<ApiKeyDraft>(() => createApiKeyDraft(item))
  const [policyToAddId, setPolicyToAddId] = useState("")
  const [notice, setNotice] = useState("")
  const createApiKeyMutation = useCreateApiKey()
  const attachPolicyMutation = useAttachApiKeyMappingPolicy()
  const detachPolicyMutation = useDetachApiKeyMappingPolicy()

  const availablePolicies = attachablePolicies(data, draft)
  const effectivePolicyToAddId = policyToAddId || availablePolicies[0]?.id || ""
  const isNew = !item

  async function handleSave() {
    if (!isNew) return
    try {
      const result = await createApiKeyMutation.mutateAsync({ key_name: draft.key_name.trim() || "New API Key" })
      setNotice(`API key created! Copy your key now: ${result.plaintext_api_key}`)
      onRefresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to create API key.")
    }
  }

  async function addMappingPolicy() {
    const policy = data.policies.find((c) => c.id === effectivePolicyToAddId)
    if (!policy) return
    if (item) {
      try {
        await attachPolicyMutation.mutateAsync({ apiKeyId: item.id, input: { mapping_policy_id: policy.id } })
        setNotice(`Policy "${policy.epichust_model_name}" attached.`)
        setPolicyToAddId("")
        onRefresh()
      } catch (error) { setNotice(error instanceof Error ? error.message : "Failed to attach.") }
      return
    }
    const mp: ApiKeyMappingPolicy = {
      enabled: true, mapping_policy_id: policy.id,
      epichust_model_id: policy.epichust_model_id, epichust_model_name: policy.epichust_model_name,
      routing_strategy: policy.routing_strategy,
      rate_limit_rules: (policy.rate_limit_rules ?? []).map((r) => ({ ...r })),
      routes: policy.routes.map((r) => ({ ...r })),
    }
    setDraft((c) => ({ ...c, mappingPolicies: [...c.mappingPolicies, mp] }))
    setPolicyToAddId("")
    setNotice("Mapping policy added to draft.")
  }

  async function removeMappingPolicy(policyId: string) {
    if (item) {
      try {
        await detachPolicyMutation.mutateAsync({ apiKeyId: item.id, mappingPolicyId: policyId })
        setNotice("Policy detached."); onRefresh()
      } catch (error) { setNotice(error instanceof Error ? error.message : "Failed to detach.") }
      return
    }
    setDraft((c) => ({ ...c, mappingPolicies: c.mappingPolicies.filter((mp) => mp.mapping_policy_id !== policyId) }))
    setNotice("Mapping policy removed from draft.")
  }

  return (
    <ResourcePageFrame variant="key">
      <ResourcePageHeader
        description={item ? `Hash prefix ${item.key_hash_prefix}` : "New API key draft"}
        icon={KeyRound}
        isFetching={isFetching}
        status={draft.enabled ? "enabled" : "disabled"}
        title={draft.key_name || "New API Key"}
        onRefresh={onRefresh}
      />

      {/* ── Status Part ── */}
      <ResourceCard title="Status">
        <div className="resource-status-grid">
          <div className="resource-field">
            <Label htmlFor="key-name">Name</Label>
            <Input id="key-name" value={draft.key_name}
              onChange={(e) => setDraft((c) => ({ ...c, key_name: e.target.value }))} />
          </div>
          <div className="resource-field">
            <Label htmlFor="key-enabled">Enabled</Label>
            <select id="key-enabled" className="resource-select" value={draft.enabled ? "true" : "false"}
              onChange={(e) => setDraft((c) => ({ ...c, enabled: e.target.value === "true" }))}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </div>
          {item ? (
            <>
              <ReadOnlyField label="Hash prefix" value={item.key_hash_prefix} />
              <ReadOnlyField label="Key ID" value={item.id} />
              <ReadOnlyField label="Last used" value={formatDate(item.last_used_at)} />
              <ReadOnlyField label="Created" value={formatDate(item.created_at)} />
            </>
          ) : (
            <ReadOnlyField label="Mode" value="New draft" />
          )}
        </div>
      </ResourceCard>

      {/* ── Config Part: Mapping Policies ── */}
      <ResourceCard title="Attached Mapping Policies">
        <div className="resource-config-list">
          {draft.mappingPolicies.map((mp) => (
            <LongItem key={mp.mapping_policy_id}>
              <LongItemIcon><Layers3 className="icon-sm" /></LongItemIcon>
              <LongItemBody>
                <LongItemTitle>{mp.epichust_model_name}</LongItemTitle>
                <LongItemSubtitle>
                  {mp.routing_strategy} · {mp.routes.length} routes · {mp.rate_limit_rules.length} rules
                </LongItemSubtitle>
              </LongItemBody>
              <Badge variant={mp.enabled ? "default" : "secondary"}>{mp.enabled ? "on" : "off"}</Badge>
              <LongItemActions>
                <Button size="sm" variant="ghost" onClick={() => removeMappingPolicy(mp.mapping_policy_id)}>
                  <Trash2 className="icon-sm" /> Remove
                </Button>
              </LongItemActions>
            </LongItem>
          ))}
          {draft.mappingPolicies.length === 0 && <EmptyBlock>No mapping policies attached.</EmptyBlock>}
        </div>
        <div className="resource-config-footer">
          <select className="resource-select" disabled={availablePolicies.length === 0}
            value={effectivePolicyToAddId} onChange={(e) => setPolicyToAddId(e.target.value)}>
            {availablePolicies.length > 0 ? (
              availablePolicies.map((p) => <option key={p.id} value={p.id}>{p.epichust_model_name} ({p.routing_strategy})</option>)
            ) : (<option value="">All policies attached</option>)}
          </select>
          <Button variant="outline" size="sm" disabled={!effectivePolicyToAddId} onClick={addMappingPolicy}>
            <Plus className="icon-sm" /> Attach policy
          </Button>
        </div>
      </ResourceCard>

      {/* ── Danger Zone ── */}
      {item && (
        <DangerAction
          action={<Button className="resource-danger-button" disabled={!draft.enabled} variant="outline"
            onClick={() => { setDraft((c) => ({ ...c, enabled: false })); setNotice("Revoke queued.") }}>
            <Ban className="icon-sm" /> Revoke</Button>}
          badge="special action"
          description="Enabled changes to false in the current draft."
          title="Revoke API key" />
      )}

      <ResourceActions>
        <Button variant="outline" onClick={() => { setDraft(createApiKeyDraft(item)); setNotice("Draft reset.") }}>
          <RotateCcw className="icon-sm" /> Reset
        </Button>
        {isNew ? (
          <Button disabled={createApiKeyMutation.isPending} onClick={handleSave}>
            {createApiKeyMutation.isPending ? <Loader2 className="icon-sm refresh-icon-busy" /> : <Save className="icon-sm" />}
            {createApiKeyMutation.isPending ? "Saving…" : "Create API key"}
          </Button>
        ) : (
          <Button onClick={() => setNotice("Draft staged locally.")}>
            <Save className="icon-sm" /> Save draft
          </Button>
        )}
      </ResourceActions>
      {notice && <ResourceNotice>{notice}</ResourceNotice>}
    </ResourcePageFrame>
  )
}

function createApiKeyDraft(item?: ApiKeySummary): ApiKeyDraft {
  if (!item) return { enabled: true, key_name: "", mappingPolicies: [] }
  return {
    enabled: item.enabled, key_name: item.key_name,
    mappingPolicies: item.mapping_policies.map((mp) => ({
      ...mp, rate_limit_rules: (mp.rate_limit_rules ?? []).map((r) => ({ ...r })),
      routes: mp.routes.map((r) => ({ ...r })),
    })),
  }
}

export { ApiKeyPage }
