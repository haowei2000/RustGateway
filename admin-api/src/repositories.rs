use std::collections::HashMap;

use llm_gateway_common::{
    api_key::{hash_api_key, hash_prefix},
    models::{
        ApiKeyMappingPolicy, ApiKeySummary, AttachApiKeyMappingPolicyRequest, AuditLogEntry,
        CreateApiKeyRequest, CreateApiKeyResponse, CreateEpichustModelRequest,
        CreateMappingPolicyRequest, CreateProviderModelRequest, CreateProviderRequest,
        CreateProviderResponse, EpichustModel, MappingPolicy, MappingPolicyRoute, ModelType,
        ProviderModel, ProviderSummary, RateLimitRule, RoutingStrategy, UpdateMappingPolicyRequest,
        UsageLimitType,
    },
};
use sqlx::{PgPool, Row};
use uuid::Uuid;

pub async fn list_epichust_models(pool: &PgPool) -> Result<Vec<EpichustModel>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT id, model_name, model_type, created_at
        FROM epichust_models
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    rows.into_iter()
        .map(|row| {
            Ok(EpichustModel {
                id: row.try_get("id")?,
                model_name: row.try_get("model_name")?,
                model_type: parse_model_type(row.try_get("model_type")?),
                created_at: row.try_get("created_at")?,
            })
        })
        .collect()
}

pub async fn create_epichust_model(
    pool: &PgPool,
    request: CreateEpichustModelRequest,
) -> Result<EpichustModel, sqlx::Error> {
    let id = generated_id("em");
    let row = sqlx::query(
        r#"
        INSERT INTO epichust_models (id, model_name, model_type)
        VALUES ($1, $2, $3)
        RETURNING id, model_name, model_type, created_at
        "#,
    )
    .bind(&id)
    .bind(request.model_name.trim())
    .bind(model_type_to_str(&request.model_type))
    .fetch_one(pool)
    .await?;

    Ok(EpichustModel {
        id: row.try_get("id")?,
        model_name: row.try_get("model_name")?,
        model_type: parse_model_type(row.try_get("model_type")?),
        created_at: row.try_get("created_at")?,
    })
}

pub async fn delete_epichust_model(pool: &PgPool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM epichust_models WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn list_providers(pool: &PgPool) -> Result<Vec<ProviderSummary>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            p.id,
            p.provider_name,
            p.provider_base_url,
            p.created_at,
            COALESCE(provider_model_counts.provider_model_count, 0)::bigint
                AS provider_model_count,
            COALESCE(policy_counts.policy_count, 0)::bigint AS policy_count
        FROM providers p
        LEFT JOIN (
            SELECT provider_id, COUNT(*) AS provider_model_count
            FROM provider_models
            GROUP BY provider_id
        ) provider_model_counts ON provider_model_counts.provider_id = p.id
        LEFT JOIN (
            SELECT pm.provider_id, COUNT(*) AS policy_count
            FROM mapping_policy_routes mpr
            JOIN provider_models pm ON pm.id = mpr.provider_model_id
            WHERE mpr.enabled = true
            GROUP BY pm.provider_id
        ) policy_counts ON policy_counts.provider_id = p.id
        ORDER BY p.created_at DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    rows.into_iter()
        .map(|row| {
            Ok(ProviderSummary {
                id: row.try_get("id")?,
                provider_name: row.try_get("provider_name")?,
                provider_base_url: row.try_get("provider_base_url")?,
                provider_model_count: i64_to_u32(row.try_get("provider_model_count")?),
                policy_count: i64_to_u32(row.try_get("policy_count")?),
                created_at: row.try_get("created_at")?,
            })
        })
        .collect()
}

