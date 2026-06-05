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

use crate::config::GatewayConfig;

const CHAT_COMPLETIONS_PATH: &str = "/v1/chat/completions";
const BODY_PROBE_LIMIT: usize = 64 * 1024;

pub struct LlmGateway {
    config: Arc<GatewayConfig>,
    requests_total: IntCounter,
    auth_failures_total: IntCounter,
    upstream_errors_total: IntCounter,
    active_requests: IntGauge,
    request_duration: Histogram,
}

#[derive(Debug)]
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
}

impl LlmGateway {
    pub fn new(config: Arc<GatewayConfig>) -> std::result::Result<Self, prometheus::Error> {
        Ok(Self {
            config,
            requests_total: register_int_counter!(
                "gateway_requests_total",
                "Total requests seen by the Pingora gateway"
            )?,
            auth_failures_total: register_int_counter!(
                "gateway_auth_failures_total",
                "Gateway authentication failures"
            )?,
            upstream_errors_total: register_int_counter!(
                "gateway_upstream_errors_total",
                "Gateway upstream proxy errors"
            )?,
            active_requests: register_int_gauge!(
                "gateway_active_requests",
                "Current active proxied requests"
            )?,
            request_duration: register_histogram!(
                "gateway_request_duration_seconds",
                "Gateway request latency in seconds"
            )?,
        })
    }

    async fn respond_json(
        &self,
        session: &mut Session,
        status: u16,
        body: serde_json::Value,
    ) -> Result<()> {
        let body = Bytes::from(body.to_string());
        let mut header = ResponseHeader::build(status, Some(4))?;
        header.insert_header("Content-Type", "application/json")?;
        header.insert_header("Content-Length", body.len().to_string())?;
        session
            .write_response_header(Box::new(header), false)
            .await?;
        session.write_response_body(Some(body), true).await
    }

