use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ModelType {
    ChatModel,
    EmbeddingModel,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum RoutingStrategy {
    Weighted,
    Priority,
    RoundRobin,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum UsageLimitType {
    RequestsPerMinute,
    RequestsPerDay,
    TokensPerMinute,
    TokensPerDay,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct EpichustModel {
    pub id: String,
    pub model_name: String,
    pub model_type: ModelType,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateEpichustModelRequest {
    pub model_name: String,
    pub model_type: ModelType,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProviderSummary {
    pub id: String,
    pub provider_name: String,
    pub provider_base_url: String,
    pub provider_model_count: u32,
    pub policy_count: u32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateProviderRequest {
    pub provider_name: String,
    pub provider_base_url: String,
    #[schema(write_only)]
    pub provider_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateProviderResponse {
    pub provider: ProviderSummary,
}

// ── Mapping Policy (replaces ModelMapping) ──

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MappingPolicyRoute {
    pub provider_model_id: String,
    pub provider_model_name: String,
    pub provider_id: String,
    pub provider_name: String,
    pub weight: u32,
    pub priority: u32,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MappingPolicyRouteRequest {
    pub provider_model_id: String,
    pub weight: u32,
    pub priority: u32,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MappingPolicy {
    pub id: String,
    pub epichust_model_id: String,
    pub epichust_model_name: String,
    pub routing_strategy: RoutingStrategy,
    pub usage_limit_type: Option<UsageLimitType>,
    pub usage_limit_value: Option<i32>,
    pub enabled: bool,
    pub routes: Vec<MappingPolicyRoute>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateMappingPolicyRequest {
    pub epichust_model_id: String,
    pub routing_strategy: RoutingStrategy,
    pub usage_limit_type: Option<UsageLimitType>,
    pub usage_limit_value: Option<i32>,
    pub routes: Vec<MappingPolicyRouteRequest>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct UpdateMappingPolicyRequest {
    pub routing_strategy: Option<RoutingStrategy>,
    pub usage_limit_type: Option<UsageLimitType>,
    pub usage_limit_value: Option<i32>,
    pub enabled: Option<bool>,
    pub routes: Option<Vec<MappingPolicyRouteRequest>>,
}

// ── API Key ↔ Mapping Policy link ──

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ApiKeyMappingPolicy {
    pub mapping_policy_id: String,
    pub epichust_model_id: String,
    pub epichust_model_name: String,
    pub routing_strategy: RoutingStrategy,
    pub usage_limit_type: Option<UsageLimitType>,
    pub usage_limit_value: Option<i32>,
    pub enabled: bool,
    pub routes: Vec<MappingPolicyRoute>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AttachApiKeyMappingPolicyRequest {
    pub mapping_policy_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AvailableProviderModel {
    pub model_name: String,
    pub owned_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProviderAvailableModelsResponse {
    pub provider_id: String,
    pub provider_name: String,
    pub models: Vec<AvailableProviderModel>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProviderModel {
    pub id: String,
    pub provider_id: String,
    pub model_name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateProviderModelRequest {
    pub provider_id: String,
    pub model_name: String,
}

// ── API Keys ──

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ApiKeySummary {
    pub id: String,
    pub key_name: String,
    pub key_hash_prefix: String,
    pub enabled: bool,
    pub mapping_policies: Vec<ApiKeyMappingPolicy>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateApiKeyRequest {
    pub key_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CreateApiKeyResponse {
    #[schema(read_only)]
    pub plaintext_api_key: String,
    pub record: ApiKeySummary,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct AuditLogEntry {
    pub request_id: Uuid,
    pub api_key_id: Option<String>,
    pub epichust_model_name: Option<String>,
    pub provider_id: Option<String>,
    pub provider_model_name: Option<String>,
    pub method: String,
    pub path: String,
    pub status_code: u16,
    #[schema(value_type = u64)]
    pub latency_ms: u128,
    pub total_tokens: Option<u64>,
    pub created_at: DateTime<Utc>,
}
