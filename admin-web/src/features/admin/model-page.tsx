import { useState } from "react"
import { Layers3, Loader2, Save, Shuffle, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useCreateEpichustModel, useDeleteEpichustModel } from "@/hooks/use-admin-data"
import type { AdminData, EpichustModel, ModelType } from "@/lib/api"
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

type ModelPageProps = {
  data: AdminData | undefined
  isFetching: boolean
  selectedItemId: string
  onRefresh: () => void
}

type ModelDraft = { model_name: string; model_type: ModelType }

function ModelPage({ data, isFetching, selectedItemId, onRefresh }: ModelPageProps) {
  if (!data) return <EmptyResourcePage message="Loading model details." />
  if (selectedItemId === NEW_SIDEBAR_ITEM_ID)
    return <ModelPageContent key="new-model" data={data} isFetching={isFetching} onRefresh={onRefresh} />
  const item = getSelectedItem(data.models, selectedItemId)
  if (!item) return <EmptyResourcePage message="Create or select a model from the sidebar." />
  return <ModelPageContent key={item.id} data={data} isFetching={isFetching} item={item} onRefresh={onRefresh} />
}

function ModelPageContent({
  data, isFetching, item, onRefresh,
}: { data: AdminData; isFetching: boolean; item?: EpichustModel; onRefresh: () => void }) {
  const [draft, setDraft] = useState<ModelDraft>(() => createModelDraft(item))
  const [notice, setNotice] = useState("")
  const createMutation = useCreateEpichustModel()
  const deleteMutation = useDeleteEpichustModel()
  const isNew = !item
  const { setSidebarResource, setSelectedSidebarItemId } = useAdminStore()

  const modelPolicies = item ? data.policies.filter((p) => p.epichust_model_id === item.id) : []

  function navigateToPolicy(policyId: string) {
    setSidebarResource("routes")
    setSelectedSidebarItemId(policyId)
  }

  async function handleSave() {
    if (!isNew) return
    try {
      const created = await createMutation.mutateAsync({
        model_name: draft.model_name.trim() || "epichust-chat",
        model_type: draft.model_type,
      })
      setNotice(`Model "${created.model_name}" created.`)
      onRefresh()
    } catch (error) { setNotice(error instanceof Error ? error.message : "Failed to create model.") }
  }

  return (
    <ResourcePageFrame variant="model">
      <ResourcePageHeader
        actions={
          <>
            {!isNew ? (
              <Button variant="ghost" disabled={deleteMutation.isPending} onClick={async () => {
                if (!item) return
                try {
                  await deleteMutation.mutateAsync(item.id)
                  setNotice("Model deleted.")
                  onRefresh()
                } catch (e) { setNotice(e instanceof Error ? e.message : "Delete failed.") }
              }}>
                {deleteMutation.isPending ? <Loader2 className="icon-sm refresh-icon-busy" /> : <Trash2 className="icon-sm" />}
                Delete
              </Button>
            ) : null}
            {isNew ? (
              <Button disabled={createMutation.isPending} onClick={handleSave}>
                {createMutation.isPending ? <Loader2 className="icon-sm refresh-icon-busy" /> : <Save className="icon-sm" />}
                {createMutation.isPending ? "Saving…" : "Create"}
              </Button>
            ) : (
              <Button onClick={() => setNotice("Draft staged locally.")}>
                <Save className="icon-sm" /> Save
              </Button>
            )}
          </>
        }
        description={draft.model_type}
        icon={Layers3}
        isFetching={isFetching}
        status={draft.model_type}
        statusVariant="outline"
        title={draft.model_name || "New Model"}
        onRefresh={onRefresh}
      />

      {/* ── Status Part ── */}
      <ResourceCard title="Status">
        <div className="resource-status-grid">
          <div className="resource-field">
            <Label htmlFor="model-name">Name</Label>
            <Input id="model-name" value={draft.model_name}
              onChange={(e) => setDraft((c) => ({ ...c, model_name: e.target.value }))} />
          </div>
          <div className="resource-field">
            <Label htmlFor="model-type">Type</Label>
            <select id="model-type" className="resource-select" value={draft.model_type}
              onChange={(e) => setDraft((c) => ({ ...c, model_type: e.target.value as ModelType }))}>
              <option value="chat_model">chat_model</option>
              <option value="embedding_model">embedding_model</option>
            </select>
          </div>
          {item ? (
            <>
              <ReadOnlyField label="Model ID" value={item.id} />
              <ReadOnlyField label="Created" value={formatDate(item.created_at)} />
            </>
          ) : (
            <ReadOnlyField label="Mode" value="New draft" />
          )}
        </div>
      </ResourceCard>

      {/* ── Policies ── */}
      <SubItemList
        title={`Policies (${modelPolicies.length})`}
      >
        {modelPolicies.map((policy) => {
          const rulesInfo = policy.rate_limit_rules.length > 0
            ? ` · ${policy.rate_limit_rules.map((r) => `${r.limit_type}: ${r.limit_value}`).join(", ")}`
            : ""
          return (
            <SubItemRow
              key={policy.id}
              icon={Shuffle}
              title={policy.routing_strategy}
              subtitle={`${policy.routes.length} routes · ${policy.rate_limit_rules.length} rules${rulesInfo}`}
              onClick={() => navigateToPolicy(policy.id)}
            />
          )
        })}
      </SubItemList>

      {notice && <ResourceNotice>{notice}</ResourceNotice>}
    </ResourcePageFrame>
  )
}

function createModelDraft(item?: EpichustModel): ModelDraft {
  if (!item) return { model_name: "", model_type: "chat_model" }
  return { model_name: item.model_name, model_type: item.model_type }
}

export { ModelPage }
