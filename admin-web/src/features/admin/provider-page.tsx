import { useEffect, useState } from "react"
import { Database, Download, Loader2, Save, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { InputModal } from "@/components/ui/add-item-modal"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  useCreateProvider,
  useCreateProviderModel,
  useDeleteProvider,
  useDeleteProviderModel,
  useUpdateProvider,
} from "@/hooks/use-admin-data"
import { getProviderAvailableModels } from "@/lib/api"
import type { AdminData, ProviderModel, ProviderSummary } from "@/lib/api"
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

type ProviderPageProps = {
  data: AdminData | undefined
  isFetching: boolean
  selectedItemId: string
  onRefresh: () => void
}

type ProviderDraft = {
  provider_base_url: string
  provider_key: string
  provider_name: string
  providerModels: ProviderModel[]
}

function ProviderPage({ data, isFetching, selectedItemId, onRefresh }: ProviderPageProps) {
  if (!data) return <EmptyResourcePage message="Loading provider details." />
  if (selectedItemId === NEW_SIDEBAR_ITEM_ID)
    return <ProviderPageContent key="new-provider" data={data} isFetching={isFetching} onRefresh={onRefresh} />
  const item = getSelectedItem(data.providers, selectedItemId)
  if (!item) return <EmptyResourcePage message="Create or select a provider from the sidebar." />
  return <ProviderPageContent key={item.id} data={data} isFetching={isFetching} item={item} onRefresh={onRefresh} />
}

