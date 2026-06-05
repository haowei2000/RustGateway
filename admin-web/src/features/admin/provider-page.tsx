import { useState } from "react"
import { Check, Database, Pencil, Plus, RotateCcw, Save } from "lucide-react"

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
import { useCreateProviderModel } from "@/hooks/use-admin-data"
import type { AdminData, ProviderModel, ProviderSummary } from "@/lib/api"
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
  if (!data) {
    return <EmptyResourcePage message="Loading provider details." />
  }

  if (selectedItemId === NEW_SIDEBAR_ITEM_ID) {
    return (
      <ProviderPageContent
        key="new-provider"
        data={data}
        isFetching={isFetching}
        onRefresh={onRefresh}
      />
    )
  }

  const item = getSelectedItem(data.providers, selectedItemId)
  if (!item) {
    return <EmptyResourcePage message="Create or select a provider from the sidebar." />
  }

  return (
    <ProviderPageContent
      key={item.id}
      data={data}
      isFetching={isFetching}
      item={item}
      onRefresh={onRefresh}
    />
  )
}

function ProviderPageContent({
  data,
  isFetching,
  item,
  onRefresh,
}: {
  data: AdminData
  isFetching: boolean
  item?: ProviderSummary
  onRefresh: () => void
}) {
  const [draft, setDraft] = useState<ProviderDraft>(() => createProviderDraft(item, data))
  const [editingModelId, setEditingModelId] = useState("")
  const [newProviderModelName, setNewProviderModelName] = useState("")
  const [notice, setNotice] = useState("")
  const createProviderModelMutation = useCreateProviderModel()

  function updateProviderModel(modelId: string, patch: Partial<ProviderModel>) {
    setDraft((current) => ({
      ...current,
      providerModels: current.providerModels.map((model) =>
        model.id === modelId ? { ...model, ...patch } : model,
      ),
    }))
  }

  async function addProviderModel() {
    const modelName = newProviderModelName.trim()
    if (!modelName) {
      setNotice("Enter a provider model name first.")
      return
    }

    if (item) {
      try {
        const providerModel = await createProviderModelMutation.mutateAsync({
          model_name: modelName,
          provider_id: item.id,
        })

        setDraft((current) => ({
          ...current,
          providerModels: current.providerModels.some((model) => model.id === providerModel.id)
            ? current.providerModels.map((model) =>
                model.id === providerModel.id ? providerModel : model,
              )
            : [...current.providerModels, providerModel],
        }))
        setEditingModelId("")
        setNewProviderModelName("")
        setNotice(`Provider model ${providerModel.model_name} added.`)
        onRefresh()
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Failed to add provider model.")
      }
      return
    }

    const providerModel: ProviderModel = {
      created_at: new Date().toISOString(),
      id: `draft_${Date.now()}`,
      model_name: modelName,
      provider_id: "draft_provider",
    }

    setDraft((current) => ({
      ...current,
      providerModels: [...current.providerModels, providerModel],
    }))
    setEditingModelId(providerModel.id)
    setNewProviderModelName("")
    setNotice("Provider model added to the local draft.")
  }

  return (
    <ResourcePageFrame variant="provider">
      <ResourcePageHeader
        description={draft.provider_base_url || "New provider draft"}
        icon={Database}
        isFetching={isFetching}
        title={draft.provider_name || "New Provider"}
        onRefresh={onRefresh}
      />

      <div className="resource-layout resource-layout-provider">
        <ResourceCard title="Provider Settings">
          <div className="resource-form-grid">
            <div className="resource-field">
              <Label htmlFor="provider-name">Name</Label>
              <Input
                id="provider-name"
                value={draft.provider_name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, provider_name: event.target.value }))
                }
              />
            </div>
            <div className="resource-field resource-field-wide">
              <Label htmlFor="provider-base-url">Base URL</Label>
              <Input
                id="provider-base-url"
                value={draft.provider_base_url}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, provider_base_url: event.target.value }))
                }
              />
            </div>
            {!item ? (
              <div className="resource-field resource-field-wide">
                <Label htmlFor="provider-key">Provider key</Label>
                <Input
                  id="provider-key"
                  type="password"
                  value={draft.provider_key}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, provider_key: event.target.value }))
                  }
                />
              </div>
            ) : (
              <ReadOnlyField label="Provider ID" value={item.id} />
            )}
          </div>
        </ResourceCard>

        <div className="resource-side-stack">
          <ResourceMetrics
            metrics={[
              { label: "Provider Models", value: formatNumber(draft.providerModels.length) },
              { label: "Policies", value: item ? formatNumber(item.policy_count) : "0" },
              { label: "Created", value: item ? formatDate(item.created_at) : "-" },
            ]}
          />

          <ResourceActions>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(createProviderDraft(item, data))
                setEditingModelId("")
                setNotice("Draft reset.")
              }}
            >
              <RotateCcw className="icon-sm" aria-hidden="true" />
              Reset
            </Button>
            <Button type="button" onClick={() => setNotice("Draft staged locally.")}>
              <Save className="icon-sm" aria-hidden="true" />
              Save draft
            </Button>
          </ResourceActions>
        </div>
      </div>

      <ResourceCard className="resource-card-main" title="Provider Models">
        <ResourceSectionHeader
          actions={
            <>
              <Input
                placeholder="provider-model-name"
                value={newProviderModelName}
                onChange={(event) => setNewProviderModelName(event.target.value)}
              />
              <Button
                disabled={createProviderModelMutation.isPending}
                type="button"
                variant="outline"
                onClick={addProviderModel}
              >
                <Plus className="icon-sm" aria-hidden="true" />
                {createProviderModelMutation.isPending ? "Adding" : "Add model"}
              </Button>
            </>
          }
          title="Upstream model names"
        />

        {draft.providerModels.length > 0 ? (
          <Table className="resource-inline-table resource-provider-table">
            <TableHeader>
              <TableRow>
                <TableHead>Provider model</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="resource-actions-cell">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.providerModels.map((model) => {
                const isEditing = editingModelId === model.id

                return (
                  <TableRow key={model.id}>
                    <TableCell>
                      <Input
                        disabled={!isEditing}
                        value={model.model_name}
                        onChange={(event) =>
                          updateProviderModel(model.id, {
                            model_name: event.target.value,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>{formatDate(model.created_at)}</TableCell>
                    <TableCell>
                      <ResourceActions>
                        <Button
                          size="sm"
                          type="button"
                          variant={isEditing ? "secondary" : "outline"}
                          onClick={() => setEditingModelId(isEditing ? "" : model.id)}
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
                          onClick={() => {
                            setDraft((current) => ({
                              ...current,
                              providerModels: current.providerModels.filter(
                                (candidate) => candidate.id !== model.id,
                              ),
                            }))
                            setNotice("Provider model removed from the local draft.")
                          }}
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
          <EmptyBlock>No provider models configured.</EmptyBlock>
        )}
      </ResourceCard>

      {notice ? <ResourceNotice>{notice}</ResourceNotice> : null}
    </ResourcePageFrame>
  )
}

function createProviderDraft(item: ProviderSummary | undefined, data: AdminData): ProviderDraft {
  if (!item) {
    return {
      provider_base_url: "",
      provider_key: "",
      provider_name: "",
      providerModels: [],
    }
  }

  return {
    provider_base_url: item.provider_base_url,
    provider_key: "",
    provider_name: item.provider_name,
    providerModels: data.providerModels
      .filter((model) => model.provider_id === item.id)
      .map((model) => ({ ...model })),
  }
}

export { ProviderPage }
