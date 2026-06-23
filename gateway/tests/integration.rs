//! End-to-end integration test for the Pingora data-plane gateway.
//!
//! This seeds a complete routing graph directly into the live PostgreSQL
//! database, stands up an in-process **mock upstream** HTTP server, then spawns
//! the *real* `pingora-gateway` binary pointed at both and drives it over HTTP.
//! It verifies the full proxy behaviour:
//!
//!   * `/healthz` liveness
//!   * method / path gating (405 for GET, 404 for unknown paths)
//!   * authentication: 401 (no bearer), 403 (unknown key)
//!   * a valid key is proxied upstream and returns the upstream 200 body
//!   * **provider key substitution** — upstream sees `Bearer <provider_key>`,
//!     not the client's key
//!   * **model-name translation** — upstream sees the provider model name,
//!     not the gateway-facing (epichust) name
//!   * the `X-LLM-Gateway` response header is injected
//!   * **SSE passthrough** — a streaming upstream response is relayed
//!   * **rate limiting** — a key whose policy caps requests/minute gets a 429
//!   * Prometheus metrics are exported and auth failures were counted
//!
//! Expects the local-dev Postgres from `make dev-infra`. If it is unreachable
//! the test prints a notice and returns early. Run explicitly with:
//!     cargo test -p pingora-gateway --test integration -- --nocapture

use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use llm_gateway_common::api_key::{hash_api_key, hash_prefix};
use sqlx::PgPool;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

const GATEWAY_ADDR: &str = "127.0.0.1:18080";
const METRICS_ADDR: &str = "127.0.0.1:19090";
const DEFAULT_DATABASE_URL: &str = "postgres://llm:llm@localhost:5433/llm_gateway";
const CHAT_PATH: &str = "/v1/chat/completions";
const PROVIDER_KEY: &str = "sk-upstream-itest";
const PROVIDER_MODEL: &str = "gpt-4o-mini";

struct ChildGuard(Child);
impl Drop for ChildGuard {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

/// Returns `Err(message)` instead of panicking, so the caller can always run
/// cleanup before surfacing the failure.
macro_rules! check {
    ($cond:expr, $($arg:tt)*) => {
        if !($cond) {
            return Err(format!($($arg)*));
        }
    };
}

fn database_url() -> String {
    std::env::var("DATABASE_URL")
        .ok()
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| DEFAULT_DATABASE_URL.to_owned())
}

fn nonce() -> String {
    let pid = std::process::id();
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{pid}{nanos}")
}

// ── Mock upstream provider ───────────────────────────────────────────

/// What the mock saw on a single proxied request — lets the test assert that
/// the gateway rewrote the auth header and the model name before forwarding.
#[derive(Clone, Debug)]
struct Captured {
    authorization: Option<String>,
    model: Option<String>,
}

struct Mock {
    captured: Mutex<Vec<Captured>>,
}

impl Mock {
    fn last(&self) -> Option<Captured> {
        self.captured.lock().unwrap().last().cloned()
    }
}

/// Binds an ephemeral port and serves minimal OpenAI-shaped chat responses.
/// Returns the `http://host:port` base URL and a handle to inspect requests.
async fn start_mock_upstream() -> (String, Arc<Mock>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind mock");
    let addr = listener.local_addr().unwrap();
    let mock = Arc::new(Mock {
        captured: Mutex::new(Vec::new()),
    });
    let mock_for_loop = mock.clone();
    tokio::spawn(async move {
        while let Ok((socket, _)) = listener.accept().await {
            let mock = mock_for_loop.clone();
            tokio::spawn(async move {
                let _ = handle_upstream_conn(socket, mock).await;
            });
        }
    });
    (format!("http://{addr}"), mock)
}

fn find_subsequence(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}