pub async fn create_provider(
    pool: &PgPool,
    request: CreateProviderRequest,
) -> Result<CreateProviderResponse, sqlx::Error> {
    let id = generated_id("provider");
    let provider_key_ciphertext = request.provider_key.into_bytes();
    let row = sqlx::query(
        r#"
        INSERT INTO providers (
            id,
            provider_name,
            provider_base_url,
            provider_key_ciphertext
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, provider_name, provider_base_url, created_at
        "#,
    )
    .bind(&id)
    .bind(request.provider_name.trim())
    .bind(request.provider_base_url.trim())
    .bind(provider_key_ciphertext)
    .fetch_one(pool)
    .await?;

    Ok(CreateProviderResponse {
        provider: ProviderSummary {
            id: row.try_get("id")?,
            provider_name: row.try_get("provider_name")?,
            provider_base_url: row.try_get("provider_base_url")?,
            provider_model_count: 0,
            policy_count: 0,
            created_at: row.try_get("created_at")?,
        },
    })
}

pub async fn delete_provider(pool: &PgPool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM providers WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

#[derive(Debug, Clone)]
pub struct ProviderCredentials {
    pub id: String,
    pub provider_name: String,
    pub provider_base_url: String,
    pub provider_key: String,
}

pub async fn get_provider_credentials(
    pool: &PgPool,
    provider_id: &str,
) -> Result<Option<ProviderCredentials>, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT id, provider_name, provider_base_url, provider_key_ciphertext
        FROM providers
        WHERE id = $1
        "#,
    )
    .bind(provider_id)
    .fetch_optional(pool)
    .await?;

    row.map(|row| {
        let provider_key_ciphertext: Vec<u8> = row.try_get("provider_key_ciphertext")?;
        Ok(ProviderCredentials {
            id: row.try_get("id")?,
            provider_name: row.try_get("provider_name")?,
            provider_base_url: row.try_get("provider_base_url")?,
            provider_key: String::from_utf8_lossy(&provider_key_ciphertext).into_owned(),
        })
    })
    .transpose()
}

pub async fn list_provider_models(pool: &PgPool) -> Result<Vec<ProviderModel>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT id, provider_id, model_name, created_at
        FROM provider_models
        ORDER BY created_at DESC, model_name ASC
        "#,
    )
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(provider_model_from_row).collect()
}

pub async fn create_provider_model(
    pool: &PgPool,
    request: CreateProviderModelRequest,
) -> Result<ProviderModel, sqlx::Error> {
    let id = generated_id("pm");
    let row = sqlx::query(
        r#"
        INSERT INTO provider_models (id, provider_id, model_name)
        VALUES ($1, $2, $3)
        ON CONFLICT (provider_id, model_name)
        DO UPDATE SET updated_at = now()
        RETURNING id, provider_id, model_name, created_at
        "#,
    )
    .bind(&id)
    .bind(request.provider_id)
    .bind(request.model_name.trim())
    .fetch_one(pool)
    .await?;

    provider_model_from_row(row)
}

// ── Mapping Policy ──

const MAPPING_POLICY_SELECT: &str = r#"
    SELECT
        mp.id,
        mp.epichust_model_id,
        em.model_name AS epichust_model_name,
        mp.routing_strategy,
        mp.enabled,
        mp.created_at
    FROM mapping_policies mp
    JOIN epichust_models em ON em.id = mp.epichust_model_id
"#;

pub async fn list_mapping_policies(pool: &PgPool) -> Result<Vec<MappingPolicy>, sqlx::Error> {
    let policy_rows = sqlx::query(MAPPING_POLICY_SELECT).fetch_all(pool).await?;

    let policy_ids: Vec<String> = policy_rows
        .iter()
        .map(|row| row.try_get("id").unwrap())
        .collect();
    let routes_by_policy = load_mapping_policy_routes_bulk(pool, &policy_ids).await?;
    let rules_by_policy = load_rate_limit_rules_bulk(pool, &policy_ids).await?;

    policy_rows
        .into_iter()
        .map(|row| {
            let id: String = row.try_get("id")?;
            let routes = routes_by_policy.get(&id).cloned().unwrap_or_default();
            let rate_limit_rules = rules_by_policy.get(&id).cloned().unwrap_or_default();
            Ok(MappingPolicy {
                id,
                epichust_model_id: row.try_get("epichust_model_id")?,
                epichust_model_name: row.try_get("epichust_model_name")?,
                routing_strategy: parse_routing_strategy(row.try_get("routing_strategy")?),
                rate_limit_rules,
                enabled: row.try_get("enabled")?,
                routes,
                created_at: row.try_get("created_at")?,
            })
        })
        .collect()
}

