use std::{sync::Arc, time::Instant};

use async_trait::async_trait;
use bytes::Bytes;
use http::Method;
use llm_gateway_common::{
    api_key::{hash_api_key, hash_prefix, parse_bearer_token},
    audit::{AuditEvent, AuthResult},
};
use pingora_core::{upstreams::peer::HttpPeer, Error, Result};
use pingora_http::{RequestHeader, ResponseHeader};
use pingora_proxy::{ProxyHttp, Session};
use prometheus::{
    register_histogram, register_int_counter, register_int_gauge, Histogram, IntCounter, IntGauge,
};
use serde_json::json;
use uuid::Uuid;

use crate::db::Cache;

const CHAT_COMPLETIONS_PATH: &str = "/v1/chat/completions";
const BODY_PROBE_LIMIT: usize = 64 * 1024;

pub struct LlmGateway {
    cache: Cache,
    requests_total: IntCounter,
    auth_failures_total: IntCounter,
    upstream_errors_total: IntCounter,
    active_requests: IntGauge,
    request_duration: Histogram,
}

pub struct RequestContext {
    request_id: Uuid,
    started_at: Instant,
    audit_enabled: bool,
    counted_active: bool,
    auth_result: AuthResult,
    reject_reason: Option<String>,
    key_hash_prefix: Option<String>,
    model: Option<String>,
    stream: Option<bool>,
    body_probe: Vec<u8>,
    body_rewritten: bool,
    provider_base_url: Option<String>,
    provider_name: Option<String>,
    provider_key: Option<String>,
    upstream_host: Option<String>,
}

impl LlmGateway {
    pub fn new(
        _config: Arc<crate::config::GatewayConfig>,
        cache: Cache,
    ) -> std::result::Result<Self, prometheus::Error> {
        Ok(Self {
            cache,
            requests_total: register_int_counter!(
                "gateway_requests_total", "Total requests"
            )?,
            auth_failures_total: register_int_counter!(
                "gateway_auth_failures_total", "Auth failures"
            )?,
            upstream_errors_total: register_int_counter!(
                "gateway_upstream_errors_total", "Upstream errors"
            )?,
            active_requests: register_int_gauge!(
                "gateway_active_requests", "Active requests"
            )?,
            request_duration: register_histogram!(
                "gateway_request_duration_seconds", "Request latency"
            )?,
        })
    }

    fn resolve_provider(&self) -> Option<(String, String, String)> {
        let cache = self.cache.read().ok()?;
        cache.model_routes.values().next().map(|r| {
            (
                r.provider.provider_base_url.clone(),
                r.provider.provider_name.clone(),
                r.provider.provider_key.clone(),
            )
        })
    }
}

#[async_trait]
impl ProxyHttp for LlmGateway {
    type CTX = RequestContext;

    fn new_ctx(&self) -> Self::CTX {
        RequestContext {
            request_id: Uuid::new_v4(),
            started_at: Instant::now(),
            audit_enabled: true,
            counted_active: false,
            auth_result: AuthResult::Missing,
            reject_reason: None,
            key_hash_prefix: None,
            model: None,
            stream: None,
            body_probe: Vec::new(),
            body_rewritten: false,
            provider_base_url: None,
            provider_name: None,
            provider_key: None,
            upstream_host: None,
        }
    }

    async fn request_filter(&self, session: &mut Session, ctx: &mut Self::CTX) -> Result<bool> {
        let path = session.req_header().uri.path();

        if path == "/healthz" {
            ctx.audit_enabled = false;
            return self.respond_json(session, 200, json!({"status":"ok","service":"pingora-gateway"})).await;
        }
        if path != CHAT_COMPLETIONS_PATH {
            return self.respond_json(session, 404, json!({"error":{"message":"not found","type":"not_found"}})).await;
        }
        if session.req_header().method != Method::POST {
            return self.respond_json(session, 405, json!({"error":{"message":"POST only","type":"method_not_allowed"}})).await;
        }

        // Auth
        let token = session.req_header().headers
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(parse_bearer_token);

        let Some(token) = token else {
            ctx.auth_result = AuthResult::Missing;
            self.auth_failures_total.inc();
            return self.respond_json(session, 401, json!({"error":{"message":"missing bearer token","type":"authentication_error"}})).await;
        };

        let key_hash = hash_api_key(token);
        ctx.key_hash_prefix = Some(hash_prefix(&key_hash));
        if !self.cache.read().map(|g| g.key_hashes.contains(&key_hash)).unwrap_or(false) {
            ctx.auth_result = AuthResult::InvalidKey;
            self.auth_failures_total.inc();
            return self.respond_json(session, 403, json!({"error":{"message":"invalid key","type":"permission_error"}})).await;
        }

        // Resolve provider
        if let Some((base_url, name, key)) = self.resolve_provider() {
            let url = url::Url::parse(&base_url).unwrap_or_else(|_| url::Url::parse("https://api.openai.com").unwrap());
            ctx.provider_base_url = Some(base_url);
            ctx.provider_name = Some(name);
            ctx.provider_key = Some(key);
            ctx.upstream_host = Some(url.host_str().unwrap_or("api.openai.com").to_owned());
        }

        ctx.auth_result = AuthResult::Ok;
        ctx.counted_active = true;
        self.active_requests.inc();
        Ok(false)
    }