async fn handle_upstream_conn(mut socket: TcpStream, mock: Arc<Mock>) -> std::io::Result<()> {
    // Read until end of headers.
    let mut buf = Vec::new();
    let mut tmp = [0u8; 4096];
    let header_end = loop {
        let n = socket.read(&mut tmp).await?;
        if n == 0 {
            return Ok(());
        }
        buf.extend_from_slice(&tmp[..n]);
        if let Some(pos) = find_subsequence(&buf, b"\r\n\r\n") {
            break pos + 4;
        }
        if buf.len() > 1 << 20 {
            return Ok(());
        }
    };

    let header_text = String::from_utf8_lossy(&buf[..header_end]).into_owned();
    let mut lines = header_text.split("\r\n");
    let _request_line = lines.next().unwrap_or("");
    let mut content_length = 0usize;
    let mut authorization = None;
    for line in lines {
        if let Some((k, v)) = line.split_once(':') {
            match k.trim().to_ascii_lowercase().as_str() {
                "content-length" => content_length = v.trim().parse().unwrap_or(0),
                "authorization" => authorization = Some(v.trim().to_owned()),
                _ => {}
            }
        }
    }

    // Read the rest of the body up to Content-Length.
    let mut body = buf[header_end..].to_vec();
    while body.len() < content_length {
        let n = socket.read(&mut tmp).await?;
        if n == 0 {
            break;
        }
        body.extend_from_slice(&tmp[..n]);
    }

    let parsed: serde_json::Value =
        serde_json::from_slice(&body).unwrap_or(serde_json::Value::Null);
    let model = parsed
        .get("model")
        .and_then(|m| m.as_str())
        .map(|s| s.to_owned());
    let stream = parsed
        .get("stream")
        .and_then(|s| s.as_bool())
        .unwrap_or(false);

    mock.captured.lock().unwrap().push(Captured {
        authorization,
        model,
    });

    let response = if stream {
        let sse = "data: {\"id\":\"mock\",\"choices\":[{\"delta\":{\"content\":\"hi\"}}]}\n\n\
                   data: [DONE]\n\n";
        format!(
            "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\n\
             Content-Length: {}\r\nConnection: close\r\n\r\n{}",
            sse.len(),
            sse
        )
    } else {
        let json = "{\"id\":\"mock-cmpl\",\"object\":\"chat.completion\",\
                    \"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"hello from mock\"}}]}";
        format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\
             Content-Length: {}\r\nConnection: close\r\n\r\n{}",
            json.len(),
            json
        )
    };
    socket.write_all(response.as_bytes()).await?;
    socket.flush().await?;
    Ok(())
}

// ── DB seeding ───────────────────────────────────────────────────────

/// IDs of everything we insert, so we can tear it down precisely.
struct Seed {
    provider_id: String,
    provider_model_id: String,
    epichust_model_id: String,
    policy_id: String,
    api_key_id: String,
    limited_api_key_id: String,
    epichust_model_name: String,
    plaintext_key: String,
    limited_plaintext_key: String,
}

