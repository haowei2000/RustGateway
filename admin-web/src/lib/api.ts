export type ModelType = "chat_model" | "embedding_model"

export type RoutingStrategy = "weighted" | "priority" | "round_robin"

export type UsageLimitType =
  | "requests_per_minute"
  | "requests_per_day"
  | "tokens_per_minute"
  | "tokens_per_day"

export type EpichustModel = {
  id: string
  model_name: string
  model_type: ModelType
  created_at: string
}

export type CreateEpichustModelRequest = {
  model_name: string
  model_type: ModelType
}

export type ProviderSummary = {
  id: string
  provider_name: string
  provider_base_url: string
  provider_model_count: number
  policy_count: number
  created_at: string
}

export type CreateProviderRequest = {
  provider_name: string
  provider_base_url: string
  provider_key: string
}

export type CreateProviderResponse = {
  provider: ProviderSummary
}

export type AvailableProviderModel = {
  model_name: string
  owned_by: string | null
}

export type ProviderAvailableModelsResponse = {
  provider_id: string
  provider_name: string
  models: AvailableProviderModel[]
}

export type ProviderModel = {
  id: string
  provider_id: string
  model_name: string
  created_at: string
}

export type CreateProviderModelRequest = {
  provider_id: string
  model_name: string
}

// ── Rate Limit Rules ──

export type RateLimitRule = {
  limit_type: UsageLimitType
  limit_value: number
}

export type RateLimitRuleRequest = {
  limit_type: UsageLimitType
  limit_value: number
}

// ── Mapping Policy ──

export type MappingPolicyRoute = {
  provider_model_id: string
  provider_model_name: string
  provider_id: string
  provider_name: string
  weight: number
  priority: number
  enabled: boolean
}

export type MappingPolicyRouteRequest = {
  provider_model_id: string
  weight: number
  priority: number
  enabled: boolean
}

export type MappingPolicy = {
  id: string
  epichust_model_id: string
  epichust_model_name: string
  routing_strategy: RoutingStrategy
  rate_limit_rules: RateLimitRule[]
  enabled: boolean
  routes: MappingPolicyRoute[]
  created_at: string
}

export type CreateMappingPolicyRequest = {
  epichust_model_id: string
  routing_strategy: RoutingStrategy
  rate_limit_rules: RateLimitRuleRequest[]
  enabled: boolean
  routes: MappingPolicyRouteRequest[]
}

export type UpdateMappingPolicyRequest = {
  routing_strategy?: RoutingStrategy
  rate_limit_rules?: RateLimitRuleRequest[]
  enabled?: boolean
  routes?: MappingPolicyRouteRequest[]
}

// ── API Key ↔ Mapping Policy ──

export type ApiKeyMappingPolicy = {
  mapping_policy_id: string
  epichust_model_id: string
  epichust_model_name: string
  routing_strategy: RoutingStrategy
  rate_limit_rules: RateLimitRule[]
  enabled: boolean
  routes: MappingPolicyRoute[]
}

export type AttachApiKeyMappingPolicyRequest = {
  mapping_policy_id: string
}

export type ApiKeySummary = {
  id: string
  key_name: string
  key_hash_prefix: string
  key_suffix: string | null
  enabled: boolean
  mapping_policies: ApiKeyMappingPolicy[]
  last_used_at: string | null
  created_at: string
}

export type CreateApiKeyRequest = {
  key_name: string
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
  provider_model_name: string | null
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
  policies: MappingPolicy[]
  apiKeys: ApiKeySummary[]
  auditLogs: AuditLogEntry[]
}

const apiBasePath = "/admin-api/v1"

async function requestJson<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  const response = await fetch(`${apiBasePath}/${path}`, init)
  if (!response.ok) {
    // Surface the backend error message ({ error: { message, type } }) when present.
    let detail = ""
    try {
      const errBody = (await response.json()) as {
        error?: { message?: string }
      }
      if (errBody?.error?.message) detail = `: ${errBody.error.message}`
    } catch {
      // response had no JSON body
    }
    throw new Error(`${method} ${path} failed with ${response.status}${detail}`)
  }
  // 204, or any other empty body (delete/update endpoints return an empty 2xx):
  // reading text first avoids "Unexpected end of JSON input" on response.json().
  if (response.status === 204) {
    return undefined as T
  }
  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>("GET", path)
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>("POST", path, body)
}

