use std::{
    collections::{HashMap, HashSet},
    sync::{Arc, RwLock},
    time::Duration,
};

use anyhow::Result;
use sqlx::{PgPool, Row};

// ── Cache types ───────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct ProviderInfo {
    pub provider_name: String,
    pub provider_base_url: String,
    pub provider_key: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RoutingStrategy {
    Weighted,
    Priority,
    RoundRobin,
}

impl RoutingStrategy {
    fn parse(value: &str) -> Self {
        match value {
            "priority" => RoutingStrategy::Priority,
            "round_robin" => RoutingStrategy::RoundRobin,
            _ => RoutingStrategy::Weighted,
        }
    }
}

/// One candidate upstream for an epichust model.
#[derive(Debug, Clone)]
pub struct RouteCandidate {
    pub provider_model_name: String,
    pub weight: u32,
    // Kept for observability/future failover; ordering is done in SQL.
    #[allow(dead_code)]
    pub priority: u32,
    pub provider: ProviderInfo,
}

/// All enabled routes for an epichust model plus how to pick among them.
/// `routes` is pre-sorted by priority ASC, then weight DESC.
#[derive(Debug, Clone)]
pub struct ModelTarget {
    pub strategy: RoutingStrategy,
    pub routes: Vec<RouteCandidate>,
}

#[derive(Debug, Clone)]
pub struct RateLimitConfig {
    pub requests_per_minute: Option<i32>,
    pub requests_per_day: Option<i32>,
    pub tokens_per_minute: Option<i32>,
    pub tokens_per_day: Option<i32>,
}

impl RateLimitConfig {
    pub fn is_empty(&self) -> bool {
        self.requests_per_minute.is_none()
            && self.requests_per_day.is_none()
            && self.tokens_per_minute.is_none()
            && self.tokens_per_day.is_none()
    }
}

pub struct GatewayCache {
    pub key_hashes: HashSet<String>,
    /// epichust_model_name → all enabled routes + the policy's routing strategy
    pub model_routes: HashMap<String, ModelTarget>,
    /// key_hash → aggregated rate limit rules from attached policies
    pub rate_limits: HashMap<String, RateLimitConfig>,
}

pub type Cache = Arc<RwLock<GatewayCache>>;

pub fn new_cache() -> Cache {
    Arc::new(RwLock::new(GatewayCache {
        key_hashes: HashSet::new(),
        model_routes: HashMap::new(),
        rate_limits: HashMap::new(),
    }))
}

// ── DB queries ────────────────────────────────────────────────────

async fn load_key_hashes(pool: &PgPool) -> Result<HashSet<String>> {
    let rows = sqlx::query("SELECT key_hash FROM epichust_api_keys WHERE enabled = true")
        .fetch_all(pool)
        .await?;
    Ok(rows
        .iter()
        .map(|r| r.try_get::<String, _>("key_hash").unwrap())
        .collect())
}

