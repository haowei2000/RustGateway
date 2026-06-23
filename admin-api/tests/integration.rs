//! End-to-end integration test for the admin-api control plane.
//!
//! This spawns the *real* `axum-admin-api` binary against a live PostgreSQL
//! instance and drives the full management lifecycle over HTTP, exercising
//! routing, serde request/response contracts, the auto-migration path, and
//! every repository SQL query through the public REST surface.
//!
//! It expects the local-dev Postgres from `make dev-infra`
//! (postgres://llm:llm@localhost:5433/llm_gateway). If the database is not
//! reachable the test prints a notice and returns early instead of failing,
//! so `cargo test` stays green in environments without the infra.
//!
//! Run it explicitly with:
//!     cargo test -p axum-admin-api --test integration -- --nocapture

use std::net::TcpStream;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use serde_json::{json, Value};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const ADMIN_ADDR: &str = "127.0.0.1:19000";
const DEFAULT_DATABASE_URL: &str = "postgres://llm:llm@localhost:5433/llm_gateway";

/// Kills the spawned server when the test scope ends (even on panic).
struct ChildGuard(Child);

impl Drop for ChildGuard {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

fn database_url() -> String {
    std::env::var("DATABASE_URL")
        .ok()
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| DEFAULT_DATABASE_URL.to_owned())
}

/// `postgres://user:pass@host:port/db` -> `host:port`, for a cheap reachability probe.
fn host_port(database_url: &str) -> Option<String> {
    let after_at = database_url.rsplit_once('@')?.1;
    let host_port = after_at.split(['/', '?']).next()?;
    Some(host_port.to_owned())
}

fn database_reachable(database_url: &str) -> bool {
    let Some(addr) = host_port(database_url) else {
        return false;
    };
    match addr.to_socket_addrs_first() {
        Some(sa) => TcpStream::connect_timeout(&sa, Duration::from_secs(2)).is_ok(),
        None => false,
    }
}

/// Tiny helper so we don't pull in extra deps just to resolve a socket addr.
trait FirstSocketAddr {
    fn to_socket_addrs_first(&self) -> Option<std::net::SocketAddr>;
}
impl FirstSocketAddr for String {
    fn to_socket_addrs_first(&self) -> Option<std::net::SocketAddr> {
        use std::net::ToSocketAddrs;
        self.to_socket_addrs().ok()?.next()
    }
}

fn spawn_admin_api(database_url: &str) -> ChildGuard {
    let child = Command::new(env!("CARGO_BIN_EXE_axum-admin-api"))
        .env("ADMIN_API_BIND_ADDR", ADMIN_ADDR)
        .env("DATABASE_URL", database_url)
        .env("DATABASE_AUTO_MIGRATE", "true")
        .env("RUST_LOG", "warn")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .expect("failed to spawn axum-admin-api binary");
    ChildGuard(child)
}

fn base_url() -> String {
    format!("http://{ADMIN_ADDR}")
}

