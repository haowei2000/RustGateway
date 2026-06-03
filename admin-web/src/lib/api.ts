export type ResourceStatus = "active" | "disabled"

export type EpichustModel = {
  id: string
  model_name: string
  model_options: string[]
  default_max_tokens: number
  status: ResourceStatus
  mapped_source_count: number
  created_at: string
}

export type CreateEpichustModelRequest = {
  model_name: string
  model_options: string[]
  default_max_tokens: number
}

export type ProviderSummary = {
  id: string
  name: string
  base_url: string
  status: ResourceStatus
  key_ref: string
  fetched_model_count: number
  mapping_count: number
  last_fetched_at: string | null
  created_at: string
}

export type CreateProviderRequest = {
  name: string
  base_url: string
  provider_api_key: string
  fetch_models: boolean
}

export type ProviderModel = {
  id: string
  provider_id: string
  supplier_model_name: string
  owned_by: string | null
  context_window: number | null
  status: ResourceStatus
  fetched_at: string
}

export type CreateProviderResponse = {
  provider: ProviderSummary
  fetched_models: ProviderModel[]
}

export type ModelMapping = {
  id: string
  provider_id: string
  provider_name: string
  provider_model_id: string
  supplier_model_name: string
  epichust_model_id: string
  epichust_model_name: string
  priority: number
  enabled: boolean
  created_at: string
}

export type ApiKeyModelSource = {
  mapping_id: string
  provider_id: string
  provider_name: string
  supplier_model_name: string
  priority: number
  weight: number
}

export type ApiKeyModelConfig = {
  epichust_model_id: string
  epichust_model_name: string
  sources: ApiKeyModelSource[]
  rate_limit_per_minute: number
  max_tokens_per_request: number
  max_tokens_per_day: number | null
  used_tokens_today: number
  request_count_today: number
}

export type ApiKeySummary = {
  id: string
  name: string
  key_hash_prefix: string
  status: ResourceStatus
  model_configs: ApiKeyModelConfig[]
  total_requests_today: number
  total_tokens_today: number
  last_used_at: string | null
  created_at: string
}

export type CreateApiKeyRequest = {
  name: string
}

export type CreateApiKeyResponse = {
  plaintext_api_key: string
  record: ApiKeySummary
}

export type AuditLogEntry = {
  request_id: string
  api_key_id: string | null
  epichust_model_name: string | null
  provider_id: string | null
  supplier_model_name: string | null
  method: string
  path: string
  status_code: number
  latency_ms: number
  total_tokens: number | null
  created_at: string
}

export type AdminData = {
  models: EpichustModel[]
  providers: ProviderSummary[]
  providerModels: ProviderModel[]
  mappings: ModelMapping[]
  apiKeys: ApiKeySummary[]
  auditLogs: AuditLogEntry[]
  isMock: boolean
}

const apiBasePath = "/admin-api/v1"

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBasePath}/${path}`)
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`)
  }

  return response.json() as Promise<T>
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBasePath}/${path}`, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  })

  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`)
  }

  return response.json() as Promise<T>
}

export async function getAdminData(): Promise<AdminData> {
  try {
    const [models, providers, providerModels, mappings, apiKeys, auditLogs] = await Promise.all([
      getJson<EpichustModel[]>("epichust-models"),
      getJson<ProviderSummary[]>("providers"),
      getJson<ProviderModel[]>("provider-models"),
      getJson<ModelMapping[]>("model-mappings"),
      getJson<ApiKeySummary[]>("api-keys"),
      getJson<AuditLogEntry[]>("audit-logs"),
    ])

    return {
      models,
      providers,
      providerModels,
      mappings,
      apiKeys,
      auditLogs,
      isMock: false,
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      return mockAdminData
    }

    throw error
  }
}

export function createEpichustModel(input: CreateEpichustModelRequest) {
  return postJson<EpichustModel>("epichust-models", input)
}

export function createProvider(input: CreateProviderRequest) {
  return postJson<CreateProviderResponse>("providers", input)
}

export function createApiKey(input: CreateApiKeyRequest) {
  return postJson<CreateApiKeyResponse>("api-keys", input)
}

const now = new Date().toISOString()