pub async fn get_mapping_policy(pool: &PgPool, id: &str) -> Result<MappingPolicy, sqlx::Error> {
    let row = sqlx::query(&format!("{MAPPING_POLICY_SELECT} WHERE mp.id = $1"))
        .bind(id)
        .fetch_one(pool)
        .await?;

    let routes = load_mapping_policy_routes(pool, id).await?;
    let rate_limit_rules = load_rate_limit_rules(pool, id).await?;

    Ok(MappingPolicy {
        id: row.try_get("id")?,
        epichust_model_id: row.try_get("epichust_model_id")?,
        epichust_model_name: row.try_get("epichust_model_name")?,
        routing_strategy: parse_routing_strategy(row.try_get("routing_strategy")?),
        rate_limit_rules,
        enabled: row.try_get("enabled")?,
        routes,
        created_at: row.try_get("created_at")?,
    })
}

pub async fn create_mapping_policy(
    pool: &PgPool,
    request: CreateMappingPolicyRequest,
) -> Result<MappingPolicy, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let id = mapping_policy_id();

    sqlx::query(
        r#"
        INSERT INTO mapping_policies (
            id, epichust_model_id, routing_strategy, enabled
        )
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(&id)
    .bind(&request.epichust_model_id)
    .bind(routing_strategy_to_str(&request.routing_strategy))
    .bind(request.enabled)
    .execute(&mut *tx)
    .await?;

    for rule in &request.rate_limit_rules {
        sqlx::query(
            r#"
            INSERT INTO rate_limit_rules (
                id, mapping_policy_id, limit_type, limit_value
            )
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (mapping_policy_id, limit_type)
            DO UPDATE SET limit_value = EXCLUDED.limit_value
            "#,
        )
        .bind(generated_id("rlr"))
        .bind(&id)
        .bind(usage_limit_type_to_str(&rule.limit_type))
        .bind(rule.limit_value)
        .execute(&mut *tx)
        .await?;
    }

    for route in &request.routes {
        sqlx::query(
            r#"
            INSERT INTO mapping_policy_routes (
                mapping_policy_id, provider_model_id, weight, priority, enabled
            )
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (mapping_policy_id, provider_model_id)
            DO UPDATE SET
                weight = EXCLUDED.weight,
                priority = EXCLUDED.priority,
                enabled = EXCLUDED.enabled
            "#,
        )
        .bind(&id)
        .bind(&route.provider_model_id)
        .bind(route.weight as i32)
        .bind(route.priority as i32)
        .bind(route.enabled)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    get_mapping_policy(pool, &id).await
}

pub async fn update_mapping_policy(
    pool: &PgPool,
    id: &str,
    request: UpdateMappingPolicyRequest,
) -> Result<MappingPolicy, sqlx::Error> {
    let mut tx = pool.begin().await?;

    if request.routing_strategy.is_some() || request.enabled.is_some() {
        sqlx::query(
            r#"
            UPDATE mapping_policies
            SET
                routing_strategy = COALESCE($2, routing_strategy),
                enabled = COALESCE($3, enabled),
                updated_at = now()
            WHERE id = $1
            "#,
        )
        .bind(id)
        .bind(
            request
                .routing_strategy
                .as_ref()
                .map(routing_strategy_to_str),
        )
        .bind(request.enabled)
        .execute(&mut *tx)
        .await?;
    }

    if let Some(rules) = &request.rate_limit_rules {
        sqlx::query(r#"DELETE FROM rate_limit_rules WHERE mapping_policy_id = $1"#)
            .bind(id)
            .execute(&mut *tx)
            .await?;

        for rule in rules {
            sqlx::query(
                r#"
                INSERT INTO rate_limit_rules (
                    id, mapping_policy_id, limit_type, limit_value
                )
                VALUES ($1, $2, $3, $4)
                "#,
            )
            .bind(generated_id("rlr"))
            .bind(id)
            .bind(usage_limit_type_to_str(&rule.limit_type))
            .bind(rule.limit_value)
            .execute(&mut *tx)
            .await?;
        }
    }

    if let Some(routes) = &request.routes {
        sqlx::query(r#"DELETE FROM mapping_policy_routes WHERE mapping_policy_id = $1"#)
            .bind(id)
            .execute(&mut *tx)
            .await?;

        for route in routes {
            sqlx::query(
                r#"
                INSERT INTO mapping_policy_routes (
                    mapping_policy_id, provider_model_id, weight, priority, enabled
                )
                VALUES ($1, $2, $3, $4, $5)
                "#,
            )
            .bind(id)
            .bind(&route.provider_model_id)
            .bind(route.weight as i32)
            .bind(route.priority as i32)
            .bind(route.enabled)
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;
    get_mapping_policy(pool, id).await
}

pub async fn delete_mapping_policy(pool: &PgPool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM mapping_policies WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

async fn load_mapping_policy_routes(
    pool: &PgPool,
    policy_id: &str,
) -> Result<Vec<MappingPolicyRoute>, sqlx::Error> {
    let rows = sqlx::query(MAPPING_POLICY_ROUTES_SELECT)
        .bind(policy_id)
        .fetch_all(pool)
        .await?;
    Ok(rows.iter().map(mapping_policy_route_from_row).collect())
}

async fn load_mapping_policy_routes_bulk(
    pool: &PgPool,
    policy_ids: &[String],
) -> Result<HashMap<String, Vec<MappingPolicyRoute>>, sqlx::Error> {
    if policy_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let placeholders: Vec<String> = policy_ids
        .iter()
        .enumerate()
        .map(|(i, _)| format!("${}", i + 1))
        .collect();
    let sql = format!(
        r#"
        SELECT
            mpr.mapping_policy_id,
            mpr.provider_model_id,
            pm.model_name AS provider_model_name,
            pm.provider_id,
            p.provider_name,
            mpr.weight,
            mpr.priority,
            mpr.enabled
        FROM mapping_policy_routes mpr
        JOIN provider_models pm ON pm.id = mpr.provider_model_id
        JOIN providers p ON p.id = pm.provider_id
        WHERE mpr.mapping_policy_id IN ({})
        ORDER BY mpr.priority ASC, mpr.created_at ASC
        "#,
        placeholders.join(", ")
    );

    let mut query = sqlx::query(&sql);
    for id in policy_ids {
        query = query.bind(id);
    }

    let rows = query.fetch_all(pool).await?;
    let mut routes_by_policy = HashMap::<String, Vec<MappingPolicyRoute>>::new();
    for row in &rows {
        let policy_id: String = row.try_get("mapping_policy_id")?;
        routes_by_policy
            .entry(policy_id)
            .or_default()
            .push(mapping_policy_route_from_row(row));
    }
    Ok(routes_by_policy)
}

const MAPPING_POLICY_ROUTES_SELECT: &str = r#"
    SELECT
        mpr.mapping_policy_id,
        mpr.provider_model_id,
        pm.model_name AS provider_model_name,
        pm.provider_id,
        p.provider_name,
        mpr.weight,
        mpr.priority,
        mpr.enabled
    FROM mapping_policy_routes mpr
    JOIN provider_models pm ON pm.id = mpr.provider_model_id
    JOIN providers p ON p.id = pm.provider_id
    WHERE mpr.mapping_policy_id = $1
    ORDER BY mpr.priority ASC, mpr.created_at ASC
"#;

async fn load_rate_limit_rules(
    pool: &PgPool,
    policy_id: &str,
) -> Result<Vec<RateLimitRule>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT limit_type, limit_value
        FROM rate_limit_rules
        WHERE mapping_policy_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(policy_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .iter()
        .map(|row| RateLimitRule {
            limit_type: parse_usage_limit_type(row.try_get::<String, _>("limit_type").unwrap()),
            limit_value: row.try_get("limit_value").unwrap_or(100),
        })
        .collect())
}

async fn load_rate_limit_rules_bulk(
    pool: &PgPool,
    policy_ids: &[String],
) -> Result<HashMap<String, Vec<RateLimitRule>>, sqlx::Error> {
    if policy_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let placeholders: Vec<String> = policy_ids
        .iter()
        .enumerate()
        .map(|(i, _)| format!("${}", i + 1))
        .collect();
    let sql = format!(
        r#"
        SELECT mapping_policy_id, limit_type, limit_value
        FROM rate_limit_rules
        WHERE mapping_policy_id IN ({})
        ORDER BY created_at ASC
        "#,
        placeholders.join(", ")
    );

    let mut query = sqlx::query(&sql);
    for id in policy_ids {
        query = query.bind(id);
    }

    let rows = query.fetch_all(pool).await?;
    let mut rules_by_policy = HashMap::<String, Vec<RateLimitRule>>::new();
    for row in &rows {
        let policy_id: String = row.try_get("mapping_policy_id")?;
        rules_by_policy
            .entry(policy_id)
            .or_default()
            .push(RateLimitRule {
                limit_type: parse_usage_limit_type(row.try_get::<String, _>("limit_type").unwrap()),
                limit_value: row.try_get("limit_value").unwrap_or(100),
            });
    }
    Ok(rules_by_policy)
}

fn mapping_policy_route_from_row(row: &sqlx::postgres::PgRow) -> MappingPolicyRoute {
    MappingPolicyRoute {
        provider_model_id: row.try_get("provider_model_id").unwrap_or_default(),
        provider_model_name: row.try_get("provider_model_name").unwrap_or_default(),
        provider_id: row.try_get("provider_id").unwrap_or_default(),
        provider_name: row.try_get("provider_name").unwrap_or_default(),
        weight: i32_to_u32(row.try_get("weight").unwrap_or(100)),
        priority: i32_to_u32(row.try_get("priority").unwrap_or(100)),
        enabled: row.try_get("enabled").unwrap_or(true),
    }
}

// ── API Keys ──

pub async fn list_api_keys(pool: &PgPool) -> Result<Vec<ApiKeySummary>, sqlx::Error> {
    let key_rows = sqlx::query(
        r#"
        SELECT
            id,
            key_name,
            key_hash_prefix,
            enabled,
            last_used_at,
            created_at
        FROM epichust_api_keys
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut api_keys = Vec::new();
    for row in key_rows {
        api_keys.push(ApiKeySummary {
            id: row.try_get("id")?,
            key_name: row.try_get("key_name")?,
            key_hash_prefix: row.try_get("key_hash_prefix")?,
            enabled: row.try_get("enabled")?,
            mapping_policies: Vec::new(),
            last_used_at: row.try_get("last_used_at")?,
            created_at: row.try_get("created_at")?,
        });
    }

    let mut policies_by_key = load_api_key_mapping_policies(pool).await?;

    for api_key in &mut api_keys {
        api_key.mapping_policies = policies_by_key.remove(&api_key.id).unwrap_or_default();
    }

    Ok(api_keys)
}

pub async fn create_api_key(
    pool: &PgPool,
    request: CreateApiKeyRequest,
) -> Result<CreateApiKeyResponse, sqlx::Error> {
    let plaintext_api_key = format!("llmgw_{}", Uuid::new_v4().simple());
    let key_hash = hash_api_key(&plaintext_api_key);
    let key_hash_prefix = hash_prefix(&key_hash);
    let id = generated_id("key");

    let row = sqlx::query(
        r#"
        INSERT INTO epichust_api_keys (
            id,
            key_name,
            key_hash,
            key_hash_prefix,
            enabled
        )
        VALUES ($1, $2, $3, $4, true)
        RETURNING id, key_name, key_hash_prefix, enabled, last_used_at, created_at
        "#,
    )
    .bind(&id)
    .bind(request.key_name.trim())
    .bind(key_hash)
    .bind(key_hash_prefix)
    .fetch_one(pool)
    .await?;

    Ok(CreateApiKeyResponse {
        plaintext_api_key,
        record: ApiKeySummary {
            id: row.try_get("id")?,
            key_name: row.try_get("key_name")?,
            key_hash_prefix: row.try_get("key_hash_prefix")?,
            enabled: row.try_get("enabled")?,
            mapping_policies: Vec::new(),
            last_used_at: row.try_get("last_used_at")?,
            created_at: row.try_get("created_at")?,
        },
    })
}

pub async fn update_api_key(
    pool: &PgPool,
    id: &str,
    key_name: &str,
    enabled: bool,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE epichust_api_keys SET key_name = $1, enabled = $2 WHERE id = $3",
    )
    .bind(key_name.trim())
    .bind(enabled)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn rotate_api_key(
    pool: &PgPool,
    id: &str,
) -> Result<CreateApiKeyResponse, sqlx::Error> {
    let plaintext_api_key = format!("llmgw_{}", Uuid::new_v4().simple());
    let key_hash = hash_api_key(&plaintext_api_key);
    let key_hash_prefix = hash_prefix(&key_hash);

    sqlx::query(
        "UPDATE epichust_api_keys SET key_hash = $1, key_hash_prefix = $2 WHERE id = $3",
    )
    .bind(&key_hash)
    .bind(&key_hash_prefix)
    .bind(id)
    .execute(pool)
    .await?;

    Ok(CreateApiKeyResponse {
        plaintext_api_key,
        record: ApiKeySummary {
            id: id.to_owned(),
            key_name: String::new(),
            key_hash_prefix,
            enabled: true,
            mapping_policies: Vec::new(),
            last_used_at: None,
            created_at: chrono::Utc::now(),
        },
    })
}

pub async fn delete_api_key(pool: &PgPool, id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM epichust_api_keys WHERE id = $1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Load all api_key → mapping_policy links with nested routes and rate limit rules.
async fn load_api_key_mapping_policies(
    pool: &PgPool,
) -> Result<HashMap<String, Vec<ApiKeyMappingPolicy>>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            akmp.api_key_id,
            akmp.mapping_policy_id,
            akmp.enabled AS link_enabled,
            mp.epichust_model_id,
            em.model_name AS epichust_model_name,
            mp.routing_strategy
        FROM api_key_mapping_policies akmp
        JOIN mapping_policies mp ON mp.id = akmp.mapping_policy_id
        JOIN epichust_models em ON em.id = mp.epichust_model_id
        ORDER BY akmp.created_at DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    let policy_ids: Vec<String> = rows
        .iter()
        .map(|row| row.try_get::<String, _>("mapping_policy_id").unwrap())
        .collect();
    let routes_by_policy = load_mapping_policy_routes_bulk(pool, &policy_ids).await?;
    let rules_by_policy = load_rate_limit_rules_bulk(pool, &policy_ids).await?;

    let mut policies_by_key = HashMap::<String, Vec<ApiKeyMappingPolicy>>::new();
    for row in &rows {
        let api_key_id: String = row.try_get("api_key_id")?;
        let policy_id: String = row.try_get("mapping_policy_id")?;
        let routes = routes_by_policy
            .get(&policy_id)
            .cloned()
            .unwrap_or_default();
        let rate_limit_rules = rules_by_policy.get(&policy_id).cloned().unwrap_or_default();

        policies_by_key
            .entry(api_key_id)
            .or_default()
            .push(ApiKeyMappingPolicy {
                mapping_policy_id: policy_id,
                epichust_model_id: row.try_get("epichust_model_id")?,
                epichust_model_name: row.try_get("epichust_model_name")?,
                routing_strategy: parse_routing_strategy(row.try_get("routing_strategy")?),
                rate_limit_rules,
                enabled: row.try_get("link_enabled")?,
                routes,
            });
    }

    Ok(policies_by_key)
}

pub async fn attach_api_key_mapping_policy(
    pool: &PgPool,
    api_key_id: String,
    request: AttachApiKeyMappingPolicyRequest,
) -> Result<ApiKeyMappingPolicy, sqlx::Error> {
    sqlx::query(
        r#"
        INSERT INTO api_key_mapping_policies (api_key_id, mapping_policy_id, enabled)
        VALUES ($1, $2, true)
        ON CONFLICT (api_key_id, mapping_policy_id)
        DO UPDATE SET enabled = true
        "#,
    )
    .bind(&api_key_id)
    .bind(&request.mapping_policy_id)
    .execute(pool)
    .await?;

    get_api_key_mapping_policy(pool, &api_key_id, &request.mapping_policy_id).await
}

pub async fn detach_api_key_mapping_policy(
    pool: &PgPool,
    api_key_id: &str,
    mapping_policy_id: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        DELETE FROM api_key_mapping_policies
        WHERE api_key_id = $1 AND mapping_policy_id = $2
        "#,
    )
    .bind(api_key_id)
    .bind(mapping_policy_id)
    .execute(pool)
    .await?;
    Ok(())
}

async fn get_api_key_mapping_policy(
    pool: &PgPool,
    api_key_id: &str,
    mapping_policy_id: &str,
) -> Result<ApiKeyMappingPolicy, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT
            akmp.mapping_policy_id,
            akmp.enabled AS link_enabled,
            mp.epichust_model_id,
            em.model_name AS epichust_model_name,
            mp.routing_strategy
        FROM api_key_mapping_policies akmp
        JOIN mapping_policies mp ON mp.id = akmp.mapping_policy_id
        JOIN epichust_models em ON em.id = mp.epichust_model_id
        WHERE akmp.api_key_id = $1 AND akmp.mapping_policy_id = $2
        "#,
    )
    .bind(api_key_id)
    .bind(mapping_policy_id)
    .fetch_one(pool)
    .await?;

    let routes = load_mapping_policy_routes(pool, mapping_policy_id).await?;
    let rate_limit_rules = load_rate_limit_rules(pool, mapping_policy_id).await?;

    Ok(ApiKeyMappingPolicy {
        mapping_policy_id: row.try_get("mapping_policy_id")?,
        epichust_model_id: row.try_get("epichust_model_id")?,
        epichust_model_name: row.try_get("epichust_model_name")?,
        routing_strategy: parse_routing_strategy(row.try_get("routing_strategy")?),
        rate_limit_rules,
        enabled: row.try_get("link_enabled")?,
        routes,
    })
}

pub async fn list_audit_logs(pool: &PgPool) -> Result<Vec<AuditLogEntry>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT
            request_id,
            api_key_id,
            epichust_model_name,
            provider_id,
            provider_model_name,
            method,
            path,
            status_code,
            latency_ms,
            total_tokens,
            created_at
        FROM audit_logs
        ORDER BY created_at DESC
        LIMIT 100
        "#,
    )
    .fetch_all(pool)
    .await?;

    rows.into_iter()
        .map(|row| {
            Ok(AuditLogEntry {
                request_id: row.try_get("request_id")?,
                api_key_id: row.try_get("api_key_id")?,
                epichust_model_name: row.try_get("epichust_model_name")?,
                provider_id: row.try_get("provider_id")?,
                provider_model_name: row.try_get("provider_model_name")?,
                method: row.try_get("method")?,
                path: row.try_get("path")?,
                status_code: i32_to_u16(row.try_get("status_code")?),
                latency_ms: i64_to_u128(row.try_get("latency_ms")?),
                total_tokens: optional_i32_to_u64(row.try_get("total_tokens")?),
                created_at: row.try_get("created_at")?,
            })
        })
        .collect()
}

fn provider_model_from_row(row: sqlx::postgres::PgRow) -> Result<ProviderModel, sqlx::Error> {
    Ok(ProviderModel {
        id: row.try_get("id")?,
        provider_id: row.try_get("provider_id")?,
        model_name: row.try_get("model_name")?,
        created_at: row.try_get("created_at")?,
    })
}

fn parse_model_type(value: String) -> ModelType {
    match value.as_str() {
        "embedding_model" => ModelType::EmbeddingModel,
        _ => ModelType::ChatModel,
    }
}

fn model_type_to_str(value: &ModelType) -> &'static str {
    match value {
        ModelType::ChatModel => "chat_model",
        ModelType::EmbeddingModel => "embedding_model",
    }
}