async fn seed(pool: &PgPool, run: &str, upstream_base_url: &str) -> Seed {
    let provider_id = format!("provider_itest_{run}");
    let provider_model_id = format!("pm_itest_{run}");
    let epichust_model_id = format!("em_itest_{run}");
    let policy_id = format!("mp_itest_{run}");
    let api_key_id = format!("key_itest_{run}");
    let limited_api_key_id = format!("keylim_itest_{run}");
    let epichust_model_name = format!("itest-gw-chat-{run}");
    let plaintext_key = format!("llmgw_itest_{run}");
    let limited_plaintext_key = format!("llmgw_itestlim_{run}");

    sqlx::query(
        "INSERT INTO providers (id, provider_name, provider_base_url, provider_key_ciphertext) \
         VALUES ($1, $2, $3, $4)",
    )
    .bind(&provider_id)
    .bind(format!("itest-provider-{run}"))
    .bind(upstream_base_url)
    .bind(PROVIDER_KEY.as_bytes().to_vec())
    .execute(pool)
    .await
    .expect("seed provider");

    sqlx::query("INSERT INTO provider_models (id, provider_id, model_name) VALUES ($1, $2, $3)")
        .bind(&provider_model_id)
        .bind(&provider_id)
        .bind(PROVIDER_MODEL)
        .execute(pool)
        .await
        .expect("seed provider_model");

    sqlx::query("INSERT INTO epichust_models (id, model_name, model_type) VALUES ($1, $2, $3)")
        .bind(&epichust_model_id)
        .bind(&epichust_model_name)
        .bind("chat_model")
        .execute(pool)
        .await
        .expect("seed epichust_model");

    sqlx::query(
        "INSERT INTO mapping_policies (id, epichust_model_id, routing_strategy, enabled) \
         VALUES ($1, $2, 'weighted', true)",
    )
    .bind(&policy_id)
    .bind(&epichust_model_id)
    .execute(pool)
    .await
    .expect("seed mapping_policy");

    sqlx::query(
        "INSERT INTO mapping_policy_routes \
         (mapping_policy_id, provider_model_id, weight, priority, enabled) \
         VALUES ($1, $2, 100, 100, true)",
    )
    .bind(&policy_id)
    .bind(&provider_model_id)
    .execute(pool)
    .await
    .expect("seed mapping_policy_route");

    // A requests-per-minute cap of 1 — applies only to the key linked below.
    sqlx::query(
        "INSERT INTO rate_limit_rules (id, mapping_policy_id, limit_type, limit_value) \
         VALUES ($1, $2, 'requests_per_minute', 1)",
    )
    .bind(format!("rlr_itest_{run}"))
    .bind(&policy_id)
    .execute(pool)
    .await
    .expect("seed rate_limit_rule");

    // Unlimited key (not linked to any policy → no rate config in cache).
    insert_key(pool, &api_key_id, &plaintext_key, run, "main").await;
    // Rate-limited key (linked to the policy carrying the rule above).
    insert_key(
        pool,
        &limited_api_key_id,
        &limited_plaintext_key,
        run,
        "limited",
    )
    .await;
    sqlx::query(
        "INSERT INTO api_key_mapping_policies (api_key_id, mapping_policy_id, enabled) \
         VALUES ($1, $2, true)",
    )
    .bind(&limited_api_key_id)
    .bind(&policy_id)
    .execute(pool)
    .await
    .expect("link limited key to policy");

    Seed {
        provider_id,
        provider_model_id,
        epichust_model_id,
        policy_id,
        api_key_id,
        limited_api_key_id,
        epichust_model_name,
        plaintext_key,
        limited_plaintext_key,
    }
}

async fn insert_key(pool: &PgPool, id: &str, plaintext: &str, run: &str, tag: &str) {
    let key_hash = hash_api_key(plaintext);
    sqlx::query(
        "INSERT INTO epichust_api_keys (id, key_name, key_hash, key_hash_prefix, enabled) \
         VALUES ($1, $2, $3, $4, true)",
    )
    .bind(id)
    .bind(format!("itest-{tag}-{run}"))
    .bind(&key_hash)
    .bind(hash_prefix(&key_hash))
    .execute(pool)
    .await
    .expect("seed api key");
}

async fn cleanup(pool: &PgPool, s: &Seed) {
    let _ = sqlx::query("DELETE FROM api_key_mapping_policies WHERE mapping_policy_id = $1")
        .bind(&s.policy_id)
        .execute(pool)
        .await;
    for key_id in [&s.api_key_id, &s.limited_api_key_id] {
        let _ = sqlx::query("DELETE FROM epichust_api_keys WHERE id = $1")
            .bind(key_id)
            .execute(pool)
            .await;
    }
    // rate_limit_rules + mapping_policy_routes cascade from the policy.
    let _ = sqlx::query("DELETE FROM mapping_policies WHERE id = $1")
        .bind(&s.policy_id)
        .execute(pool)
        .await;
    let _ = sqlx::query("DELETE FROM provider_models WHERE id = $1")
        .bind(&s.provider_model_id)
        .execute(pool)
        .await;
    let _ = sqlx::query("DELETE FROM epichust_models WHERE id = $1")
        .bind(&s.epichust_model_id)
        .execute(pool)
        .await;
    let _ = sqlx::query("DELETE FROM providers WHERE id = $1")
        .bind(&s.provider_id)
        .execute(pool)
        .await;
}

// ── Gateway process ──────────────────────────────────────────────────

