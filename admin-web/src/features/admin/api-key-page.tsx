import { useState } from "react"
import { Ban, Check, KeyRound, Pencil, Plus, RotateCcw, Save } from "lucide-react"

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
import type {
  AdminData,
  ApiKeyModelConfig,
  ApiKeyModelSource,
  ApiKeySummary,
  EpichustModel,
  ResourceStatus,
} from "@/lib/api"

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
  modelConfigs: ApiKeyModelConfig[]
  name: string
  status: ResourceStatus
}

function ApiKeyPage({ data, isFetching, selectedItemId, onRefresh }: ApiKeyPageProps) {
  if (!data) {
    return <EmptyResourcePage message="Loading API key details." />
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
  item: ApiKeySummary
  onRefresh: () => void
}) {
  const [draft, setDraft] = useState<ApiKeyDraft>(() => createApiKeyDraft(item))
  const [editingModelId, setEditingModelId] = useState("")
  const [modelToAddId, setModelToAddId] = useState("")
  const [notice, setNotice] = useState("")

  const availableModels = data.models.filter(
    (model) => !draft.modelConfigs.some((config) => config.epichust_model_id === model.id),
  )
  const effectiveModelToAddId = modelToAddId || availableModels[0]?.id || ""

  function updateConfig(modelId: string, patch: Partial<ApiKeyModelConfig>) {
    setDraft((current) => ({
      ...current,
      modelConfigs: current.modelConfigs.map((config) =>
        config.epichust_model_id === modelId ? { ...config, ...patch } : config,
      ),
    }))
  }

  function updateConfigModel(currentModelId: string, nextModelId: string) {
    const nextModel = data.models.find((model) => model.id === nextModelId)
    if (!nextModel) return

    updateConfig(currentModelId, {
      epichust_model_id: nextModel.id,
      epichust_model_name: nextModel.model_name,
      max_tokens_per_request: nextModel.default_max_tokens,
      sources: getSourcesForModel(nextModel.id, data),
    })
    setEditingModelId(nextModel.id)
  }

  function updatePrimarySource(modelId: string, mappingId: string) {
    setDraft((current) => ({
      ...current,
      modelConfigs: current.modelConfigs.map((config) => {
        if (config.epichust_model_id !== modelId) return config

        const nextPrimary = config.sources.find((source) => source.mapping_id === mappingId)
        if (!nextPrimary) return config

        return {
          ...config,
          sources: [
            nextPrimary,
            ...config.sources.filter((source) => source.mapping_id !== mappingId),
          ],
        }
      }),
    }))
  }

  function updatePrimarySourceWeight(modelId: string, weight: number) {
    setDraft((current) => ({
      ...current,
      modelConfigs: current.modelConfigs.map((config) => {
        if (config.epichust_model_id !== modelId || config.sources.length === 0) return config

        const [primarySource, ...otherSources] = config.sources
        return {
          ...config,
          sources: [{ ...primarySource, weight }, ...otherSources],
        }
      }),
    }))
  }

  function addModelConfig() {
    const model = data.models.find((candidate) => candidate.id === effectiveModelToAddId)
    if (!model) return

    setDraft((current) => ({
      ...current,
      modelConfigs: [...current.modelConfigs, createApiKeyModelConfig(model, data)],
    }))
    setEditingModelId(model.id)
    setModelToAddId("")
    setNotice("Model access added to the local draft.")
  }

  function removeModelConfig(modelId: string) {
    setDraft((current) => ({
      ...current,
      modelConfigs: current.modelConfigs.filter((config) => config.epichust_model_id !== modelId),
    }))
    setEditingModelId("")
    setNotice("Model access removed from the local draft.")
  }

  function revokeApiKey() {
    setDraft((current) => ({ ...current, status: "disabled" }))
    setNotice("Revoke is queued in the local draft.")
  }

  return (
    <ResourcePageFrame variant="key">
      <ResourcePageHeader
        description={`Hash prefix ${item.key_hash_prefix}`}
        icon={KeyRound}
        isFetching={isFetching}
        isMock={data.isMock}
        status={draft.status}
        title={draft.name}
        onRefresh={onRefresh}
      />

      <ResourceMetrics
        metrics={[
          { label: "Models", value: draft.modelConfigs.length },
          { label: "Requests Today", value: formatNumber(item.total_requests_today) },
          { label: "Tokens Today", value: formatNumber(item.total_tokens_today) },
          { label: "Last Used", value: formatDate(item.last_used_at) },
        ]}
      />

      <div className="resource-layout resource-layout-key">
        <ResourceCard className="resource-card-main" title="Model Access">
          <ResourceSectionHeader
            actions={
              <>
                <select
                  className="resource-select"
                  disabled={availableModels.length === 0}
                  value={effectiveModelToAddId}
                  onChange={(event) => setModelToAddId(event.target.value)}
                >
                  {availableModels.length > 0 ? (
                    availableModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.model_name}
                      </option>
                    ))
                  ) : (
                    <option value="">All models added</option>
                  )}
                </select>
                <Button
                  disabled={!effectiveModelToAddId}
                  type="button"
                  variant="outline"
                  onClick={addModelConfig}
                >
                  <Plus className="icon-sm" aria-hidden="true" />
                  Add model
                </Button>
              </>
            }
            title="Per-model limits and routing"
          />

          {draft.modelConfigs.length > 0 ? (
            <Table className="resource-inline-table resource-key-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Rate / min</TableHead>
                  <TableHead>Request tokens</TableHead>
                  <TableHead>Day tokens</TableHead>
                  <TableHead>Routing source</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead className="resource-actions-cell">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.modelConfigs.map((config) => {
                  const isEditing = editingModelId === config.epichust_model_id
                  const primarySource = config.sources[0]

                  return (
                    <TableRow key={config.epichust_model_id}>
                      <TableCell>
                        <select
                          className="resource-select resource-select-compact"
                          disabled={!isEditing}
                          value={config.epichust_model_id}
                          onChange={(event) =>
                            updateConfigModel(config.epichust_model_id, event.target.value)
                          }
                        >
                          {data.models.map((model) => (
                            <option
                              key={model.id}
                              disabled={draft.modelConfigs.some(
                                (existingConfig) =>
                                  existingConfig.epichust_model_id === model.id &&
                                  existingConfig.epichust_model_id !== config.epichust_model_id,
                              )}
                              value={model.id}
                            >
                              {model.model_name}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="resource-number-input"
                          disabled={!isEditing}
                          min={0}
                          type="number"
                          value={config.rate_limit_per_minute}
                          onChange={(event) =>
                            updateConfig(config.epichust_model_id, {
                              rate_limit_per_minute: Number(event.target.value),
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="resource-number-input"
                          disabled={!isEditing}
                          min={1}
                          type="number"
                          value={config.max_tokens_per_request}
                          onChange={(event) =>
                            updateConfig(config.epichust_model_id, {
                              max_tokens_per_request: Number(event.target.value),
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
                          value={config.max_tokens_per_day ?? ""}
                          onChange={(event) =>
                            updateConfig(config.epichust_model_id, {
                              max_tokens_per_day:
                                event.target.value === "" ? null : Number(event.target.value),
                            })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <select
                          className="resource-select resource-select-compact"
                          disabled={!isEditing || config.sources.length === 0}
                          value={primarySource?.mapping_id ?? ""}
                          onChange={(event) =>
                            updatePrimarySource(config.epichust_model_id, event.target.value)
                          }
                        >
                          {config.sources.length > 0 ? (
                            config.sources.map((source) => (
                              <option key={source.mapping_id} value={source.mapping_id}>
                                {source.provider_name} / {source.supplier_model_name}
                              </option>
                            ))
                          ) : (
                            <option value="">No source</option>
                          )}
                        </select>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="resource-number-input"
                          disabled={!isEditing || !primarySource}
                          min={0}
                          type="number"
                          value={primarySource?.weight ?? 0}
                          onChange={(event) =>
                            updatePrimarySourceWeight(
                              config.epichust_model_id,
                              Number(event.target.value),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <ResourceActions>
                          <Button
                            size="sm"
                            type="button"
                            variant={isEditing ? "secondary" : "outline"}
                            onClick={() =>
                              setEditingModelId(isEditing ? "" : config.epichust_model_id)
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
                            onClick={() => removeModelConfig(config.epichust_model_id)}
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
            <EmptyBlock>No model access configured.</EmptyBlock>
          )}
        </ResourceCard>

        <div className="resource-side-stack">
          <ResourceCard title="Identity">
            <div className="resource-form-grid">
              <div className="resource-field">
                <Label htmlFor="api-key-name">Name</Label>
                <Input
                  id="api-key-name"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </div>
              <div className="resource-field">
                <Label htmlFor="api-key-status">Status</Label>
                <select
                  id="api-key-status"
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
              <ReadOnlyField label="Hash prefix" value={item.key_hash_prefix} />
              <ReadOnlyField label="ID" value={item.id} />
              <ReadOnlyField label="Created" value={formatDate(item.created_at)} />
            </div>
          </ResourceCard>

          <DangerAction
            action={
              <Button
                className="resource-danger-button"
                disabled={draft.status === "disabled"}
                type="button"
                variant="outline"
                onClick={revokeApiKey}
              >
                <Ban className="icon-sm" aria-hidden="true" />
                Revoke
              </Button>
            }
            badge="special action"
            description="Status changes to disabled in the current draft."
            title="Revoke API key"
          />

          <ResourceActions>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDraft(createApiKeyDraft(item))
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

      {notice ? <ResourceNotice>{notice}</ResourceNotice> : null}
    </ResourcePageFrame>
  )
}

function createApiKeyDraft(item: ApiKeySummary): ApiKeyDraft {
  return {
    modelConfigs: item.model_configs.map((config) => ({
      ...config,
      sources: config.sources.map((source) => ({ ...source })),
    })),
    name: item.name,
    status: item.status,
  }
}

function createApiKeyModelConfig(model: EpichustModel, data: AdminData): ApiKeyModelConfig {
  return {
    epichust_model_id: model.id,
    epichust_model_name: model.model_name,
    max_tokens_per_day: null,
    max_tokens_per_request: model.default_max_tokens,
    rate_limit_per_minute: 60,
    request_count_today: 0,
    sources: getSourcesForModel(model.id, data),
    used_tokens_today: 0,
  }
}

function getSourcesForModel(modelId: string, data: AdminData): ApiKeyModelSource[] {
  return data.mappings
    .filter((mapping) => mapping.enabled && mapping.epichust_model_id === modelId)
    .map((mapping) => ({
      mapping_id: mapping.id,
      priority: mapping.priority,
      provider_id: mapping.provider_id,
      provider_name: mapping.provider_name,
      supplier_model_name: mapping.supplier_model_name,
      weight: 100,
    }))
}

export { ApiKeyPage }
