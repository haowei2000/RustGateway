//! LIVE end-to-end test: forward a real chat completion through the gateway
//! to the **real DeepSeek API** (`https://api.deepseek.com`).
//!
//! This is `#[ignore]`d by default because it makes a real, billable network
//! call. It also no-ops unless `DEEPSEEK_API_KEY` is set. Run it explicitly:
//!
//!     DEEPSEEK_API_KEY=sk-xxxx \
//!       cargo test -p pingora-gateway --test deepseek_live -- --ignored --nocapture
//!
//! What it proves end-to-end through the real `pingora-gateway` binary:
//!   * a client key in our DB is accepted (auth)
//!   * the client's bearer is swapped for the real DeepSeek provider key
//!   * the gateway-facing model name is translated to `deepseek-chat`
//!   * the request is proxied over TLS to api.deepseek.com and a real
//!     completion comes back with a non-empty assistant message
//!
//! Requires the local-dev Postgres from `make dev-infra`.

use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use llm_gateway_common::api_key::{hash_api_key, hash_prefix};
use sqlx::PgPool;

const GATEWAY_ADDR: &str = "127.0.0.1:18081";
const METRICS_ADDR: &str = "127.0.0.1:19091";
const DEFAULT_DATABASE_URL: &str = "postgres://llm:llm@localhost:5433/llm_gateway";
const CHAT_PATH: &str = "/v1/chat/completions";

const DEEPSEEK_BASE_URL: &str = "https://api.deepseek.com";
const DEEPSEEK_MODEL: &str = "deepseek-chat";

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

fn nonce() -> String {
    let pid = std::process::id();
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{pid}{nanos}")
}

struct Seed {
    provider_id: String,
    provider_model_id: String,
    epichust_model_id: String,
    policy_id: String,
    api_key_id: String,
    epichust_model_name: String,
    plaintext_key: String,
}

async fn seed(pool: &PgPool, run: &str, deepseek_key: &str) -> Seed {
    let provider_id = format!("provider_ds_{run}");
    let provider_model_id = format!("pm_ds_{run}");
    let epichust_model_id = format!("em_ds_{run}");
    let policy_id = format!("mp_ds_{run}");
    let api_key_id = format!("key_ds_{run}");
    let epichust_model_name = format!("deepseek-chat-itest-{run}");
    let plaintext_key = format!("llmgw_ds_{run}");

    sqlx::query(
        "INSERT INTO providers (id, provider_name, provider_base_url, provider_key_ciphertext) \
         VALUES ($1, $2, $3, $4)",
    )
    .bind(&provider_id)
    .bind(format!("deepseek-itest-{run}"))
    .bind(DEEPSEEK_BASE_URL)
    .bind(deepseek_key.as_bytes().to_vec())
    .execute(pool)
    .await
    .expect("seed provider");

    sqlx::query("INSERT INTO provider_models (id, provider_id, model_name) VALUES ($1, $2, $3)")
        .bind(&provider_model_id)
        .bind(&provider_id)
        .bind(DEEPSEEK_MODEL)
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

    let key_hash = hash_api_key(&plaintext_key);
    sqlx::query(
        "INSERT INTO epichust_api_keys (id, key_name, key_hash, key_hash_prefix, enabled) \
         VALUES ($1, $2, $3, $4, true)",
    )
    .bind(&api_key_id)
    .bind(format!("deepseek-itest-{run}"))
    .bind(&key_hash)
    .bind(hash_prefix(&key_hash))
    .execute(pool)
    .await
    .expect("seed api key");

    Seed {
        provider_id,
        provider_model_id,
        epichust_model_id,
        policy_id,
        api_key_id,
        epichust_model_name,
        plaintext_key,
    }
}

async fn cleanup(pool: &PgPool, s: &Seed) {
    let _ = sqlx::query("DELETE FROM epichust_api_keys WHERE id = $1")
        .bind(&s.api_key_id)
        .execute(pool)
        .await;
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

#[tokio::test]
#[ignore = "hits the real, billable DeepSeek API; run with --ignored and DEEPSEEK_API_KEY set"]
async fn forwards_to_real_deepseek() {
    let Some(deepseek_key) = std::env::var("DEEPSEEK_API_KEY")
        .ok()
        .filter(|v| !v.is_empty())
    else {
        eprintln!("SKIP forwards_to_real_deepseek: set DEEPSEEK_API_KEY to run this live test.");
        return;
    };

    let database_url = database_url();
    let Ok(pool) = PgPool::connect(&database_url).await else {
        eprintln!("SKIP forwards_to_real_deepseek: PostgreSQL not reachable at {database_url}.");
        return;
    };

    let run = nonce();
    let s = seed(&pool, &run, &deepseek_key).await;

    let _server = spawn_gateway(&database_url);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .build()
        .unwrap();
    wait_for_health(&client).await;

    let result = run_live(&client, &s).await;

    cleanup(&pool, &s).await;
    pool.close().await;

    let report = result.unwrap_or_else(|e| panic!("{e}"));
    println!("\n========== DeepSeek live forwarding ==========");
    println!("gateway-facing model : {}", s.epichust_model_name);
    println!("upstream model       : {DEEPSEEK_MODEL}");
    println!("upstream             : {DEEPSEEK_BASE_URL}{CHAT_PATH}");
    println!("assistant reply      : {report}");
    println!("==============================================\n");
}

async fn run_live(client: &reqwest::Client, s: &Seed) -> Result<String, String> {
    // Poll until the gateway's DB cache has loaded our key (valid key stops 403ing).
    let deadline = Instant::now() + Duration::from_secs(20);
    let resp = loop {
        let resp = client
            .post(gw_url(CHAT_PATH))
            .bearer_auth(&s.plaintext_key)
            .json(&serde_json::json!({
                "model": s.epichust_model_name,
                "messages": [
                    { "role": "system", "content": "You are a terse test bot." },
                    { "role": "user", "content": "Reply with exactly the word: pong" }
                ],
                "stream": false,
                "max_tokens": 16
            }))
            .send()
            .await
            .map_err(|e| format!("request to gateway failed: {e}"))?;
        if resp.status() != 401 && resp.status() != 403 {
            break resp;
        }
        if Instant::now() >= deadline {
            return Err("valid key never passed auth; DB cache failed to load".to_owned());
        }
        tokio::time::sleep(Duration::from_millis(300)).await;
    };

    let status = resp.status();
    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("non-JSON response from gateway: {e}"))?;

    if status != 200 {
        return Err(format!(
            "expected 200 from DeepSeek via gateway, got {status}: {body}"
        ));
    }

    let content = body["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| format!("no assistant content in response: {body}"))?;
    if content.trim().is_empty() {
        return Err(format!("empty assistant content: {body}"));
    }
    // DeepSeek echoes back the model it actually served — sanity-check it.
    if body["model"].as_str().map(|m| m.contains("deepseek")) != Some(true) {
        return Err(format!("unexpected upstream model in response: {body}"));
    }
    Ok(content.trim().to_owned())
}
