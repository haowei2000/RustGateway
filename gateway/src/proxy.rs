use std::{
    collections::{HashMap, VecDeque},
    sync::{Arc, Mutex, RwLock},
    time::Instant,
};

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

use crate::config::GatewayConfig;
use crate::db::{
    Cache, ModelTarget, ProviderInfo, RateLimitConfig, RouteCandidate, RoutingStrategy,
};

const CHAT_COMPLETIONS_PATH: &str = "/v1/chat/completions";
const MAX_REQUEST_BODY: usize = 4 * 1024 * 1024;

// ── Rate limiter ──────────────────────────────────────────────────

type RateLimitStore = Arc<RwLock<HashMap<String, VecDeque<RateLimitEntry>>>>;

#[derive(Clone)]
struct RateLimitEntry {
    timestamp: Instant,
    tokens: u64,
}

fn check_rate_limit(
    store: &RateLimitStore,
    key_hash: &str,
    config: &RateLimitConfig,
) -> Option<String> {
    let now = Instant::now();
    let mut map = store.write().unwrap();
    let entries = map.entry(key_hash.to_owned()).or_default();

    // Prune entries older than 60s (covers both per-minute checks)
    while entries
        .front()
        .is_some_and(|e| now.duration_since(e.timestamp).as_secs() > 60)
    {
        entries.pop_front();
    }

    // Check requests_per_minute
    if let Some(limit) = config.requests_per_minute {
        let count = entries.len() as i32;
        if count >= limit {
            return Some(format!(
                "rate limit exceeded: {} requests per minute (limit: {limit})",
                count
            ));
        }
    }

    // Check tokens_per_minute
    if let Some(limit) = config.tokens_per_minute {
        let total: u64 = entries.iter().map(|e| e.tokens).sum();
        if total as i32 >= limit {
            return Some(format!(
                "rate limit exceeded: {total} tokens per minute (limit: {limit})"
            ));
        }
    }

    // per-day checks are best-effort (we only keep 60s window in memory);
    // for a full implementation, use Redis counters.
    None
}

fn record_rate_limit(store: &RateLimitStore, key_hash: &str, tokens: u64) {
    let mut map = store.write().unwrap();
    map.entry(key_hash.to_owned())
        .or_default()
        .push_back(RateLimitEntry {
            timestamp: Instant::now(),
            tokens,
        });
}

// ── Gateway ───────────────────────────────────────────────────────

pub struct LlmGateway {
    cache: Cache,
    rate_limits: RateLimitStore,
    /// epichust_model_name → round-robin cursor (survives cache refreshes)
    rr_counters: Arc<Mutex<HashMap<String, u64>>>,
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
    key_hash: Option<String>,
    key_hash_prefix: Option<String>,
    model: Option<String>,
    stream: Option<bool>,
    body_buf: Vec<u8>,
    body_emitted: bool,
    provider_base_url: Option<String>,
    provider_name: Option<String>,
    provider_key: Option<String>,
    upstream_host: Option<String>,
    upstream_port: Option<u16>,
}

impl LlmGateway {
    pub fn new(
        _config: Arc<GatewayConfig>,
        cache: Cache,
    ) -> std::result::Result<Self, prometheus::Error> {
        Ok(Self {
            cache,
            rate_limits: Arc::new(RwLock::new(HashMap::new())),
            rr_counters: Arc::new(Mutex::new(HashMap::new())),
            requests_total: register_int_counter!("gateway_requests_total", "Total requests")?,
            auth_failures_total: register_int_counter!(
                "gateway_auth_failures_total",
                "Auth failures"
            )?,
            upstream_errors_total: register_int_counter!(
                "gateway_upstream_errors_total",
                "Upstream errors"
            )?,
            active_requests: register_int_gauge!("gateway_active_requests", "Active requests")?,
            request_duration: register_histogram!(
                "gateway_request_duration_seconds",
                "Request latency"
            )?,
        })
    }

    /// Choose one upstream for `model` according to the policy's routing
    /// strategy. `target.routes` is pre-sorted (priority ASC, weight DESC).
    fn select_route(
        &self,
        model: &str,
        target: &ModelTarget,
        request_id: &Uuid,
    ) -> Option<RouteCandidate> {
        if target.routes.is_empty() {
            return None;
        }
        let chosen = match target.strategy {
            RoutingStrategy::Priority => &target.routes[0],
            RoutingStrategy::RoundRobin => {
                let mut counters = self.rr_counters.lock().unwrap();
                let cursor = counters.entry(model.to_owned()).or_insert(0);
                let idx = (*cursor as usize) % target.routes.len();
                *cursor = cursor.wrapping_add(1);
                &target.routes[idx]
            }
            RoutingStrategy::Weighted => {
                let total: u64 = target.routes.iter().map(|r| r.weight.max(1) as u64).sum();
                // request_id is a v4 UUID → uniformly random; use it as the dice roll.
                let mut pick = (request_id.as_u128() % total as u128) as u64;
                let mut selected = &target.routes[0];
                for route in &target.routes {
                    let w = route.weight.max(1) as u64;
                    if pick < w {
                        selected = route;
                        break;
                    }
                    pick -= w;
                }
                selected
            }
        };
        Some(chosen.clone())
    }