fn parse_routing_strategy(value: String) -> RoutingStrategy {
    match value.as_str() {
        "priority" => RoutingStrategy::Priority,
        "round_robin" => RoutingStrategy::RoundRobin,
        _ => RoutingStrategy::Weighted,
    }
}

fn routing_strategy_to_str(value: &RoutingStrategy) -> &'static str {
    match value {
        RoutingStrategy::Weighted => "weighted",
        RoutingStrategy::Priority => "priority",
        RoutingStrategy::RoundRobin => "round_robin",
    }
}

fn parse_usage_limit_type(value: String) -> UsageLimitType {
    match value.as_str() {
        "requests_per_day" => UsageLimitType::RequestsPerDay,
        "tokens_per_minute" => UsageLimitType::TokensPerMinute,
        "tokens_per_day" => UsageLimitType::TokensPerDay,
        _ => UsageLimitType::RequestsPerMinute,
    }
}

fn usage_limit_type_to_str(value: &UsageLimitType) -> &'static str {
    match value {
        UsageLimitType::RequestsPerMinute => "requests_per_minute",
        UsageLimitType::RequestsPerDay => "requests_per_day",
        UsageLimitType::TokensPerMinute => "tokens_per_minute",
        UsageLimitType::TokensPerDay => "tokens_per_day",
    }
}

fn generated_id(prefix: &str) -> String {
    format!("{prefix}_{}", Uuid::new_v4().simple())
}

fn mapping_policy_id() -> String {
    generated_id("mp")
}

fn i32_to_u16(value: i32) -> u16 {
    value.try_into().unwrap_or_default()
}

fn i32_to_u32(value: i32) -> u32 {
    value.try_into().unwrap_or_default()
}

fn i64_to_u32(value: i64) -> u32 {
    value.try_into().unwrap_or_default()
}

fn i64_to_u128(value: i64) -> u128 {
    value.try_into().unwrap_or_default()
}

fn optional_i32_to_u64(value: Option<i32>) -> Option<u64> {
    value.and_then(|value| value.try_into().ok())
}
