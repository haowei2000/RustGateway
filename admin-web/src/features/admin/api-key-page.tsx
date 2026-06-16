import { useState } from "react"
import { BookOpen, Copy, KeyRound, Layers3, Loader2, RefreshCw, Save, Trash2, X } from "lucide-react"

import { AddItemModal } from "@/components/ui/add-item-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  useAttachApiKeyMappingPolicy,
  useCreateApiKey,
  useDeleteApiKey,
  useDetachApiKeyMappingPolicy,
  useRotateApiKey,
} from "@/hooks/use-admin-data"
import type { AdminData, ApiKeyMappingPolicy, ApiKeySummary, MappingPolicy } from "@/lib/api"
import { NEW_SIDEBAR_ITEM_ID, useAdminStore } from "@/stores/admin-store"

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
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const [showDocsModal, setShowDocsModal] = useState(false)
  const [notice, setNotice] = useState("")
  const [docsKey, setDocsKey] = useState("")
  const createApiKeyMutation = useCreateApiKey()
  const attachPolicyMutation = useAttachApiKeyMappingPolicy()
  const detachPolicyMutation = useDetachApiKeyMappingPolicy()
  const deleteApiKeyMutation = useDeleteApiKey()
  const rotateApiKeyMutation = useRotateApiKey()

  async function handleRotateKey() {
    if (!item) return
    try {
      const result = await rotateApiKeyMutation.mutateAsync(item.id)
      setDocsKey(result.plaintext_api_key)
      setNotice(`Key rotated! New key: ${result.plaintext_api_key}`)
      onRefresh()
    } catch (e) { setNotice(e instanceof Error ? e.message : "Rotate failed.") }
  }
  const { setSidebarResource, setSelectedSidebarItemId } = useAdminStore()

  function navigateToPolicy(policyId: string) {
    setSidebarResource("policies")
    setSelectedSidebarItemId(policyId)
  }

  const availablePolicies = attachablePolicies(data, draft)
  const isNew = !item

  async function handleSave() {
    if (!isNew) return
    try {
      const result = await createApiKeyMutation.mutateAsync({ key_name: draft.key_name.trim() || "New API Key" })
      setDocsKey(result.plaintext_api_key)
      setNotice(`API key created! Copy your key now: ${result.plaintext_api_key}`)
      onRefresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to create API key.")
    }
  }

  async function handleAttachPolicies(selectedIds: string[]) {
    for (const policyId of selectedIds) {
      const policy = data.policies.find((c) => c.id === policyId)
      if (!policy) continue
      if (item) {
        try {
          await attachPolicyMutation.mutateAsync({ apiKeyId: item.id, input: { mapping_policy_id: policy.id } })
        } catch { /* skip duplicates */ }
        continue
      }
      const mp: ApiKeyMappingPolicy = {
        enabled: true, mapping_policy_id: policy.id,
        epichust_model_id: policy.epichust_model_id, epichust_model_name: policy.epichust_model_name,
        routing_strategy: policy.routing_strategy,
        rate_limit_rules: (policy.rate_limit_rules ?? []).map((r) => ({ ...r })),
        routes: policy.routes.map((r) => ({ ...r })),
      }
      setDraft((c) => ({ ...c, mappingPolicies: [...c.mappingPolicies, mp] }))
    }
    if (item) onRefresh()
    setShowPolicyModal(false)
    setNotice(selectedIds.length > 0 ? `${selectedIds.length} policy attached.` : "")
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
        actions={
          <>
            {(docsKey || !isNew) ? (
              <Button variant="outline" size="sm" onClick={() => setShowDocsModal(true)}>
                <BookOpen className="icon-sm" /> Docs
              </Button>
            ) : null}
            {!isNew ? (
              <Button variant="ghost" disabled={deleteApiKeyMutation.isPending} onClick={async () => {
                if (!item) return
                try {
                  await deleteApiKeyMutation.mutateAsync(item.id)
                  setNotice("API key deleted.")
                  onRefresh()
                } catch (e) { setNotice(e instanceof Error ? e.message : "Delete failed.") }
              }}>
                {deleteApiKeyMutation.isPending ? <Loader2 className="icon-sm refresh-icon-busy" /> : <Trash2 className="icon-sm" />}
                Delete
              </Button>
            ) : null}
            {isNew ? (
              <Button disabled={createApiKeyMutation.isPending} onClick={handleSave}>
                {createApiKeyMutation.isPending ? <Loader2 className="icon-sm refresh-icon-busy" /> : <Save className="icon-sm" />}
                {createApiKeyMutation.isPending ? "Saving…" : "Create"}
              </Button>
            ) : (
              <Button onClick={() => setNotice("Draft staged locally.")}>
                <Save className="icon-sm" /> Save
              </Button>
            )}
          </>
        }
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
        {item ? (
          <div className="resource-actions" style={{ marginTop: "0.75rem" }}>
            <Button variant="outline" size="sm" disabled={rotateApiKeyMutation.isPending} onClick={handleRotateKey}>
              <RefreshCw className={`icon-sm ${rotateApiKeyMutation.isPending ? "refresh-icon-busy" : ""}`} /> Refresh key
            </Button>
          </div>
        ) : null}
      </ResourceCard>

      {/* ── Policies ── */}
      <SubItemList
        title="Policies"
        addLabel="Attach policy"
        onAdd={() => setShowPolicyModal(true)}
      >
        {draft.mappingPolicies.map((mp) => {
          const policyExists = data.policies.some((p) => p.id === mp.mapping_policy_id)
          return (
            <SubItemRow
              key={mp.mapping_policy_id}
              icon={Layers3}
              title={mp.epichust_model_name}
              onClick={policyExists ? () => navigateToPolicy(mp.mapping_policy_id) : undefined}
              actions={
                <span
                  className="sub-item-action"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); removeMappingPolicy(mp.mapping_policy_id) } }}
                  onClick={(e) => { e.stopPropagation(); removeMappingPolicy(mp.mapping_policy_id) }}
                >
                  <Trash2 className="icon-sm" /> Unattach
                </span>
              }
            />
          )
        })}
      </SubItemList>

      {notice && <ResourceNotice>{notice}</ResourceNotice>}

      <AddItemModal
        confirmLabel="Attach selected"
        emptyText="All policies already attached."
        items={availablePolicies.map((p) => ({
          id: p.id,
          label: p.epichust_model_name,
          subtitle: p.routing_strategy,
        }))}
        open={showPolicyModal}
        title="Attach Policies"
        onClose={() => setShowPolicyModal(false)}
        onConfirm={handleAttachPolicies}
      />

      {showDocsModal ? (() => {
        const key = docsKey || "<your-api-key>"
        const model = draft.mappingPolicies[0]?.epichust_model_name || "your-model-name"
        const curlCmd = `curl -X POST http://localhost:8080/v1/chat/completions \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${model}",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`

        return (
        <div className="modal-overlay" onClick={() => setShowDocsModal(false)}>
          <div className="modal-card" style={{ maxWidth: "42rem" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">API Docs</h3>
              <button className="modal-close-button" type="button" onClick={() => setShowDocsModal(false)}>
                <X className="icon-sm" />
              </button>
            </div>
            <div className="modal-body" style={{ padding: "0 1rem 1rem" }}>
              {!docsKey ? (
                <p style={{ margin: "0 0 0.75rem", padding: "0.5rem 0.75rem", fontSize: "0.8125rem", background: "var(--muted)", borderRadius: "var(--radius-md)", color: "var(--muted-foreground)" }}>
                  Replace <code style={{ fontSize: "0.8125rem" }}>&lt;your-api-key&gt;</code> with the plaintext key obtained at creation time.
                </p>
              ) : null}
              <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
                Use the key below to call the gateway Chat Completions endpoint:
              </p>
              <div style={{ position: "relative" }}>
                <pre style={{
                  margin: 0,
                  padding: "1rem",
                  background: "var(--muted)",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.8125rem",
                  lineHeight: 1.6,
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}>{curlCmd}</pre>
                <button
                  className="modal-close-button"
                  style={{ position: "absolute", top: "0.5rem", right: "0.5rem" }}
                  type="button"
                  onClick={() => { navigator.clipboard.writeText(curlCmd) }}
                >
                  <Copy className="icon-sm" />
                </button>
              </div>
            </div>
          </div>
        </div>
        )
      })() : null}
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
