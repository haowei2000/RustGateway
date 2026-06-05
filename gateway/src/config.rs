use std::{collections::HashSet, env};

use anyhow::{bail, Context, Result};
use llm_gateway_common::api_key::hash_api_key;
use url::Url;

#[derive(Debug, Clone)]
pub struct GatewayConfig {
    pub bind_addr: String,
    pub metrics_bind_addr: String,
    pub redis_url: Option<String>,
    pub upstream_base_url: Url,
    pub upstream_host: String,
    pub upstream_port: u16,
    pub upstream_tls: bool,
    pub openai_api_key: Option<String>,
    pub openai_key_ref: String,
    pub internal_api_key_hashes: HashSet<String>,
}

impl GatewayConfig {
    pub fn from_env() -> Result<Self> {
        let bind_addr = env_or("GATEWAY_BIND_ADDR", "0.0.0.0:8080");
        let metrics_bind_addr = env_or("METRICS_BIND_ADDR", "0.0.0.0:9090");
        let redis_url = env::var("REDIS_URL").ok().filter(|value| !value.is_empty());
        let upstream_base_url = Url::parse(&env_or("OPENAI_BASE_URL", "https://api.openai.com"))
            .context("OPENAI_BASE_URL must be a valid URL")?;
        let upstream_host = upstream_base_url
            .host_str()
            .context("OPENAI_BASE_URL must include a host")?
            .to_owned();
        let upstream_tls = upstream_base_url.scheme() == "https";
        let upstream_port = upstream_base_url
            .port_or_known_default()
            .context("OPENAI_BASE_URL must have an explicit or known default port")?;

        if !matches!(upstream_base_url.scheme(), "http" | "https") {
            bail!("OPENAI_BASE_URL must use http or https");
        }

        let mut internal_api_key_hashes = parse_csv_env("INTERNAL_API_KEY_HASHES")
            .into_iter()
            .collect::<HashSet<_>>();
        for key in parse_csv_env("INTERNAL_API_KEYS") {
            internal_api_key_hashes.insert(hash_api_key(&key));
        }

        Ok(Self {
            bind_addr,
            metrics_bind_addr,
            redis_url,
            upstream_base_url,
            upstream_host,
            upstream_port,
            upstream_tls,
            openai_api_key: env::var("OPENAI_API_KEY")
                .ok()
                .filter(|value| !value.trim().is_empty()),
            openai_key_ref: env::var("OPENAI_KEY_REF").unwrap_or_default(),
            internal_api_key_hashes,
        })
    }
}

fn env_or(key: &str, fallback: &str) -> String {
    env::var(key).unwrap_or_else(|_| fallback.to_owned())
}

fn parse_csv_env(key: &str) -> Vec<String> {
    env::var(key)
        .ok()
        .into_iter()
        .flat_map(|value| {
            value
                .split(',')
                .map(str::trim)
                .filter(|item| !item.is_empty())
                .map(ToOwned::to_owned)
                .collect::<Vec<_>>()
        })
        .collect()
}
