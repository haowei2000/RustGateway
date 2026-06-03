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
import type { AdminData, ProviderModel, ProviderSummary, ResourceStatus } from "@/lib/api"

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
  base_url: string
  key_ref: string
  name: string
  providerModels: ProviderModel[]
  status: ResourceStatus
}

function ProviderPage({ data, isFetching, selectedItemId, onRefresh }: ProviderPageProps) {
  if (!data) {
    return <EmptyResourcePage message="Loading provider details." />
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
  item: ProviderSummary
  onRefresh: () => void
}) {
  const [draft, setDraft] = useState<ProviderDraft>(() => createProviderDraft(item, data))
  const [editingModelId, setEditingModelId] = useState("")
  const [newSupplierModelName, setNewSupplierModelName] = useState("")
  const [notice, setNotice] = useState("")

  function updateProviderModel(modelId: string, patch: Partial<ProviderModel>) {
    setDraft((current) => ({
      ...current,
      providerModels: current.providerModels.map((model) =>
        model.id === modelId ? { ...model, ...patch } : model,
      ),
    }))
  }

  function addProviderModel() {
    const supplierName = newSupplierModelName.trim()
    if (!supplierName) return

    const providerModel: ProviderModel = {
      context_window: null,
      fetched_at: new Date().toISOString(),
      id: `draft_${Date.now()}`,
      owned_by: draft.name,
      provider_id: item.id,
      status: "active",
      supplier_model_name: supplierName,
    }

    setDraft((current) => ({
      ...current,
      providerModels: [...current.providerModels, providerModel],
    }))
    setEditingModelId(providerModel.id)
    setNewSupplierModelName("")
    setNotice("Provider model added to the local draft.")
  }

  return (
    <ResourcePageFrame variant="provider">
      <ResourcePageHeader
        description={draft.base_url}
        icon={Database}
        isFetching={isFetching}
        isMock={data.isMock}
        status={draft.status}
        title={draft.name}
        onRefresh={onRefresh}
      />

      <div className="resource-layout resource-layout-provider">
        <ResourceCard title="Provider Settings">
          <div className="resource-form-grid">
            <div className="resource-field">
              <Label htmlFor="provider-name">Name</Label>
              <Input
                id="provider-name"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>
            <div className="resource-field">
              <Label htmlFor="provider-status">Status</Label>
              <select
                id="provider-status"
                className="resource-select"
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as ResourceStatus,
                  }))
                }
              >
                <option value="active">active</option>
                <option value="disabled">disabled</option>
              </select>
            </div>
            <div className="resource-field resource-field-wide">
              <Label htmlFor="provider-base-url">Base URL</Label>
              <Input
                id="provider-base-url"
                value={draft.base_url}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, base_url: event.target.value }))
                }
              />
            </div>
            <div className="resource-field">
              <Label htmlFor="provider-key-ref">Key ref</Label>
              <Input
                id="provider-key-ref"
                value={draft.key_ref}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, key_ref: event.target.value }))
                }
              />
            </div>
            <ReadOnlyField label="Provider ID" value={item.id} />
          </div>
        </ResourceCard>

        <div className="resource-side-stack">
          <ResourceMetrics
            metrics={[
              { label: "Fetched Models", value: formatNumber(draft.providerModels.length) },
              { label: "Mappings", value: formatNumber(item.mapping_count) },
              { label: "Last Fetched", value: formatDate(item.last_fetched_at) },
              { label: "Created", value: formatDate(item.created_at) },
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
                placeholder="supplier-model-name"
                value={newSupplierModelName}
                onChange={(event) => setNewSupplierModelName(event.target.value)}
              />
              <Button type="button" variant="outline" onClick={addProviderModel}>
                <Plus className="icon-sm" aria-hidden="true" />
                Add model
              </Button>
            </>
          }
          title="Fetched and manually added upstream models"
        />

        {draft.providerModels.length > 0 ? (
          <Table className="resource-inline-table resource-provider-table">
            <TableHeader>
              <TableRow>
                <TableHead>Supplier model</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Context</TableHead>
                <TableHead>Status</TableHead>
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
                        value={model.supplier_model_name}
                        onChange={(event) =>
                          updateProviderModel(model.id, {
                            supplier_model_name: event.target.value,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        disabled={!isEditing}
                        value={model.owned_by ?? ""}
                        onChange={(event) =>
                          updateProviderModel(model.id, {
                            owned_by: event.target.value || null,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="resource-number-input"
                        disabled={!isEditing}
                        min={0}
                        type="number"
                        value={model.context_window ?? ""}
                        onChange={(event) =>
                          updateProviderModel(model.id, {
                            context_window:
                              event.target.value === "" ? null : Number(event.target.value),
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <select
                        className="resource-select resource-select-compact"
                        disabled={!isEditing}
                        value={model.status}
                        onChange={(event) =>
                          updateProviderModel(model.id, {
                            status: event.target.value as ResourceStatus,
                          })
                        }
                      >
                        <option value="active">active</option>
                        <option value="disabled">disabled</option>
                      </select>
                    </TableCell>
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

function createProviderDraft(item: ProviderSummary, data: AdminData): ProviderDraft {
  return {
    base_url: item.base_url,
    key_ref: item.key_ref,
    name: item.name,
    providerModels: data.providerModels
      .filter((model) => model.provider_id === item.id)
      .map((model) => ({ ...model })),
    status: item.status,
  }
}

export { ProviderPage }
