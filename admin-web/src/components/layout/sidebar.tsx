import { ItemList, type ItemListItem } from "@/components/layout/item-list"
import { SidebarButtonGroup } from "@/components/layout/sidebar-button-group"
import {
  useAdminData,
  useCreateApiKey,
  useCreateEpichustModel,
  useCreateProvider,
} from "@/hooks/use-admin-data"
import type { AdminData } from "@/lib/api"
import type { SidebarResource } from "@/stores/admin-store"
import { useAdminStore } from "@/stores/admin-store"

function Sidebar() {
  const adminData = useAdminData()
  const sidebarResource = useAdminStore((state) => state.sidebarResource)
  const selectedSidebarItemId = useAdminStore((state) => state.selectedSidebarItemId)
  const modelDraft = useAdminStore((state) => state.modelDraft)
  const providerDraft = useAdminStore((state) => state.providerDraft)
  const apiKeyDraft = useAdminStore((state) => state.apiKeyDraft)
  const setSelectedSidebarItemId = useAdminStore((state) => state.setSelectedSidebarItemId)
  const setGeneratedApiKey = useAdminStore((state) => state.setGeneratedApiKey)

  const createModel = useCreateEpichustModel()
  const createProvider = useCreateProvider()
  const createApiKey = useCreateApiKey()

  const items = getSidebarItems(sidebarResource, adminData.data)
  const effectiveSelectedItemId = selectedSidebarItemId || items[0]?.id || ""
  const isCreating = createModel.isPending || createProvider.isPending || createApiKey.isPending

  function handleAddItem() {
    if (sidebarResource === "keys") {
      createApiKey.mutate(apiKeyDraft, {
        onSuccess: (response) => {
          setGeneratedApiKey(response.plaintext_api_key)
          setSelectedSidebarItemId(response.record.id)
        },
      })
      return
    }

    if (sidebarResource === "providers") {
      createProvider.mutate(providerDraft, {
        onSuccess: (response) => setSelectedSidebarItemId(response.provider.id),
      })
      return
    }

    createModel.mutate(modelDraft, {
      onSuccess: (model) => setSelectedSidebarItemId(model.id),
    })
  }

  return (
    <aside className="sidebar">
      <SidebarButtonGroup />
      <ItemList
        addLabel={getAddItemLabel(sidebarResource)}
        emptyText="No items found."
        isAdding={isCreating}
        items={items}
        selectedItemId={effectiveSelectedItemId}
        title={getItemListTitle(sidebarResource)}
        onAdd={handleAddItem}
        onSelect={setSelectedSidebarItemId}
      />
    </aside>
  )
}

function getSidebarItems(resource: SidebarResource, data: AdminData | undefined): ItemListItem[] {
  if (!data) return []

  if (resource === "keys") {
    return data.apiKeys.map((key) => ({
      id: key.id,
      eyebrow: key.key_hash_prefix,
      meta: `${key.model_configs.length} models · ${key.total_requests_today.toLocaleString()} req`,
      title: key.name,
    }))
  }

  if (resource === "providers") {
    return data.providers.map((provider) => ({
      id: provider.id,
      eyebrow: provider.status,
      meta: `${provider.fetched_model_count} fetched · ${provider.mapping_count} mappings`,
      title: provider.name,
    }))
  }

  return data.models.map((model) => ({
    id: model.id,
    eyebrow: model.status,
    meta: `${model.default_max_tokens.toLocaleString()} tokens · ${model.mapped_source_count} sources`,
    title: model.model_name,
  }))
}

function getItemListTitle(resource: SidebarResource) {
  if (resource === "keys") return "API Keys"
  if (resource === "providers") return "Providers"
  return "Models"
}

function getAddItemLabel(resource: SidebarResource) {
  if (resource === "keys") return "Add API key"
  if (resource === "providers") return "Add provider"
  return "Add model"
}

export { Sidebar }