fn spawn_gateway(database_url: &str) -> ChildGuard {
    let child = Command::new(env!("CARGO_BIN_EXE_pingora-gateway"))
        .env("GATEWAY_BIND_ADDR", GATEWAY_ADDR)
        .env("METRICS_BIND_ADDR", METRICS_ADDR)
        .env("DATABASE_URL", database_url)
        .env("RUST_LOG", "warn")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("failed to spawn pingora-gateway binary");
    ChildGuard(child)
}

fn gw_url(path: &str) -> String {
    format!("http://{GATEWAY_ADDR}{path}")
}

async fn wait_for_health(client: &reqwest::Client) {
    let deadline = Instant::now() + Duration::from_secs(30);
    loop {
        if let Ok(resp) = client.get(gw_url("/healthz")).send().await {
            if resp.status().is_success() {
                return;
            }
        }
        if Instant::now() >= deadline {
            panic!("gateway did not become healthy within 30s");
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
}

async fn chat_request(
    client: &reqwest::Client,
    bearer: Option<&str>,
    model: &str,
    stream: bool,
) -> reqwest::Response {
    let mut req = client.post(gw_url(CHAT_PATH)).json(&serde_json::json!({
        "model": model,
        "messages": [{ "role": "user", "content": "hello" }],
        "stream": stream
    }));
    if let Some(token) = bearer {
        req = req.bearer_auth(token);
    }
    req.send().await.expect("chat request failed")
}

fn parse_counter(metrics: &str, name: &str) -> f64 {
    metrics
        .lines()
        .find(|line| line.starts_with(name) && !line.starts_with("# "))
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(0.0)
}

// ── Test ─────────────────────────────────────────────────────────────

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn gateway_data_plane_end_to_end() {
    let database_url = database_url();
    let Ok(pool) = PgPool::connect(&database_url).await else {
        eprintln!(
            "SKIP gateway_data_plane_end_to_end: PostgreSQL not reachable at {database_url}. \
             Start it with `make dev-infra`."
        );
        return;
    };

    let (upstream_base_url, mock) = start_mock_upstream().await;
    let run = nonce();
    let s = seed(&pool, &run, &upstream_base_url).await;

    // Spawn the gateway *after* seeding so its startup cache load sees our data.
    let _server = spawn_gateway(&database_url);
    let client = reqwest::Client::new();
    wait_for_health(&client).await;

    let result = run_assertions(&client, &mock, &s).await;

    cleanup(&pool, &s).await;
    pool.close().await;

    if let Err(message) = result {
        panic!("{message}");
    }
}

async fn run_assertions(
    client: &reqwest::Client,
    mock: &Arc<Mock>,
    s: &Seed,
) -> Result<(), String> {
    // ── 1. Liveness ──────────────────────────────────────────────────
    let resp = client.get(gw_url("/healthz")).send().await.unwrap();
    check!(resp.status() == 200, "healthz status: {}", resp.status());
    let body: serde_json::Value = resp.json().await.unwrap();
    check!(body["status"] == "ok", "healthz status field: {body}");
    check!(
        body["service"] == "pingora-gateway",
        "healthz service field: {body}"
    );

    // ── 2. Method / path gating ──────────────────────────────────────
    let resp = client.get(gw_url(CHAT_PATH)).send().await.unwrap();
    check!(
        resp.status() == 405,
        "GET on chat completions should be 405, got {}",
        resp.status()
    );
    let resp = client
        .get(gw_url("/v1/does-not-exist"))
        .send()
        .await
        .unwrap();
    check!(
        resp.status() == 404,
        "unknown path should be 404, got {}",
        resp.status()
    );

    // ── 3. Auth failures ─────────────────────────────────────────────
    let resp = chat_request(client, None, &s.epichust_model_name, false).await;
    check!(
        resp.status() == 401,
        "missing bearer should be 401, got {}",
        resp.status()
    );
    let body: serde_json::Value = resp.json().await.unwrap();
    check!(
        body["error"]["type"] == "authentication_error",
        "missing-token error type: {body}"
    );

    let resp = chat_request(
        client,
        Some("totally-wrong-key"),
        &s.epichust_model_name,
        false,
    )
    .await;
    check!(
        resp.status() == 403,
        "unknown key should be 403, got {}",
        resp.status()
    );
    let body: serde_json::Value = resp.json().await.unwrap();
    check!(
        body["error"]["type"] == "permission_error",
        "invalid-key error type: {body}"
    );

    // ── 4. Valid key is proxied to the upstream (poll until cache loads).
    let deadline = Instant::now() + Duration::from_secs(20);
    let resp = loop {
        let resp = chat_request(
            client,
            Some(&s.plaintext_key),
            &s.epichust_model_name,
            false,
        )
        .await;
        if resp.status() != 401 && resp.status() != 403 {
            break resp;
        }
        if Instant::now() >= deadline {
            return Err(
                "valid key never passed auth; gateway DB cache likely failed to load".to_owned(),
            );
        }
        tokio::time::sleep(Duration::from_millis(300)).await;
    };
    check!(
        resp.status() == 200,
        "valid key should be proxied to a 200, got {}",
        resp.status()
    );
    // X-LLM-Gateway header is injected on the proxied response.
    check!(
        resp.headers().get("x-llm-gateway").is_some(),
        "X-LLM-Gateway response header missing"
    );
    let body: serde_json::Value = resp.json().await.unwrap();
    check!(
        body["choices"][0]["message"]["content"] == "hello from mock",
        "upstream body not relayed: {body}"
    );

    // ── 5. Provider key substitution + model translation at the upstream.
    let seen = mock
        .last()
        .ok_or_else(|| "mock upstream received no request".to_owned())?;
    check!(
        seen.authorization.as_deref() == Some(&format!("Bearer {PROVIDER_KEY}")[..]),
        "upstream should see the provider key, saw {:?}",
        seen.authorization
    );
    check!(
        seen.model.as_deref() == Some(PROVIDER_MODEL),
        "model name should be translated to '{PROVIDER_MODEL}', upstream saw {:?}",
        seen.model
    );

    // ── 6. SSE passthrough ───────────────────────────────────────────
    let resp = chat_request(client, Some(&s.plaintext_key), &s.epichust_model_name, true).await;
    check!(
        resp.status() == 200,
        "SSE request status: {}",
        resp.status()
    );
    let ctype = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_owned();
    check!(
        ctype.contains("text/event-stream"),
        "SSE content-type not relayed: {ctype}"
    );
    let sse_body = resp.text().await.unwrap();
    check!(
        sse_body.contains("data:") && sse_body.contains("[DONE]"),
        "SSE body not relayed: {sse_body:?}"
    );

    // ── 7. Rate limiting (requests_per_minute = 1 on the limited key) ─
    let first = chat_request(
        client,
        Some(&s.limited_plaintext_key),
        &s.epichust_model_name,
        false,
    )
    .await
    .status();
    check!(
        first == 200,
        "first limited-key request should pass, got {first}"
    );
    let second = chat_request(
        client,
        Some(&s.limited_plaintext_key),
        &s.epichust_model_name,
        false,
    )
    .await;
    check!(
        second.status() == 429,
        "second limited-key request should be 429, got {}",
        second.status()
    );
    let body: serde_json::Value = second.json().await.unwrap();
    check!(
        body["error"]["type"] == "rate_limit_exceeded",
        "rate-limit error type: {body}"
    );

    // ── 8. Prometheus metrics ────────────────────────────────────────
    let resp = client
        .get(format!("http://{METRICS_ADDR}/metrics"))
        .send()
        .await
        .expect("metrics request failed");
    check!(
        resp.status() == 200,
        "metrics endpoint status: {}",
        resp.status()
    );
    let metrics = resp.text().await.unwrap();
    for name in [
        "gateway_requests_total",
        "gateway_auth_failures_total",
        "gateway_request_duration_seconds",
    ] {
        check!(metrics.contains(name), "metric {name} not exported");
    }
    let auth_failures = parse_counter(&metrics, "gateway_auth_failures_total");
    let counted_enough = auth_failures >= 2.0;
    check!(
        counted_enough,
        "expected >=2 auth failures (missing + invalid key), got {auth_failures}"
    );

    Ok(())
}