    async fn request_body_filter(
        &self, _session: &mut Session, body: &mut Option<Bytes>, end_of_stream: bool, ctx: &mut Self::CTX,
    ) -> Result<()> where Self::CTX: Send + Sync {
        if let Some(ref b) = body {
            if ctx.body_probe.len() < BODY_PROBE_LIMIT {
                let r = BODY_PROBE_LIMIT - ctx.body_probe.len();
                ctx.body_probe.extend_from_slice(&b[..b.len().min(r)]);
            }
        }
        if !end_of_stream || ctx.body_rewritten { return Ok(()); }

        if let Ok(value) = serde_json::from_slice::<serde_json::Value>(&ctx.body_probe) {
            let original_model = value.get("model").and_then(|m| m.as_str()).unwrap_or("").to_owned();
            ctx.model = Some(original_model.clone());
            ctx.stream = value.get("stream").and_then(|s| s.as_bool());

            if !original_model.is_empty() {
                if let Ok(cache) = self.cache.read() {
                    if let Some(route) = cache.model_routes.get(&original_model) {
                        let mut raw = String::from_utf8_lossy(&ctx.body_probe).into_owned();
                        let prefix = "\"model\": \"";
                        if let Some(p) = raw.find(prefix) {
                            let vs = p + prefix.len();
                            if let Some(ve) = raw[vs..].find('"') {
                                let ve = vs + ve;
                                raw.replace_range(vs..ve, &route.provider_model_name);
                                let mut bytes = raw.into_bytes();
                                while bytes.len() < ctx.body_probe.len() { bytes.push(b' '); }
                                *body = Some(Bytes::from(bytes));
                                ctx.body_rewritten = true;
                                log::info!("model translated: '{original_model}' → '{}'",
                                    route.provider_model_name);
                            }
                        }
                    } else if let Some(route) = cache.model_routes.values().next() {
                        ctx.provider_base_url = Some(route.provider.provider_base_url.clone());
                        ctx.provider_name = Some(route.provider.provider_name.clone());
                        ctx.provider_key = Some(route.provider.provider_key.clone());
                        let u = url::Url::parse(&route.provider.provider_base_url).ok();
                        ctx.upstream_host = u.as_ref().and_then(|u| u.host_str().map(|h| h.to_owned()));
                    }
                }
            }
        }
        Ok(())
    }

    async fn upstream_peer(&self, _session: &mut Session, ctx: &mut Self::CTX) -> Result<Box<HttpPeer>> {
        let host = ctx.upstream_host.as_deref().unwrap_or("api.openai.com");
        let tls = ctx.provider_base_url.as_ref().map(|u| u.starts_with("https://")).unwrap_or(true);
        let port = if tls { 443 } else { 80 };
        Ok(Box::new(HttpPeer::new((host, port), tls, host.to_owned())))
    }

    async fn upstream_request_filter(
        &self, _session: &mut Session, upstream_request: &mut RequestHeader, ctx: &mut Self::CTX,
    ) -> Result<()> {
        if let Some(ref host) = ctx.upstream_host {
            upstream_request.insert_header("Host", host.as_str())?;
        }
        if let Some(ref key) = ctx.provider_key {
            upstream_request.insert_header("Authorization", format!("Bearer {key}"))?;
        }
        Ok(())
    }

    async fn response_filter(&self, _session: &mut Session, resp: &mut ResponseHeader, _ctx: &mut Self::CTX)
        -> Result<()> where Self::CTX: Send+Sync {
        resp.insert_header("X-LLM-Gateway", "pingora")?;
        Ok(())
    }

    async fn logging(&self, session: &mut Session, error: Option<&Error>, ctx: &mut Self::CTX)
        where Self::CTX: Send+Sync
    {
        let latency = ctx.started_at.elapsed();
        let status_code = session.response_written().map_or(0, |r| r.status.as_u16());
        self.requests_total.inc();
        self.request_duration.observe(latency.as_secs_f64());
        if error.is_some() { self.upstream_errors_total.inc(); }
        if ctx.counted_active { self.active_requests.dec(); }
        if !ctx.audit_enabled { return; }

        let event = AuditEvent {
            request_id: ctx.request_id,
            caller_id: None, app_id: None,
            client_ip: session.client_addr().map(|a| a.to_string()),
            method: session.req_header().method.to_string(),
            path: session.req_header().uri.path().to_owned(),
            model: ctx.model.clone(),
            stream: ctx.stream,
            status_code,
            auth_result: ctx.auth_result.clone(),
            reject_reason: ctx.reject_reason.clone(),
            provider: ctx.provider_name.clone(),
            upstream_host: ctx.provider_base_url.clone(),
            upstream_request_id: None,
            latency_ms: latency.as_millis(),
            key_hash_prefix: ctx.key_hash_prefix.clone(),
            user_agent: None,
            created_at: chrono::Utc::now(),
        };
        if let Ok(line) = serde_json::to_string(&event) {
            log::info!("{line}");
        }
    }
}

impl LlmGateway {
    async fn respond_json(&self, session: &mut Session, status: u16, body: serde_json::Value) -> Result<bool> {
        let body = Bytes::from(body.to_string());
        let mut h = ResponseHeader::build(status, Some(4))?;
        h.insert_header("Content-Type", "application/json")?;
        h.insert_header("Content-Length", body.len().to_string())?;
        session.write_response_header(Box::new(h), false).await?;
        session.write_response_body(Some(body), true).await?;
        Ok(true)
    }
}