const mockAdminData: AdminData = {
  isMock: true,
  models: [
    {
      id: "em_chat",
      model_name: "epichust-chat",
      model_options: ["chat", "streaming", "json_mode"],
      default_max_tokens: 8192,
      status: "active",
      mapped_source_count: 2,
      created_at: now,
    },
    {
      id: "em_reasoning",
      model_name: "epichust-reasoning",
      model_options: ["chat", "tool_calling"],
      default_max_tokens: 16384,
      status: "active",
      mapped_source_count: 1,
      created_at: now,
    },
  ],
  providers: [
    {
      id: "provider_openai_primary",
      name: "OpenAI Primary",
      base_url: "https://api.openai.com",
      status: "active",
      key_ref: "keyref_primary",
      fetched_model_count: 2,
      mapping_count: 2,
      last_fetched_at: now,
      created_at: now,
    },
    {
      id: "provider_backup",
      name: "Backup Provider",
      base_url: "https://backup.example.com",
      status: "active",
      key_ref: "keyref_backup",
      fetched_model_count: 1,
      mapping_count: 1,
      last_fetched_at: now,
      created_at: now,
    },
  ],
  providerModels: [
    {
      id: "pm_gpt_4o_mini",
      provider_id: "provider_openai_primary",
      supplier_model_name: "gpt-4o-mini",
      owned_by: "openai",
      context_window: 128000,
      status: "active",
      fetched_at: now,
    },
    {
      id: "pm_gpt_4_1",
      provider_id: "provider_openai_primary",
      supplier_model_name: "gpt-4.1",
      owned_by: "openai",
      context_window: 1000000,
      status: "active",
      fetched_at: now,
    },
    {
      id: "pm_backup_chat",
      provider_id: "provider_backup",
      supplier_model_name: "backup-chat",
      owned_by: "backup",
      context_window: 64000,
      status: "active",
      fetched_at: now,
    },
  ],
  mappings: [
    {
      id: "map_chat_primary",
      provider_id: "provider_openai_primary",
      provider_name: "OpenAI Primary",
      provider_model_id: "pm_gpt_4o_mini",
      supplier_model_name: "gpt-4o-mini",
      epichust_model_id: "em_chat",
      epichust_model_name: "epichust-chat",
      priority: 10,
      enabled: true,
      created_at: now,
    },
    {
      id: "map_reasoning_primary",
      provider_id: "provider_openai_primary",
      provider_name: "OpenAI Primary",
      provider_model_id: "pm_gpt_4_1",
      supplier_model_name: "gpt-4.1",
      epichust_model_id: "em_reasoning",
      epichust_model_name: "epichust-reasoning",
      priority: 20,
      enabled: true,
      created_at: now,
    },
  ],
  apiKeys: [
    {
      id: "key_order_chat",
      name: "Order Service",
      key_hash_prefix: "a91c7b44",
      status: "active",
      model_configs: [
        {
          epichust_model_id: "em_chat",
          epichust_model_name: "epichust-chat",
          sources: [
            {
              mapping_id: "map_chat_primary",
              provider_id: "provider_openai_primary",
              provider_name: "OpenAI Primary",
              supplier_model_name: "gpt-4o-mini",
              priority: 10,
              weight: 100,
            },
          ],
          rate_limit_per_minute: 600,
          max_tokens_per_request: 8192,
          max_tokens_per_day: 5000000,
          used_tokens_today: 240000,
          request_count_today: 420,
        },
      ],
      total_requests_today: 420,
      total_tokens_today: 240000,
      last_used_at: now,
      created_at: now,
    },
  ],
  auditLogs: [
    {
      request_id: "audit_1",
      api_key_id: "key_order_chat",
      epichust_model_name: "epichust-chat",
      provider_id: "provider_openai_primary",
      supplier_model_name: "gpt-4o-mini",
      method: "POST",
      path: "/v1/chat/completions",
      status_code: 200,
      latency_ms: 1380,
      total_tokens: 1240,
      created_at: now,
    },
    {
      request_id: "audit_2",
      api_key_id: "key_support",
      epichust_model_name: "epichust-reasoning",
      provider_id: "provider_openai_primary",
      supplier_model_name: "gpt-4.1",
      method: "POST",
      path: "/v1/chat/completions",
      status_code: 429,
      latency_ms: 12,
      total_tokens: null,
      created_at: now,
    },
  ],
}
