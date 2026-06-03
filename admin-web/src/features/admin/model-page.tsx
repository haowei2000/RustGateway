import { useState } from "react"
import { Layers3, Plus, RotateCcw, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AdminData, EpichustModel, ResourceStatus } from "@/lib/api"

import {
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
import { formatDate, formatList, formatNumber, getSelectedItem } from "./resource-page-utils"

const capabilityOptions = ["chat", "streaming", "json_mode", "tool_calling", "vision", "embedding"]

type ModelPageProps = {
  data: AdminData | undefined
  isFetching: boolean
  selectedItemId: string
  onRefresh: () => void
}

type ModelDraft = {
  default_max_tokens: number
  model_name: string
  model_options: string[]
  status: ResourceStatus
}

function ModelPage({ data, isFetching, selectedItemId, onRefresh }: ModelPageProps) {
  if (!data) {
    return <EmptyResourcePage message="Loading model details." />
  }

  const item = getSelectedItem(data.models, selectedItemId)
  if (!item) {
    return <EmptyResourcePage message="Create or select a model from the sidebar." />
  }

  return (
    <ModelPageContent
      key={item.id}
      data={data}
      isFetching={isFetching}
      item={item}
      onRefresh={onRefresh}
    />
  )
}

function ModelPageContent({
  data,
  isFetching,
  item,
  onRefresh,
}: {
  data: AdminData
  isFetching: boolean
  item: EpichustModel
  onRefresh: () => void
}) {
  const [draft, setDraft] = useState<ModelDraft>(() => createModelDraft(item))
  const [capabilityToAdd, setCapabilityToAdd] = useState("")
  const [notice, setNotice] = useState("")

  const visibleCapabilities = Array.from(new Set([...capabilityOptions, ...draft.model_options]))
  const availableCapabilities = capabilityOptions.filter(
    (capability) => !draft.model_options.includes(capability),
  )
  const effectiveCapabilityToAdd = capabilityToAdd || availableCapabilities[0] || ""
  const modelMappings = data.mappings.filter((mapping) => mapping.epichust_model_id === item.id)

  function setCapability(capability: string, enabled: boolean) {
    setDraft((current) => ({
      ...current,
      model_options: enabled
        ? Array.from(new Set([...current.model_options, capability]))
        : current.model_options.filter((item) => item !== capability),
    }))
  }

  return (
    <ResourcePageFrame variant="model">
      <ResourcePageHeader
        description={formatList(draft.model_options)}
        icon={Layers3}
        isFetching={isFetching}
        isMock={data.isMock}
        status={draft.status}
        title={draft.model_name}
        onRefresh={onRefresh}
      />

      <div className="resource-layout resource-layout-model">
        <ResourceCard title="Model Settings">
          <div className="resource-form-grid">
            <div className="resource-field">
              <Label htmlFor="model-name">Name</Label>
              <Input
                id="model-name"
                value={draft.model_name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, model_name: event.target.value }))
                }
              />
            </div>
            <div className="resource-field">
              <Label htmlFor="model-status">Status</Label>
              <select
                id="model-status"
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
            <div className="resource-field">
              <Label htmlFor="model-default-tokens">Default max tokens</Label>
              <Input
                id="model-default-tokens"
                min={1}
                type="number"
                value={draft.default_max_tokens}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    default_max_tokens: Number(event.target.value),
                  }))
                }
              />
            </div>
            <ReadOnlyField label="Model ID" value={item.id} />
            <ReadOnlyField label="Created" value={formatDate(item.created_at)} />
          </div>
        </ResourceCard>

        <ResourceCard title="Capabilities">
          <ResourceSectionHeader
            actions={
              <>
                <select
                  className="resource-select"
                  disabled={availableCapabilities.length === 0}
                  value={effectiveCapabilityToAdd}
                  onChange={(event) => setCapabilityToAdd(event.target.value)}
                >
                  {availableCapabilities.length > 0 ? (
                    availableCapabilities.map((capability) => (
                      <option key={capability} value={capability}>
                        {capability}
                      </option>
                    ))
                  ) : (
                    <option value="">All capabilities added</option>
                  )}
                </select>
                <Button
                  disabled={!effectiveCapabilityToAdd}
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCapability(effectiveCapabilityToAdd, true)
                    setCapabilityToAdd("")
                    setNotice("Capability added to the local draft.")
                  }}
                >
                  <Plus className="icon-sm" aria-hidden="true" />
                  Add
                </Button>
              </>
            }
            title="Runtime options"
          />

          <div className="resource-checkbox-grid">
            {visibleCapabilities.map((capability) => (
              <label key={capability} className="resource-checkbox-row">
                <Checkbox
                  checked={draft.model_options.includes(capability)}
                  onCheckedChange={(checked) => setCapability(capability, checked === true)}
                />
                <span>{capability}</span>
              </label>
            ))}
          </div>
        </ResourceCard>
      </div>

      <div className="resource-layout resource-layout-model-bottom">
        <ResourceMetrics
          metrics={[
            { label: "Capabilities", value: draft.model_options.length },
            { label: "Default Tokens", value: formatNumber(draft.default_max_tokens) },
            { label: "Mapped Sources", value: formatNumber(modelMappings.length) },
            {
              label: "Enabled Sources",
              value: formatNumber(modelMappings.filter((mapping) => mapping.enabled).length),
            },
          ]}
        />

        <ResourceCard title="Routing Summary">
          <div className="resource-mapping-list">
            {modelMappings.length > 0 ? (
              modelMappings.map((mapping) => (
                <div key={mapping.id} className="resource-mapping-row">
                  <span className="resource-mapping-title">{mapping.provider_name}</span>
                  <span className="resource-mapping-meta">
                    {mapping.supplier_model_name} / priority {mapping.priority}
                  </span>
                </div>
              ))
            ) : (
              <ReadOnlyField label="Mappings" value="No provider mappings configured." />
            )}
          </div>
        </ResourceCard>
      </div>

      <ResourceActions>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDraft(createModelDraft(item))
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

      {notice ? <ResourceNotice>{notice}</ResourceNotice> : null}
    </ResourcePageFrame>
  )
}

function createModelDraft(item: EpichustModel): ModelDraft {
  return {
    default_max_tokens: item.default_max_tokens,
    model_name: item.model_name,
    model_options: [...item.model_options],
    status: item.status,
  }
}

export { ModelPage }
