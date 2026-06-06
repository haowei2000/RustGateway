use std::env;

use anyhow::Result;

#[derive(Debug, Clone)]
pub struct GatewayConfig {
    pub bind_addr: String,
    pub metrics_bind_addr: String,
    pub database_url: Option<String>,
    pub redis_url: Option<String>,
}

impl GatewayConfig {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            bind_addr: env_or("GATEWAY_BIND_ADDR", "0.0.0.0:8080"),
            metrics_bind_addr: env_or("METRICS_BIND_ADDR", "0.0.0.0:9090"),
            database_url: env::var("DATABASE_URL")
                .ok()
                .filter(|v| !v.is_empty()),
            redis_url: env::var("REDIS_URL")
                .ok()
                .filter(|v| !v.is_empty()),
        })
    }
}

fn env_or(key: &str, fallback: &str) -> String {
    env::var(key).unwrap_or_else(|_| fallback.to_owned())
}