    fn observe_body_probe(ctx: &mut RequestContext, body: &[u8], end_of_stream: bool) {
        if ctx.body_probe.len() < BODY_PROBE_LIMIT {
            let remaining = BODY_PROBE_LIMIT - ctx.body_probe.len();
            ctx.body_probe
                .extend_from_slice(&body[..body.len().min(remaining)]);
        }

        if end_of_stream {
            if let Ok(value) = serde_json::from_slice::<serde_json::Value>(&ctx.body_probe) {
                ctx.model = value
                    .get("model")
                    .and_then(|model| model.as_str())
                    .map(ToOwned::to_owned);
                ctx.stream = value.get("stream").and_then(|stream| stream.as_bool());
            }
        }
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
        }
    }

    async fn request_filter(&self, session: &mut Session, ctx: &mut Self::CTX) -> Result<bool> {
        let path = session.req_header().uri.path();

        if path == "/healthz" {
            ctx.audit_enabled = false;
            self.respond_json(
                session,
                200,
                json!({
                    "status": "ok",
                    "service": "pingora-gateway"
                }),
            )
            .await?;
            return Ok(true);
        }

        if path != CHAT_COMPLETIONS_PATH {
            ctx.auth_result = AuthResult::InvalidFormat;
            ctx.reject_reason = Some("unsupported_path".to_owned());
            self.respond_json(
                session,
                404,
                json!({
                    "error": {
                        "message": "unsupported gateway path",
                        "type": "not_found"
                    }
                }),
            )
            .await?;
            return Ok(true);
        }

        if session.req_header().method != Method::POST {
            ctx.auth_result = AuthResult::InvalidFormat;
            ctx.reject_reason = Some("method_not_allowed".to_owned());
            self.respond_json(
                session,
                405,
                json!({
                    "error": {
                        "message": "only POST is allowed",
                        "type": "method_not_allowed"
                    }
                }),
            )
            .await?;
            return Ok(true);
        }

        let authorization = session
            .req_header()
            .headers
            .get("Authorization")
            .and_then(|value| value.to_str().ok());

        let Some(token) = authorization.and_then(parse_bearer_token) else {
            ctx.auth_result = AuthResult::Missing;
            ctx.reject_reason = Some("missing_internal_api_key".to_owned());
            self.auth_failures_total.inc();
            self.respond_json(
                session,
                401,
                json!({
                    "error": {
                        "message": "missing Authorization bearer token",
                        "type": "authentication_error"
                    }
                }),
            )
            .await?;
            return Ok(true);
        };

        let key_hash = hash_api_key(token);
        ctx.key_hash_prefix = Some(hash_prefix(&key_hash));
        if !self.config.internal_api_key_hashes.contains(&key_hash) {
            ctx.auth_result = AuthResult::InvalidKey;
            ctx.reject_reason = Some("invalid_internal_api_key".to_owned());
            self.auth_failures_total.inc();
            self.respond_json(
                session,
                403,
                json!({
                    "error": {
                        "message": "invalid internal API key",
                        "type": "permission_error"
                    }
                }),
            )
            .await?;
            return Ok(true);
        }

        if self.config.openai_api_key.is_none() {
            ctx.auth_result = AuthResult::UpstreamKeyMissing;
            ctx.reject_reason = Some("missing_openai_api_key".to_owned());
            self.respond_json(
                session,
                503,
                json!({
                    "error": {
                        "message": "upstream provider key is not configured",
                        "type": "provider_unavailable"
                    }
                }),
            )
            .await?;
            return Ok(true);
        }

        ctx.auth_result = AuthResult::Ok;
        ctx.counted_active = true;
        self.active_requests.inc();
        Ok(false)
    }

    async fn upstream_peer(
        &self,
        _session: &mut Session,
        _ctx: &mut Self::CTX,
    ) -> Result<Box<HttpPeer>> {
        let peer = HttpPeer::new(
            (
                self.config.upstream_host.as_str(),
                self.config.upstream_port,
            ),
            self.config.upstream_tls,
            self.config.upstream_host.clone(),
        );
        Ok(Box::new(peer))
    }

    async fn upstream_request_filter(
        &self,
        _session: &mut Session,
        upstream_request: &mut RequestHeader,
        _ctx: &mut Self::CTX,
    ) -> Result<()> {
        upstream_request.insert_header("Host", self.config.upstream_host.clone())?;
        upstream_request.insert_header(
            "Authorization",
            format!(
                "Bearer {}",
                self.config.openai_api_key.as_deref().unwrap_or_default()
            ),
        )?;
        upstream_request.insert_header("X-LLM-Gateway", "pingora")?;
        Ok(())
    }

    async fn request_body_filter(
        &self,
        _session: &mut Session,
        body: &mut Option<Bytes>,
        end_of_stream: bool,
        ctx: &mut Self::CTX,
    ) -> Result<()>
    where
        Self::CTX: Send + Sync,
    {
        if let Some(body) = body.as_ref() {
            Self::observe_body_probe(ctx, body, end_of_stream);
        }
        Ok(())
    }

    async fn response_filter(
        &self,
        _session: &mut Session,
        upstream_response: &mut ResponseHeader,
        _ctx: &mut Self::CTX,
    ) -> Result<()>
    where
        Self::CTX: Send + Sync,
    {
        upstream_response.insert_header("X-LLM-Gateway", "pingora")?;
        upstream_response.remove_header("alt-svc");
        Ok(())
    }

    async fn logging(&self, session: &mut Session, error: Option<&Error>, ctx: &mut Self::CTX)
    where
        Self::CTX: Send + Sync,
    {
        let latency = ctx.started_at.elapsed();
        let status_code = session
            .response_written()
            .map_or(0, |response| response.status.as_u16());

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
            client_ip: session
                .client_addr()
                .map(|addr| addr.to_string())
                .or_else(|| header_value_to_string(session.get_header("X-Forwarded-For"))),
            method: session.req_header().method.to_string(),
            path: session.req_header().uri.path().to_owned(),
            model: ctx.model.clone(),
            stream: ctx.stream,
            status_code,
            auth_result: ctx.auth_result.clone(),
            reject_reason: ctx.reject_reason.clone(),
            provider: Some("openai".to_owned()),
            upstream_host: Some(self.config.upstream_host.clone()),
            upstream_request_id: session
                .get_header("x-request-id")
                .or_else(|| session.get_header("request-id"))
                .and_then(|value| value.to_str().ok())
                .map(ToOwned::to_owned),
            latency_ms: latency.as_millis(),
            key_hash_prefix: ctx.key_hash_prefix.clone(),
            user_agent: header_value_to_string(session.get_header("User-Agent")),
            created_at: chrono::Utc::now(),
        };

        match serde_json::to_string(&event) {
            Ok(line) => log::info!("{line}"),
            Err(err) => log::warn!("failed to serialize audit event: {err}"),
        }
    }
}

fn header_value_to_string(value: Option<&http::HeaderValue>) -> Option<String> {
    value
        .and_then(|value| value.to_str().ok())
        .map(ToOwned::to_owned)
}
