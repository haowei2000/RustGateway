use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AuthResult {
    Ok,
    Missing,
    InvalidFormat,
    InvalidKey,
    UpstreamKeyMissing,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent {
    pub request_id: Uuid,
    pub caller_id: Option<String>,
    pub app_id: Option<String>,
    pub client_ip: Option<String>,
    pub method: String,
    pub path: String,
    pub model: Option<String>,
    pub stream: Option<bool>,
    pub status_code: u16,
    pub auth_result: AuthResult,
    pub reject_reason: Option<String>,
    pub provider: Option<String>,
    pub upstream_host: Option<String>,
    pub upstream_request_id: Option<String>,
    pub latency_ms: u128,
    pub key_hash_prefix: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}