export async function getAdminData(): Promise<AdminData> {
  const [models, providers, providerModels, policies, apiKeys, auditLogs] =
    await Promise.all([
      getJson<EpichustModel[]>("epichust-models"),
      getJson<ProviderSummary[]>("providers"),
      getJson<ProviderModel[]>("provider-models"),
      getJson<MappingPolicy[]>("mapping-policies"),
      getJson<ApiKeySummary[]>("api-keys"),
      getJson<AuditLogEntry[]>("audit-logs"),
    ])

  return {
    models,
    providers,
    providerModels,
    policies,
    apiKeys,
    auditLogs,
  }
}

export function createEpichustModel(input: CreateEpichustModelRequest) {
  return postJson<EpichustModel>("epichust-models", input)
}

export function updateEpichustModel(id: string, input: CreateEpichustModelRequest) {
  return requestJson<void>("PUT", `epichust-models/${id}`, input)
}

export type UpdateProviderRequest = {
  provider_name: string
  provider_base_url: string
  // Omit/empty to keep the existing upstream key.
  provider_key?: string
}

export function createProvider(input: CreateProviderRequest) {
  return postJson<CreateProviderResponse>("providers", input)
}

export function updateProvider(id: string, input: UpdateProviderRequest) {
  return requestJson<void>("PUT", `providers/${id}`, input)
}

export function getProviderAvailableModels(providerId: string) {
  return getJson<ProviderAvailableModelsResponse>(
    `providers/${providerId}/available-models`,
  )
}

export function createProviderModel(input: CreateProviderModelRequest) {
  return postJson<ProviderModel>("provider-models", input)
}

export function deleteProviderModel(id: string) {
  return requestJson<void>("DELETE", `provider-models/${id}`)
}

// ── Mapping Policy API ──

export function createMappingPolicy(input: CreateMappingPolicyRequest) {
  return postJson<MappingPolicy>("mapping-policies", input)
}

export function getMappingPolicy(id: string) {
  return getJson<MappingPolicy>(`mapping-policies/${id}`)
}

export function updateMappingPolicy(
  id: string,
  input: UpdateMappingPolicyRequest,
) {
  return requestJson<MappingPolicy>("PUT", `mapping-policies/${id}`, input)
}

export function deleteMappingPolicy(id: string) {
  return requestJson<void>("DELETE", `mapping-policies/${id}`)
}

// ── API Key API ──

export function createApiKey(input: CreateApiKeyRequest) {
  return postJson<CreateApiKeyResponse>("api-keys", input)
}

export function attachApiKeyMappingPolicy(
  apiKeyId: string,
  input: AttachApiKeyMappingPolicyRequest,
) {
  return postJson<ApiKeyMappingPolicy>(
    `api-keys/${apiKeyId}/mapping-policies`,
    input,
  )
}

export function detachApiKeyMappingPolicy(
  apiKeyId: string,
  mappingPolicyId: string,
) {
  return requestJson<void>(
    "DELETE",
    `api-keys/${apiKeyId}/mapping-policies/${mappingPolicyId}`,
  )
}

export function updateApiKey(id: string, input: { key_name: string; enabled: boolean }) {
  return requestJson<void>("PUT", `api-keys/${id}`, input)
}

export function deleteApiKey(id: string) {
  return requestJson<void>("DELETE", `api-keys/${id}`)
}

export function rotateApiKey(id: string): Promise<CreateApiKeyResponse> {
  return requestJson<CreateApiKeyResponse>("PATCH", `api-keys/${id}/rotate`)
}

export function deleteProvider(id: string) {
  return requestJson<void>("DELETE", `providers/${id}`)
}

export function deleteEpichustModel(id: string) {
  return requestJson<void>("DELETE", `epichust-models/${id}`)
}