async fn wait_until_ready(client: &reqwest::Client) {
    let deadline = Instant::now() + Duration::from_secs(30);
    let url = format!("{}/healthz", base_url());
    loop {
        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() {
                return;
            }
        }
        if Instant::now() >= deadline {
            panic!("admin-api did not become healthy within 30s");
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
}

/// POST helper returning (status, json body).
async fn post(client: &reqwest::Client, path: &str, body: Value) -> (reqwest::StatusCode, Value) {
    let resp = client
        .post(format!("{}{}", base_url(), path))
        .json(&body)
        .send()
        .await
        .expect("request failed");
    let status = resp.status();
    let value = resp.json::<Value>().await.unwrap_or(Value::Null);
    (status, value)
}

async fn get(client: &reqwest::Client, path: &str) -> (reqwest::StatusCode, Value) {
    let resp = client
        .get(format!("{}{}", base_url(), path))
        .send()
        .await
        .expect("request failed");
    let status = resp.status();
    let value = resp.json::<Value>().await.unwrap_or(Value::Null);
    (status, value)
}

async fn put(client: &reqwest::Client, path: &str, body: Value) -> reqwest::StatusCode {
    client
        .put(format!("{}{}", base_url(), path))
        .json(&body)
        .send()
        .await
        .expect("request failed")
        .status()
}

async fn delete(client: &reqwest::Client, path: &str) -> reqwest::StatusCode {
    client
        .delete(format!("{}{}", base_url(), path))
        .send()
        .await
        .expect("request failed")
        .status()
}

/// A unique suffix so repeated runs don't collide on UNIQUE columns
/// (epichust_models.model_name, providers, etc.). Derived from the PID +
/// a monotonic clock so it's stable within a run and distinct across runs.
fn nonce() -> String {
    let pid = std::process::id();
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{pid}-{nanos}")
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn admin_api_full_lifecycle() {
    let database_url = database_url();
    if !database_reachable(&database_url) {
        eprintln!(
            "SKIP admin_api_full_lifecycle: PostgreSQL not reachable at {database_url}. \
             Start it with `make dev-infra`."
        );
        return;
    }

    let _server = spawn_admin_api(&database_url);
    let client = reqwest::Client::new();
    wait_until_ready(&client).await;

    let run = nonce();

    // ── 1. Health & readiness ────────────────────────────────────────
    let (status, body) = get(&client, "/healthz").await;
    assert_eq!(status, 200, "healthz");
    assert_eq!(body["status"], "ok");
    assert_eq!(body["service"], "axum-admin-api");

    let (status, body) = get(&client, "/readyz").await;
    assert_eq!(
        status, 200,
        "readyz should be 200 when DB is configured & ready"
    );
    assert_eq!(body["database_configured"], true);
    assert_eq!(body["database_ready"], true);

    // ── 2. Create a provider ─────────────────────────────────────────
    let (status, body) = post(
        &client,
        "/admin-api/v1/providers",
        json!({
            "provider_name": format!("itest-provider-{run}"),
            "provider_base_url": "https://api.openai.com/v1",
            "provider_key": "sk-itest-upstream-key",
        }),
    )
    .await;
    assert_eq!(status, 200, "create provider: {body}");
    let provider_id = body["provider"]["id"]
        .as_str()
        .expect("provider id")
        .to_owned();
    assert!(
        provider_id.starts_with("provider_"),
        "id prefix: {provider_id}"
    );
    assert_eq!(body["provider"]["provider_model_count"], 0);
    assert_eq!(body["provider"]["policy_count"], 0);

    // ── 3. Register a provider model ─────────────────────────────────
    let (status, body) = post(
        &client,
        "/admin-api/v1/provider-models",
        json!({ "provider_id": provider_id, "model_name": "gpt-4o-mini" }),
    )
    .await;
    assert_eq!(status, 200, "create provider model: {body}");
    let provider_model_id = body["id"].as_str().expect("provider_model id").to_owned();
    assert_eq!(body["provider_id"], provider_id);
    assert_eq!(body["model_name"], "gpt-4o-mini");

    // GET /v1/provider-models lists what we just created.
    let (status, body) = get(&client, "/admin-api/v1/provider-models").await;
    assert_eq!(status, 200, "list provider models");
    assert!(
        body.as_array()
            .unwrap()
            .iter()
            .any(|m| m["id"] == provider_model_id),
        "provider model present in list"
    );

    // ── 4. Create a gateway-facing (epichust) model ──────────────────
    let epichust_model_name = format!("itest-chat-{run}");
    let (status, body) = post(
        &client,
        "/admin-api/v1/epichust-models",
        json!({ "model_name": epichust_model_name, "model_type": "chat_model" }),
    )
    .await;
    assert_eq!(status, 200, "create epichust model: {body}");
    let epichust_model_id = body["id"].as_str().expect("epichust id").to_owned();
    assert_eq!(body["model_type"], "chat_model");

    // GET /v1/epichust-models lists what we just created.
    let (status, body) = get(&client, "/admin-api/v1/epichust-models").await;
    assert_eq!(status, 200, "list epichust models");
    assert!(
        body.as_array()
            .unwrap()
            .iter()
            .any(|m| m["id"] == epichust_model_id),
        "epichust model present in list"
    );

    // ── 5. Create a mapping policy binding the two, with a rate limit ─
    let (status, body) = post(
        &client,
        "/admin-api/v1/mapping-policies",
        json!({
            "epichust_model_id": epichust_model_id,
            "routing_strategy": "weighted",
            "rate_limit_rules": [
                { "limit_type": "requests_per_minute", "limit_value": 60 }
            ],
            "enabled": true,
            "routes": [
                { "provider_model_id": provider_model_id, "weight": 100, "priority": 100, "enabled": true }
            ]
        }),
    )
    .await;
    assert_eq!(status, 200, "create mapping policy: {body}");
    let policy_id = body["id"].as_str().expect("policy id").to_owned();
    assert_eq!(body["epichust_model_name"], epichust_model_name);
    assert_eq!(body["enabled"], true);
    assert_eq!(body["routes"].as_array().unwrap().len(), 1, "one route");
    assert_eq!(
        body["routes"][0]["provider_model_name"], "gpt-4o-mini",
        "route resolves provider model name via join"
    );
    assert_eq!(
        body["routes"][0]["provider_name"],
        format!("itest-provider-{run}")
    );
    assert_eq!(
        body["rate_limit_rules"].as_array().unwrap().len(),
        1,
        "one rate limit rule"
    );
    assert_eq!(
        body["rate_limit_rules"][0]["limit_type"],
        "requests_per_minute"
    );
    assert_eq!(body["rate_limit_rules"][0]["limit_value"], 60);

    // ── 6. Create an API key (plaintext returned exactly once) ───────
    let (status, body) = post(
        &client,
        "/admin-api/v1/api-keys",
        json!({ "key_name": format!("itest-key-{run}") }),
    )
    .await;
    assert_eq!(status, 200, "create api key: {body}");
    let api_key_id = body["record"]["id"].as_str().expect("key id").to_owned();
    let plaintext = body["plaintext_api_key"]
        .as_str()
        .expect("plaintext")
        .to_owned();
    assert!(
        plaintext.starts_with("llmgw_"),
        "plaintext prefix: {plaintext}"
    );
    assert_eq!(body["record"]["enabled"], true);

    // ── 7. Attach the policy to the key ──────────────────────────────
    let (status, body) = post(
        &client,
        &format!("/admin-api/v1/api-keys/{api_key_id}/mapping-policies"),
        json!({ "mapping_policy_id": policy_id }),
    )
    .await;
    assert_eq!(status, 200, "attach policy: {body}");
    assert_eq!(body["mapping_policy_id"], policy_id);
    assert_eq!(body["epichust_model_name"], epichust_model_name);
    assert_eq!(body["routes"].as_array().unwrap().len(), 1);

    // ── 8. Read back the full graph through the list endpoints ───────
    let (status, body) = get(&client, "/admin-api/v1/api-keys").await;
    assert_eq!(status, 200);
    let our_key = body
        .as_array()
        .unwrap()
        .iter()
        .find(|k| k["id"] == api_key_id)
        .expect("created key present in list");
    assert_eq!(
        our_key["mapping_policies"].as_array().unwrap().len(),
        1,
        "key has one attached policy"
    );
    assert_eq!(
        our_key["mapping_policies"][0]["routes"]
            .as_array()
            .unwrap()
            .len(),
        1,
        "attached policy carries its routes"
    );

    // ── 8b. Update the API key (rename + disable), verify via the list ─
    let renamed = format!("itest-key-renamed-{run}");
    let status = put(
        &client,
        &format!("/admin-api/v1/api-keys/{api_key_id}"),
        json!({ "key_name": renamed, "enabled": false }),
    )
    .await;
    assert_eq!(status, 204, "update api key");
    let (_s, body) = get(&client, "/admin-api/v1/api-keys").await;
    let our_key = body
        .as_array()
        .unwrap()
        .iter()
        .find(|k| k["id"] == api_key_id)
        .expect("key still present after update");
    assert_eq!(our_key["key_name"], renamed, "key was renamed");
    assert_eq!(our_key["enabled"], false, "key was disabled");

    let (status, body) = get(&client, "/admin-api/v1/providers").await;
    assert_eq!(status, 200);
    let our_provider = body
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["id"] == provider_id)
        .expect("provider present in list");
    assert_eq!(
        our_provider["provider_model_count"], 1,
        "one provider model"
    );
    assert_eq!(our_provider["policy_count"], 1, "one enabled policy route");

    let (status, body) = get(&client, "/admin-api/v1/mapping-policies").await;
    assert_eq!(status, 200);
    assert!(
        body.as_array()
            .unwrap()
            .iter()
            .any(|p| p["id"] == policy_id),
        "policy present in list"
    );

    // GET single policy
    let (status, body) = get(
        &client,
        &format!("/admin-api/v1/mapping-policies/{policy_id}"),
    )
    .await;
    assert_eq!(status, 200, "get single policy: {body}");
    assert_eq!(body["id"], policy_id);

    // ── 9. Update (disable) the policy ───────────────────────────────
    let status = put(
        &client,
        &format!("/admin-api/v1/mapping-policies/{policy_id}"),
        json!({ "enabled": false }),
    )
    .await;
    assert_eq!(status, 200, "update policy");
    let (_s, body) = get(
        &client,
        &format!("/admin-api/v1/mapping-policies/{policy_id}"),
    )
    .await;
    assert_eq!(body["enabled"], false, "policy now disabled");

    // ── 10. Rotate the API key (new plaintext, distinct from the old) ─
    let (status, body) = client
        .patch(format!(
            "{}/admin-api/v1/api-keys/{api_key_id}/rotate",
            base_url()
        ))
        .send()
        .await
        .map(|r| (r.status(), r))
        .expect("rotate request");
    assert_eq!(status, 200, "rotate api key");
    let rotated: Value = body.json().await.unwrap();
    let new_plaintext = rotated["plaintext_api_key"].as_str().unwrap();
    assert!(new_plaintext.starts_with("llmgw_"));
    assert_ne!(new_plaintext, plaintext, "rotation yields a new key");

    // ── 11. Audit logs endpoint responds (array, possibly empty) ─────
    let (status, body) = get(&client, "/admin-api/v1/audit-logs").await;
    assert_eq!(status, 200, "audit logs");
    assert!(body.is_array(), "audit logs is an array");

    // ── 11b. Fetch available models from a (mock) upstream provider ──
    // A throwaway provider whose base URL points at an in-process mock
    // serving an OpenAI-shaped `/v1/models` list.
    let mock_base = start_mock_models_upstream().await;
    let (status, body) = post(
        &client,
        "/admin-api/v1/providers",
        json!({
            "provider_name": format!("itest-upstream-{run}"),
            "provider_base_url": mock_base,
            "provider_key": "sk-itest-mock",
        }),
    )
    .await;
    assert_eq!(status, 200, "create mock-backed provider: {body}");
    let mock_provider_id = body["provider"]["id"].as_str().unwrap().to_owned();

    let (status, body) = get(
        &client,
        &format!("/admin-api/v1/providers/{mock_provider_id}/available-models"),
    )
    .await;
    assert_eq!(status, 200, "available models: {body}");
    let names: Vec<&str> = body["models"]
        .as_array()
        .unwrap()
        .iter()
        .map(|m| m["model_name"].as_str().unwrap())
        .collect();
    // The handler sorts and dedupes the upstream list.
    assert_eq!(
        names,
        vec!["gpt-3.5-turbo", "gpt-4o", "gpt-4o-mini"],
        "models sorted & deduped"
    );

    assert_eq!(
        delete(
            &client,
            &format!("/admin-api/v1/providers/{mock_provider_id}")
        )
        .await,
        204,
        "delete mock-backed provider"
    );

    // ── 12. Tear down everything we created, asserting each delete ───
    assert_eq!(
        delete(
            &client,
            &format!("/admin-api/v1/api-keys/{api_key_id}/mapping-policies/{policy_id}")
        )
        .await,
        204,
        "detach policy"
    );
    assert_eq!(
        delete(&client, &format!("/admin-api/v1/api-keys/{api_key_id}")).await,
        204,
        "delete api key"
    );
    assert_eq!(
        delete(
            &client,
            &format!("/admin-api/v1/mapping-policies/{policy_id}")
        )
        .await,
        204,
        "delete policy"
    );
    assert_eq!(
        delete(
            &client,
            &format!("/admin-api/v1/epichust-models/{epichust_model_id}")
        )
        .await,
        204,
        "delete epichust model"
    );
    // Deleting the provider cascades to its provider_models.
    assert_eq!(
        delete(&client, &format!("/admin-api/v1/providers/{provider_id}")).await,
        204,
        "delete provider"
    );

    // ── 13. Verify the provider is gone ──────────────────────────────
    let (_s, body) = get(&client, "/admin-api/v1/providers").await;
    assert!(
        !body
            .as_array()
            .unwrap()
            .iter()
            .any(|p| p["id"] == provider_id),
        "provider removed after delete"
    );
}

/// Minimal HTTP server that answers any GET with an OpenAI-shaped models list
/// (including a duplicate id, to exercise the handler's sort + dedup). Returns
/// its `http://host:port` base URL.
async fn start_mock_models_upstream() -> String {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .expect("bind mock upstream");
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        while let Ok((mut socket, _)) = listener.accept().await {
            tokio::spawn(async move {
                let _ = serve_models(&mut socket).await;
            });
        }
    });
    format!("http://{addr}")
}

async fn serve_models(socket: &mut tokio::net::TcpStream) -> std::io::Result<()> {
    // Read and discard the request headers; a GET /v1/models has no body.
    let mut buf = [0u8; 4096];
    let _ = socket.read(&mut buf).await?;
    let json = "{\"object\":\"list\",\"data\":[\
        {\"id\":\"gpt-4o\",\"owned_by\":\"openai\"},\
        {\"id\":\"gpt-4o-mini\",\"owned_by\":\"openai\"},\
        {\"id\":\"gpt-3.5-turbo\",\"owned_by\":\"openai\"},\
        {\"id\":\"gpt-4o\",\"owned_by\":\"openai\"}]}";
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\
         Content-Length: {}\r\nConnection: close\r\n\r\n{}",
        json.len(),
        json
    );
    socket.write_all(response.as_bytes()).await?;
    socket.flush().await?;
    Ok(())
}
