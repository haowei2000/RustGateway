import type { ModelType } from "@/lib/api"
import { create } from "zustand"

export type SidebarResource = "keys" | "providers" | "models"

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

type AdminStore = {
  sidebarResource: SidebarResource
  selectedSidebarItemId: string
  modelDraft: ModelDraft
  providerDraft: ProviderDraft
  apiKeyDraft: ApiKeyDraft
  generatedApiKey: string
  setSidebarResource: (resource: SidebarResource) => void
  setSelectedSidebarItemId: (id: string) => void
  setModelDraft: (draft: Partial<ModelDraft>) => void
  setProviderDraft: (draft: Partial<ProviderDraft>) => void
  setApiKeyDraft: (draft: Partial<ApiKeyDraft>) => void
  setGeneratedApiKey: (key: string) => void
}

export const useAdminStore = create<AdminStore>()((set) => ({
  sidebarResource: "keys",
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
  generatedApiKey: "",
  setSidebarResource: (resource) =>
    set({
      selectedSidebarItemId: "",
      sidebarResource: resource,
    }),
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
  setGeneratedApiKey: (key) => set({ generatedApiKey: key }),
}))