/// Load every enabled route for every enabled policy, grouped by epichust
/// model name. Rows arrive sorted by (priority ASC, weight DESC) so each
/// target's `routes` vec is already in preference order. When several policies
/// target the same model, the strategy of the most-preferred route is used.
async fn load_model_routes(pool: &PgPool) -> Result<HashMap<String, ModelTarget>> {
    let rows = sqlx::query(
        r#"
        SELECT
            em.model_name AS epichust_model_name,
            pm.model_name AS provider_model_name,
            p.provider_name,
            p.provider_base_url,
            p.provider_key_ciphertext,
            mpr.weight,
            mpr.priority,
            mp.routing_strategy
        FROM mapping_policies mp
        JOIN epichust_models em ON em.id = mp.epichust_model_id
        JOIN mapping_policy_routes mpr ON mpr.mapping_policy_id = mp.id
        JOIN provider_models pm ON pm.id = mpr.provider_model_id
        JOIN providers p ON p.id = pm.provider_id
        WHERE mp.enabled = true AND mpr.enabled = true
        ORDER BY em.model_name, mpr.priority ASC, mpr.weight DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut map: HashMap<String, ModelTarget> = HashMap::new();
    for row in &rows {
        let epichust_name: String = row.try_get("epichust_model_name")?;
        let ciphertext: Vec<u8> = row.try_get("provider_key_ciphertext")?;
        let weight: i32 = row.try_get("weight")?;
        let priority: i32 = row.try_get("priority")?;
        let strategy = RoutingStrategy::parse(&row.try_get::<String, _>("routing_strategy")?);
        let candidate = RouteCandidate {
            provider_model_name: row.try_get("provider_model_name")?,
            weight: weight.max(0) as u32,
            priority: priority.max(0) as u32,
            provider: ProviderInfo {
                provider_name: row.try_get("provider_name")?,
                provider_base_url: row.try_get("provider_base_url")?,
                provider_key: String::from_utf8_lossy(&ciphertext).into_owned(),
            },
        };
        map.entry(epichust_name)
            .or_insert_with(|| ModelTarget {
                strategy,
                routes: Vec::new(),
            })
            .routes
            .push(candidate);
    }
    Ok(map)
}

/// Load rate limit rules per API key (keyed by key_hash).
/// Aggregates limits from all enabled policies attached to the key.
async fn load_rate_limits(pool: &PgPool) -> Result<HashMap<String, RateLimitConfig>> {
    let rows = sqlx::query(
        r#"
        SELECT
            eak.key_hash,
            rlr.limit_type,
            rlr.limit_value
        FROM epichust_api_keys eak
        JOIN api_key_mapping_policies akmp ON akmp.api_key_id = eak.id AND akmp.enabled = true
        JOIN mapping_policies mp ON mp.id = akmp.mapping_policy_id AND mp.enabled = true
        JOIN rate_limit_rules rlr ON rlr.mapping_policy_id = mp.id
        WHERE eak.enabled = true
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut map: HashMap<String, RateLimitConfig> = HashMap::new();
    for row in &rows {
        let key_hash: String = row.try_get("key_hash")?;
        let limit_type: String = row.try_get("limit_type")?;
        let limit_value: i32 = row.try_get("limit_value")?;

        let entry = map.entry(key_hash).or_insert(RateLimitConfig {
            requests_per_minute: None,
            requests_per_day: None,
            tokens_per_minute: None,
            tokens_per_day: None,
        });

        match limit_type.as_str() {
            "requests_per_minute" => entry.requests_per_minute = Some(limit_value),
            "requests_per_day" => entry.requests_per_day = Some(limit_value),
            "tokens_per_minute" => entry.tokens_per_minute = Some(limit_value),
            "tokens_per_day" => entry.tokens_per_day = Some(limit_value),
            _ => {}
        }
    }
    Ok(map)
}

async fn load_full_cache(pool: &PgPool) -> Result<GatewayCache> {
    Ok(GatewayCache {
        key_hashes: load_key_hashes(pool).await?,
        model_routes: load_model_routes(pool).await?,
        rate_limits: load_rate_limits(pool).await?,
    })
}

// ── Initialization + background refresh ───────────────────────────

pub fn start_db_thread(cache: Cache, database_url: &str, interval: Duration) {
    let url = database_url.to_owned();
    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime");

        rt.block_on(async {
            // Retry connecting for up to 60s (e.g. Postgres container still starting)
            let pool = loop {
                match PgPool::connect(&url).await {
                    Ok(p) => {
                        log::info!("gateway connected to PostgreSQL");
                        break p;
                    }
                    Err(e) => {
                        log::warn!("DB connection failed, retrying in 3s: {e}");
                        tokio::time::sleep(Duration::from_secs(3)).await;
                    }
                }
            };

            match load_full_cache(&pool).await {
                Ok(fresh) => {
                    let keys = fresh.key_hashes.len();
                    let routes = fresh.model_routes.len();
                    *cache.write().unwrap() = fresh;
                    log::info!("initial cache: {keys} keys, {routes} model routes");
                }
                Err(e) => log::error!("initial cache load failed: {e}"),
            }

            loop {
                tokio::time::sleep(interval).await;
                match load_full_cache(&pool).await {
                    Ok(fresh) => {
                        let keys = fresh.key_hashes.len();
                        let routes = fresh.model_routes.len();
                        *cache.write().unwrap() = fresh;
                        log::info!("cache refreshed: {keys} keys, {routes} routes");
                    }
                    Err(e) => log::error!("cache refresh failed: {e}"),
                }
            }
        });
    });
}