function ProviderPageContent({
  data, isFetching, item, onRefresh,
}: { data: AdminData; isFetching: boolean; item?: ProviderSummary; onRefresh: () => void }) {
  const [draft, setDraft] = useState<ProviderDraft>(() => createProviderDraft(item, data))
  const [showModelModal, setShowModelModal] = useState(false)
  const [notice, setNoticeState] = useState("")
  const toast = useToast()
  const setNotice = (message: string) => {
    setNoticeState(message)
    toast.auto(message)
  }
  const [fetching, setFetching] = useState(false)
  const [fetchedOnce, setFetchedOnce] = useState(false)
  const createProviderMutation = useCreateProvider()
  const createProviderModelMutation = useCreateProviderModel()
  const deleteProviderMutation = useDeleteProvider()
  const deleteProviderModelMutation = useDeleteProviderModel()
  const updateProviderMutation = useUpdateProvider()
  const isNew = !item

  async function handleUpdate() {
    if (!item) return
    try {
      await updateProviderMutation.mutateAsync({
        id: item.id,
        input: {
          provider_name: draft.provider_name.trim() || item.provider_name,
          provider_base_url: draft.provider_base_url.trim(),
          provider_key: draft.provider_key.trim() || undefined,
        },
      })
      setNotice("Provider saved.")
      onRefresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to save provider.")
    }
  }

  async function removeProviderModel(model: ProviderModel) {
    // Persisted model → delete via API (cascades its policy routes);
    // unsaved draft model (new provider) → just drop locally.
    if (item && !model.id.startsWith("draft_")) {
      try {
        await deleteProviderModelMutation.mutateAsync(model.id)
        setDraft((c) => ({
          ...c,
          providerModels: c.providerModels.filter((m) => m.id !== model.id),
        }))
        setNotice(`Model "${model.model_name}" deleted.`)
        onRefresh()
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "Delete failed.")
      }
      return
    }
    setDraft((c) => ({
      ...c,
      providerModels: c.providerModels.filter((m) => m.id !== model.id),
    }))
  }

  useEffect(() => {
    if (item && draft.providerModels.length === 0 && !fetchedOnce) {
      setFetchedOnce(true)
      doFetchModels()
    }
  }, [item?.id])

  async function doFetchModels() {
    setFetching(true)
    try {
      let providerId = item?.id

      // If new provider, save it first so we have an ID
      if (!providerId) {
        const result = await createProviderMutation.mutateAsync({
          provider_name: draft.provider_name.trim() || "New Provider",
          provider_base_url: draft.provider_base_url.trim(),
          provider_key: draft.provider_key,
        })
        providerId = result.provider.id
        setNotice(`Provider "${result.provider.provider_name}" created.`)
      }

      const result = await getProviderAvailableModels(providerId)
      let added = 0
      for (const m of result.models) {
        try {
          const pm = await createProviderModelMutation.mutateAsync({ model_name: m.model_name, provider_id: providerId })
          setDraft((c) => ({ ...c, providerModels: c.providerModels.some((x) => x.id === pm.id) ? c.providerModels.map((x) => x.id === pm.id ? pm : x) : [...c.providerModels, pm] }))
          added++
        } catch { /* duplicate */ }
      }
      setNotice(`Fetched ${result.models.length} upstream models, registered ${added} new.`)
      onRefresh()
    } catch (error) { setNotice(error instanceof Error ? error.message : "Fetch failed.") }
    finally { setFetching(false) }
  }

  async function handleSave() {
    if (!isNew) return
    try {
      const result = await createProviderMutation.mutateAsync({
        provider_name: draft.provider_name.trim() || "New Provider",
        provider_base_url: draft.provider_base_url.trim(),
        provider_key: draft.provider_key,
      })
      setNotice(`Provider "${result.provider.provider_name}" created.`)
      onRefresh()
    } catch (error) { setNotice(error instanceof Error ? error.message : "Failed to create provider.") }
  }

  async function addProviderModel(modelName: string) {
    if (item) {
      try {
        const pm = await createProviderModelMutation.mutateAsync({ model_name: modelName, provider_id: item.id })
        setDraft((c) => ({ ...c, providerModels: c.providerModels.some((x) => x.id === pm.id) ? c.providerModels.map((x) => x.id === pm.id ? pm : x) : [...c.providerModels, pm] }))
        setNotice(`Model "${pm.model_name}" added.`)
        onRefresh()
      } catch (error) { setNotice(error instanceof Error ? error.message : "Failed to add model.") }
      return
    }
    const pm: ProviderModel = { id: `draft_${Date.now()}`, provider_id: "draft", model_name: modelName, created_at: new Date().toISOString() }
    setDraft((c) => ({ ...c, providerModels: [...c.providerModels, pm] }))
    setNotice("Model added to draft.")
  }

  const modelsForProvider = data.providerModels.filter((m) => m.provider_id === (item?.id ?? ""))

  return (
    <ResourcePageFrame variant="provider">
      <ResourcePageHeader
        actions={
          <>
            {!isNew ? (
              <Button variant="ghost" disabled={deleteProviderMutation.isPending} onClick={async () => {
                if (!item) return
                try {
                  await deleteProviderMutation.mutateAsync(item.id)
                  setNotice("Provider deleted.")
                  onRefresh()
                } catch (e) { setNotice(e instanceof Error ? e.message : "Delete failed.") }
              }}>
                {deleteProviderMutation.isPending ? <Loader2 className="icon-sm refresh-icon-busy" /> : <Trash2 className="icon-sm" />}
                Delete
              </Button>
            ) : null}
            {isNew ? (
              <Button disabled={createProviderMutation.isPending} onClick={handleSave}>
                {createProviderMutation.isPending ? <Loader2 className="icon-sm refresh-icon-busy" /> : <Save className="icon-sm" />}
                {createProviderMutation.isPending ? "Saving…" : "Create"}
              </Button>
            ) : (
              <Button disabled={updateProviderMutation.isPending} onClick={handleUpdate}>
                {updateProviderMutation.isPending ? <Loader2 className="icon-sm refresh-icon-busy" /> : <Save className="icon-sm" />}
                Save
              </Button>
            )}
          </>
        }
        description={draft.provider_base_url || "New provider draft"}
        icon={Database}
        isFetching={isFetching}
        title={draft.provider_name || "New Provider"}
        onRefresh={onRefresh}
      />

      {/* ── Status Part ── */}
      <ResourceCard title="Status">
        <div className="resource-status-grid">
          <div className="resource-field">
            <Label htmlFor="provider-name">Name</Label>
            <Input id="provider-name" value={draft.provider_name}
              onChange={(e) => setDraft((c) => ({ ...c, provider_name: e.target.value }))} />
          </div>
          <div className="resource-field resource-field-wide">
            <Label htmlFor="provider-base-url">Base URL</Label>
            <Input id="provider-base-url" value={draft.provider_base_url}
              onChange={(e) => setDraft((c) => ({ ...c, provider_base_url: e.target.value }))} />
          </div>
          {!item ? (
            <div className="resource-field resource-field-wide">
              <Label htmlFor="provider-key">Provider key</Label>
              <Input id="provider-key" type="password" value={draft.provider_key}
                onChange={(e) => setDraft((c) => ({ ...c, provider_key: e.target.value }))} />
            </div>
          ) : (
            <>
              <ReadOnlyField label="Provider ID" value={item.id} />
              <ReadOnlyField label="Models" value={`${modelsForProvider.length} registered`} />
              <ReadOnlyField label="Policies" value={item.policy_count.toString()} />
              <ReadOnlyField label="Created" value={formatDate(item.created_at)} />
            </>
          )}
        </div>
      </ResourceCard>

      {/* ── Provider Models ── */}
      <SubItemList
        title="Provider Models"
        addLabel="Add model"
        onAdd={() => setShowModelModal(true)}
        footer={
          <Button variant="outline" size="sm" disabled={fetching} onClick={doFetchModels}>
            <Download className={`icon-sm ${fetching ? "refresh-icon-busy" : ""}`} />
            {fetching ? "Fetching…" : "Fetch upstream"}
          </Button>
        }
      >
        {draft.providerModels.map((model) => (
          <SubItemRow
            key={model.id}
            icon={Database}
            title={model.model_name}
            subtitle={formatDate(model.created_at)}
            actions={
              <span
                className="sub-item-action"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); removeProviderModel(model) } }}
                onClick={(e) => { e.stopPropagation(); removeProviderModel(model) }}
              >
                <Trash2 className="icon-sm" /> Delete
              </span>
            }
          />
        ))}
      </SubItemList>

      {notice && <ResourceNotice>{notice}</ResourceNotice>}

      <InputModal
        label="Model name"
        open={showModelModal}
        placeholder="e.g. gpt-4o"
        title="Add Provider Model"
        onClose={() => setShowModelModal(false)}
        onConfirm={(name) => { addProviderModel(name); setShowModelModal(false) }}
      />
    </ResourcePageFrame>
  )
}

function createProviderDraft(item: ProviderSummary | undefined, data: AdminData): ProviderDraft {
  if (!item) return { provider_base_url: "", provider_key: "", provider_name: "", providerModels: [] }
  return {
    provider_base_url: item.provider_base_url, provider_key: "", provider_name: item.provider_name,
    providerModels: data.providerModels.filter((m) => m.provider_id === item.id).map((m) => ({ ...m })),
  }
}

export { ProviderPage }
