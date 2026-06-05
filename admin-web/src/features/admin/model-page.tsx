import { useState } from "react"
import { Layers3, RotateCcw, Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AdminData, EpichustModel, ModelType } from "@/lib/api"
import { NEW_SIDEBAR_ITEM_ID } from "@/stores/admin-store"

import {
  EmptyResourcePage,
  ReadOnlyField,
  ResourceActions,
  ResourceCard,
  ResourceMetrics,
  ResourceNotice,
  ResourcePageFrame,
  ResourcePageHeader,
} from "./resource-page-parts"
import { formatDate, formatNumber, getSelectedItem } from "./resource-page-utils"

type ModelPageProps = {
  data: AdminData | undefined
  isFetching: boolean
  selectedItemId: string
  onRefresh: () => void
}

type ModelDraft = {
  model_name: string
  model_type: ModelType
}

function ModelPage({ data, isFetching, selectedItemId, onRefresh }: ModelPageProps) {
  if (!data) {
    return <EmptyResourcePage message="Loading model details." />
  }

  if (selectedItemId === NEW_SIDEBAR_ITEM_ID) {
    return (
      <ModelPageContent
        key="new-model"
        data={data}
        isFetching={isFetching}
        onRefresh={onRefresh}
      />
    )
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
  item?: EpichustModel
  onRefresh: () => void
}) {
  const [draft, setDraft] = useState<ModelDraft>(() => createModelDraft(item))
  const [notice, setNotice] = useState("")
  const modelPolicies = item
    ? data.policies.filter((policy) => policy.epichust_model_id === item.id)
    : []

  return (
    <ResourcePageFrame variant="model">
      <ResourcePageHeader
        description={draft.model_type}
        icon={Layers3}
        isFetching={isFetching}
        status={draft.model_type}
        title={draft.model_name || "New Model"}
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
              <Label htmlFor="model-type">Type</Label>
              <select
                id="model-type"
                className="resource-select"
                value={draft.model_type}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    model_type: event.target.value as ModelType,
                  }))
                }
              >
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
      </div>

      <div className="resource-layout resource-layout-model-bottom">
        <ResourceMetrics
          metrics={[
            { label: "Policies", value: formatNumber(modelPolicies.length) },
            {
              label: "Enabled Policies",
              value: formatNumber(modelPolicies.filter((policy) => policy.enabled).length),
            },
          ]}
        />

        <ResourceCard title="Routing Summary">
          <div className="resource-policy-list">
            {modelPolicies.length > 0 ? (
              modelPolicies.map((policy) => (
                <div key={policy.id} className="resource-policy-row">
                  <div className="resource-policy-header">
                    <span className="resource-policy-title">
                      {policy.routing_strategy}
                    </span>
                    {policy.usage_limit_type && (
                      <span className="resource-policy-limit">
                        {policy.usage_limit_type}: {policy.usage_limit_value}
                      </span>
                    )}
                  </div>
                  {policy.routes.map((route) => (
                    <div key={route.provider_model_id} className="resource-policy-route">
                      <span className="resource-policy-route-provider">
                        {route.provider_name}
                      </span>
                      <span className="resource-policy-route-model">
                        {route.provider_model_name}
                      </span>
                      <span className="resource-policy-route-weight">
                        w:{route.weight} p:{route.priority}
                      </span>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <ReadOnlyField label="Policies" value="No mapping policies configured." />
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

function createModelDraft(item?: EpichustModel): ModelDraft {
  if (!item) {
    return {
      model_name: "",
      model_type: "chat_model",
    }
  }

  return {
    model_name: item.model_name,
    model_type: item.model_type,
  }
}

export { ModelPage }