    /// Point the context at a provider (base url, key, upstream host/port).
    fn point_ctx_at_provider(&self, ctx: &mut RequestContext, p: &ProviderInfo) {
        ctx.provider_base_url = Some(p.provider_base_url.clone());
        ctx.provider_name = Some(p.provider_name.clone());
        ctx.provider_key = Some(p.provider_key.clone());
        if let Ok(u) = url::Url::parse(&p.provider_base_url) {
            ctx.upstream_host = u.host_str().map(|h| h.to_owned());
            ctx.upstream_port = u.port_or_known_default();
        }
    }

    /// Content-based routing: parse the request body, pick the upstream from the
    /// `model`'s policy, rewrite the model name to the provider's model, and
    /// point ctx at that provider. Must run BEFORE upstream_peer connects.
    /// Falls back to the first available route when the model has no policy.
    /// Returns the body bytes to forward upstream.
    fn route_on_model(&self, ctx: &mut RequestContext, raw: Vec<u8>) -> Vec<u8> {
        let parsed = serde_json::from_slice::<serde_json::Value>(&raw).ok();
        let model = parsed
            .as_ref()
            .and_then(|v| v.get("model"))
            .and_then(|m| m.as_str())
            .unwrap_or("")
            .to_owned();
        ctx.stream = parsed
            .as_ref()
            .and_then(|v| v.get("stream"))
            .and_then(|s| s.as_bool());
        if !model.is_empty() {
            ctx.model = Some(model.clone());
        }

        let route = if model.is_empty() {
            None
        } else {
            self.cache.read().ok().and_then(|cache| {
                cache
                    .model_routes
                    .get(&model)
                    .and_then(|t| self.select_route(&model, t, &ctx.request_id))
            })
        };

        if let Some(route) = route {
            self.point_ctx_at_provider(ctx, &route.provider);
            if let Some(mut value) = parsed {
                value["model"] = serde_json::Value::String(route.provider_model_name.clone());
                log::info!(
                    "model routed: '{model}' → '{}' (provider {})",
                    route.provider_model_name,
                    route.provider.provider_name
                );
                return serde_json::to_vec(&value).unwrap_or(raw);
            }
            return raw;
        }

        // No policy for this model — fall back to the first available route so
        // un-mapped requests still reach an upstream (legacy behaviour).
        if let Ok(cache) = self.cache.read() {
            if let Some(first) = cache
                .model_routes
                .values()
                .next()
                .and_then(|t| t.routes.first())
            {
                self.point_ctx_at_provider(ctx, &first.provider);
            }
        }
        raw
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
            key_hash: None,
            key_hash_prefix: None,
            model: None,
            stream: None,
            body_buf: Vec::new(),
            body_emitted: false,
            provider_base_url: None,
            provider_name: None,
            provider_key: None,
            upstream_host: None,
            upstream_port: None,
        }
    }

    async fn request_filter(&self, session: &mut Session, ctx: &mut Self::CTX) -> Result<bool> {
        let path = session.req_header().uri.path();
        if path == "/healthz" {
            ctx.audit_enabled = false;
            return respond_json(
                session,
                200,
                json!({"status":"ok","service":"pingora-gateway"}),
            )
            .await;
        }
        if path != CHAT_COMPLETIONS_PATH {
            return respond_json(
                session,
                404,
                json!({"error":{"message":"not found","type":"not_found"}}),
            )
            .await;
        }
        if session.req_header().method != Method::POST {
            return respond_json(
                session,
                405,
                json!({"error":{"message":"POST only","type":"method_not_allowed"}}),
            )
            .await;
        }

        let token = session
            .req_header()
            .headers
            .get("Authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(parse_bearer_token);
        let Some(token) = token else {
            ctx.auth_result = AuthResult::Missing;
            self.auth_failures_total.inc();
            return respond_json(
                session,
                401,
                json!({"error":{"message":"missing bearer token","type":"authentication_error"}}),
            )
            .await;
        };
        let key_hash = hash_api_key(token);
        ctx.key_hash_prefix = Some(hash_prefix(&key_hash));
        ctx.key_hash = Some(key_hash.clone());
        if !self
            .cache
            .read()
            .map(|g| g.key_hashes.contains(&key_hash))
            .unwrap_or(false)
        {
            ctx.auth_result = AuthResult::InvalidKey;
            self.auth_failures_total.inc();
            return respond_json(
                session,
                403,
                json!({"error":{"message":"invalid key","type":"permission_error"}}),
            )
            .await;
        }

        // Check rate limits (clone config to drop read lock before await)
        let rate_config = self
            .cache
            .read()
            .ok()
            .and_then(|c| c.rate_limits.get(&key_hash).cloned());
        if let Some(config) = rate_config {
            if !config.is_empty() {
                if let Some(msg) = check_rate_limit(&self.rate_limits, &key_hash, &config) {
                    ctx.reject_reason = Some(msg.clone());
                    return respond_json(
                        session,
                        429,
                        json!({"error":{"message":msg,"type":"rate_limit_exceeded"}}),
                    )
                    .await;
                }
            }
        }

        // Record request in rate limiter (tokens=0 for now; updated in response if possible)
        record_rate_limit(&self.rate_limits, &key_hash, 0);

        // Content-based routing: read the full request body and choose the
        // upstream from the model BEFORE the upstream connection is opened.
        // (Selecting in a later body filter is too late — the peer is fixed.)
        let mut raw = Vec::new();
        loop {
            match session.read_request_body().await {
                Ok(Some(chunk)) => {
                    raw.extend_from_slice(&chunk);
                    if raw.len() > MAX_REQUEST_BODY {
                        return respond_json(
                            session,
                            413,
                            json!({"error":{"message":"request body too large","type":"invalid_request_error"}}),
                        )
                        .await;
                    }
                }
                Ok(None) => break,
                Err(_) => break,
            }
        }
        ctx.body_buf = self.route_on_model(ctx, raw);

        if ctx.provider_base_url.is_none() {
            return respond_json(
                session,
                503,
                json!({"error":{"message":"no upstream provider","type":"provider_unavailable"}}),
            )
            .await;
        }

        ctx.auth_result = AuthResult::Ok;
        ctx.counted_active = true;
        self.active_requests.inc();
        Ok(false)
    }

    async fn request_body_filter(
        &self,
        _session: &mut Session,
        body: &mut Option<Bytes>,
        _end_of_stream: bool,
        ctx: &mut Self::CTX,
    ) -> Result<()>
    where
        Self::CTX: Send + Sync,
    {
        // The body was fully read and rewritten in request_filter; emit it once
        // to the upstream, then drop any further (already-consumed) chunks.
        if ctx.body_emitted {
            *body = None;
        } else {
            *body = Some(Bytes::from(std::mem::take(&mut ctx.body_buf)));
            ctx.body_emitted = true;
        }
        Ok(())
    }

    async fn upstream_peer(
        &self,
        _session: &mut Session,
        ctx: &mut Self::CTX,
    ) -> Result<Box<HttpPeer>> {
        let host = ctx.upstream_host.as_deref().unwrap_or("api.openai.com");
        let tls = ctx
            .provider_base_url
            .as_ref()
            .map(|u| u.starts_with("https://"))
            .unwrap_or(true);
        let port = ctx.upstream_port.unwrap_or(if tls { 443 } else { 80 });
        Ok(Box::new(HttpPeer::new((host, port), tls, host.to_owned())))
    }

    async fn upstream_request_filter(
        &self,
        _session: &mut Session,
        upstream_request: &mut RequestHeader,
        ctx: &mut Self::CTX,
    ) -> Result<()> {
        if let Some(ref host) = ctx.upstream_host {
            upstream_request.insert_header("Host", host.as_str())?;
        }
        if let Some(ref key) = ctx.provider_key {
            upstream_request.insert_header("Authorization", format!("Bearer {key}"))?;
        }
        // We buffered + (maybe) rewrote the body in request_filter and emit it
        // ourselves, so set the exact length the upstream should expect.
        upstream_request.insert_header("Content-Length", ctx.body_buf.len().to_string())?;
        Ok(())
    }

    async fn response_filter(
        &self,
        _session: &mut Session,
        resp: &mut ResponseHeader,
        _ctx: &mut Self::CTX,
    ) -> Result<()>
    where
        Self::CTX: Send + Sync,
    {
        resp.insert_header("X-LLM-Gateway", "pingora")?;
        Ok(())
    }

    async fn logging(&self, session: &mut Session, error: Option<&Error>, ctx: &mut Self::CTX)
    where
        Self::CTX: Send + Sync,
    {
        let latency = ctx.started_at.elapsed();
        let sc = session.response_written().map_or(0, |r| r.status.as_u16());
        self.requests_total.inc();
        self.request_duration.observe(latency.as_secs_f64());
        if error.is_some() {
            self.upstream_errors_total.inc();
        }
        if ctx.counted_active {
            self.active_requests.dec();
        }
        if !ctx.audit_enabled {
            return;
        }
        let event = AuditEvent {
            request_id: ctx.request_id,
            caller_id: None,
            app_id: None,
            client_ip: session.client_addr().map(|a| a.to_string()),
            method: session.req_header().method.to_string(),
            path: session.req_header().uri.path().to_owned(),
            model: ctx.model.clone(),
            stream: ctx.stream,
            status_code: sc,
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

async fn respond_json(session: &mut Session, status: u16, body: serde_json::Value) -> Result<bool> {
    let body = Bytes::from(body.to_string());
    let mut h = ResponseHeader::build(status, Some(4))?;
    h.insert_header("Content-Type", "application/json")?;
    h.insert_header("Content-Length", body.len().to_string())?;
    session.write_response_header(Box::new(h), false).await?;
    session.write_response_body(Some(body), true).await?;
    Ok(true)
}
