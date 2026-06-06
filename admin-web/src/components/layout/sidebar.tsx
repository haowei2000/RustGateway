import { Database, KeyRound, Layers3, Shuffle } from "lucide-react"

import { ItemList, type ItemListItem } from "@/components/layout/item-list"
import { SidebarButtonGroup } from "@/components/layout/sidebar-button-group"
import { useAdminData } from "@/hooks/use-admin-data"
import type { AdminData } from "@/lib/api"
import { NEW_SIDEBAR_ITEM_ID, type SidebarResource } from "@/stores/admin-store"
import { useAdminStore } from "@/stores/admin-store"

function Sidebar() {
  const adminData = useAdminData()
  const sidebarResource = useAdminStore((state) => state.sidebarResource)
  const selectedSidebarItemId = useAdminStore((state) => state.selectedSidebarItemId)
  const setSelectedSidebarItemId = useAdminStore((state) => state.setSelectedSidebarItemId)

  const items = getSidebarItems(sidebarResource, adminData.data)
  const effectiveSelectedItemId = selectedSidebarItemId || items[0]?.id || ""

  function handleAddItem() {
    setSelectedSidebarItemId(NEW_SIDEBAR_ITEM_ID)
  }

  return (
    <aside className="sidebar">
      <SidebarButtonGroup />
      <ItemList
        addLabel={getAddItemLabel(sidebarResource)}
        emptyText="No items found."
        isAdding={false}
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
      icon: KeyRound,
      id: key.id,
      eyebrow: key.enabled ? "enabled" : "disabled",
      meta: `${key.mapping_policies.length} policies · ${key.key_hash_prefix}`,
      title: key.key_name,
    }))
  }

  if (resource === "providers") {
    return data.providers.map((provider) => ({
      icon: Database,
      id: provider.id,
      eyebrow: "provider",
      meta: `${provider.provider_model_count} models · ${provider.policy_count} policies`,
      title: provider.provider_name,
    }))
  }

  if (resource === "policies") {
    return data.policies.map((policy) => ({
      icon: Shuffle,
      id: policy.id,
      eyebrow: policy.routing_strategy,
      meta: `${policy.routes.length} routes · ${policy.rate_limit_rules.length} rules`,
      title: policy.epichust_model_name,
    }))
  }

  return data.models.map((model) => ({
    icon: Layers3,
    id: model.id,
    eyebrow: model.model_type,
    meta: "Epichust model",
    title: model.model_name,
  }))
}

function getItemListTitle(resource: SidebarResource) {
  if (resource === "keys") return "API Keys"
  if (resource === "providers") return "Providers"
  if (resource === "policies") return "Policies"
  return "Models"
}

function getAddItemLabel(resource: SidebarResource) {
  if (resource === "keys") return "New API key"
  if (resource === "providers") return "New provider"
  if (resource === "policies") return "New policy"
  return "New model"
}

export { Sidebar }
