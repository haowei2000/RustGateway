import { useEffect, useState } from "react"
import { Database, Download, Loader2, Plus, RotateCcw, Save, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  LongItem,
  LongItemActions,
  LongItemBody,
  LongItemIcon,
  LongItemSubtitle,
  LongItemTitle,
} from "@/components/ui/item"
import { useCreateProvider, useCreateProviderModel } from "@/hooks/use-admin-data"
import { getProviderAvailableModels } from "@/lib/api"
import type { AdminData, ProviderModel, ProviderSummary } from "@/lib/api"
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
  const [newProviderModelName, setNewProviderModelName] = useState("")
  const [notice, setNotice] = useState("")
  const [fetching, setFetching] = useState(false)
  const [fetchedOnce, setFetchedOnce] = useState(false)
  const createProviderMutation = useCreateProvider()
  const createProviderModelMutation = useCreateProviderModel()
  const isNew = !item

  useEffect(() => {
    if (item && draft.providerModels.length === 0 && !fetchedOnce) {
      setFetchedOnce(true)
      doFetchModels()
    }
  }, [item?.id])

  async function doFetchModels() {
    if (!item) return
    setFetching(true)
    try {
      const result = await getProviderAvailableModels(item.id)
      let added = 0
      for (const m of result.models) {
        try {
          const pm = await createProviderModelMutation.mutateAsync({ model_name: m.model_name, provider_id: item.id })
          setDraft((c) => ({ ...c, providerModels: c.providerModels.some((x) => x.id === pm.id) ? c.providerModels.map((x) => x.id === pm.id ? pm : x) : [...c.providerModels, pm] }))
          added++
        } catch { /* duplicate */ }
      }
      setNotice(`Fetched ${result.models.length} models, registered ${added} new.`)
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

  async function addProviderModel() {
    const modelName = newProviderModelName.trim()
    if (!modelName) { setNotice("Enter a model name."); return }
    if (item) {
      try {
        const pm = await createProviderModelMutation.mutateAsync({ model_name: modelName, provider_id: item.id })
        setDraft((c) => ({ ...c, providerModels: c.providerModels.some((x) => x.id === pm.id) ? c.providerModels.map((x) => x.id === pm.id ? pm : x) : [...c.providerModels, pm] }))
        setNewProviderModelName("")
        setNotice(`Model "${pm.model_name}" added.`)
        onRefresh()
      } catch (error) { setNotice(error instanceof Error ? error.message : "Failed to add model.") }
      return
    }
    const pm: ProviderModel = { id: `draft_${Date.now()}`, provider_id: "draft", model_name: modelName, created_at: new Date().toISOString() }
    setDraft((c) => ({ ...c, providerModels: [...c.providerModels, pm] }))
    setNewProviderModelName("")
    setNotice("Model added to draft.")
  }

  const modelsForProvider = data.providerModels.filter((m) => m.provider_id === (item?.id ?? ""))

  return (
    <ResourcePageFrame variant="provider">
      <ResourcePageHeader
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

      {/* ── Config Part: Provider Models ── */}
      <ResourceCard title="Provider Models">
        <div className="resource-config-list">
          {draft.providerModels.map((model) => (
            <LongItem key={model.id}>
              <LongItemIcon><Database className="icon-sm" /></LongItemIcon>
              <LongItemBody>
                <LongItemTitle>{model.model_name}</LongItemTitle>
                <LongItemSubtitle>{formatDate(model.created_at)}</LongItemSubtitle>
              </LongItemBody>
              <LongItemActions>
                <Button size="sm" variant="ghost"
                  onClick={() => setDraft((c) => ({ ...c, providerModels: c.providerModels.filter((m) => m.id !== model.id) }))}>
                  <Trash2 className="icon-sm" /> Remove
                </Button>
              </LongItemActions>
            </LongItem>
          ))}
          {draft.providerModels.length === 0 && <EmptyBlock>No provider models. Fetch from upstream or add manually.</EmptyBlock>}
        </div>
        <div className="resource-config-footer">
          <Input placeholder="model-name" value={newProviderModelName}
            onChange={(e) => setNewProviderModelName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addProviderModel() }} />
          <Button variant="outline" size="sm" disabled={createProviderModelMutation.isPending}
            onClick={addProviderModel}>
            <Plus className="icon-sm" /> Add
          </Button>
          {item && (
            <Button variant="outline" size="sm" disabled={fetching} onClick={doFetchModels}>
              <Download className={`icon-sm ${fetching ? "refresh-icon-busy" : ""}`} />
              {fetching ? "Fetching…" : "Fetch upstream"}
            </Button>
          )}
        </div>
      </ResourceCard>

      <ResourceActions>
        <Button variant="outline" onClick={() => { setDraft(createProviderDraft(item, data)); setNotice("Draft reset.") }}>
          <RotateCcw className="icon-sm" /> Reset
        </Button>
        {isNew ? (
          <Button disabled={createProviderMutation.isPending} onClick={handleSave}>
            {createProviderMutation.isPending ? <Loader2 className="icon-sm refresh-icon-busy" /> : <Save className="icon-sm" />}
            {createProviderMutation.isPending ? "Saving…" : "Create provider"}
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

function createProviderDraft(item: ProviderSummary | undefined, data: AdminData): ProviderDraft {
  if (!item) return { provider_base_url: "", provider_key: "", provider_name: "", providerModels: [] }
  return {
    provider_base_url: item.provider_base_url, provider_key: "", provider_name: item.provider_name,
    providerModels: data.providerModels.filter((m) => m.provider_id === item.id).map((m) => ({ ...m })),
  }
}

export { ProviderPage }
