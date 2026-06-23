import type { ModelType, RoutingStrategy, RateLimitRule } from "@/lib/api"
import { create } from "zustand"

export type SidebarResource =
  | "dashboard"
  | "providers"
  | "models"
  | "routes"
  | "keys"
  | "audit"

/** Sections that render a master ListPanel + detail; the rest are full-width. */
export const LIST_SECTIONS: SidebarResource[] = ["providers", "models", "routes", "keys"]

export const NEW_SIDEBAR_ITEM_ID = "__new__"

type ModelDraft = {
  model_name: string
  model_type: ModelType
}

type ProviderDraft = {
  provider_name: string
  provider_base_url: string
  provider_key: string
}

type ApiKeyDraft = {
  key_name: string
}

type PolicyDraft = {
  epichust_model_id: string
  routing_strategy: RoutingStrategy
  rate_limit_rules: RateLimitRule[]
  enabled: boolean
}

type AdminStore = {
  sidebarResource: SidebarResource
  navExpanded: boolean
  selectedSidebarItemId: string
  modelDraft: ModelDraft
  providerDraft: ProviderDraft
  apiKeyDraft: ApiKeyDraft
  policyDraft: PolicyDraft
  generatedApiKey: string
  setSidebarResource: (resource: SidebarResource) => void
  setNavExpanded: (expanded: boolean) => void
  setSelectedSidebarItemId: (id: string) => void
  setModelDraft: (draft: Partial<ModelDraft>) => void
  setProviderDraft: (draft: Partial<ProviderDraft>) => void
  setApiKeyDraft: (draft: Partial<ApiKeyDraft>) => void
  setPolicyDraft: (draft: Partial<PolicyDraft>) => void
  setGeneratedApiKey: (key: string) => void
}

export const useAdminStore = create<AdminStore>()((set) => ({
  sidebarResource: "dashboard",
  navExpanded: true,
  selectedSidebarItemId: "",
  modelDraft: {
    model_name: "epichust-chat",
    model_type: "chat_model",
  },
  providerDraft: {
    provider_name: "OpenAI Primary",
    provider_base_url: "https://api.openai.com",
    provider_key: "",
  },
  apiKeyDraft: {
    key_name: "New API Key",
  },
  policyDraft: {
    epichust_model_id: "",
    routing_strategy: "weighted",
    rate_limit_rules: [],
    enabled: true,
  },
  generatedApiKey: "",
  setSidebarResource: (resource) =>
    set({
      selectedSidebarItemId: "",
      sidebarResource: resource,
    }),
  setNavExpanded: (expanded) => set({ navExpanded: expanded }),
  setSelectedSidebarItemId: (id) => set({ selectedSidebarItemId: id }),
  setModelDraft: (draft) =>
    set((state) => ({
      modelDraft: { ...state.modelDraft, ...draft },
    })),
  setProviderDraft: (draft) =>
    set((state) => ({
      providerDraft: { ...state.providerDraft, ...draft },
    })),
  setApiKeyDraft: (draft) =>
    set((state) => ({
      apiKeyDraft: { ...state.apiKeyDraft, ...draft },
    })),
  setPolicyDraft: (draft) =>
    set((state) => ({
      policyDraft: { ...state.policyDraft, ...draft },
    })),
  setGeneratedApiKey: (key) => set({ generatedApiKey: key }),
}))
