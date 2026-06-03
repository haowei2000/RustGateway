import { create } from "zustand"

export type SidebarResource = "keys" | "providers" | "models"

type ModelDraft = {
  model_name: string
  model_options: string[]
  default_max_tokens: number
}

type ProviderDraft = {
  name: string
  base_url: string
  provider_api_key: string
  fetch_models: boolean
}

type ApiKeyDraft = {
  name: string
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
  toggleModelOption: (option: string) => void
  setProviderDraft: (draft: Partial<ProviderDraft>) => void
  setApiKeyDraft: (draft: Partial<ApiKeyDraft>) => void
  setGeneratedApiKey: (key: string) => void
}

export const useAdminStore = create<AdminStore>()((set) => ({
  sidebarResource: "keys",
  selectedSidebarItemId: "",
  modelDraft: {
    model_name: "epichust-chat",
    model_options: ["chat", "streaming"],
    default_max_tokens: 8192,
  },
  providerDraft: {
    name: "OpenAI Primary",
    base_url: "https://api.openai.com",
    provider_api_key: "",
    fetch_models: true,
  },
  apiKeyDraft: {
    name: "New API Key",
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
  toggleModelOption: (option) =>
    set((state) => {
      const isSelected = state.modelDraft.model_options.includes(option)
      return {
        modelDraft: {
          ...state.modelDraft,
          model_options: isSelected
            ? state.modelDraft.model_options.filter((item) => item !== option)
            : [...state.modelDraft.model_options, option],
        },
      }
    }),
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
