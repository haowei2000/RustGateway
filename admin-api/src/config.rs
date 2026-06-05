use std::{env, net::SocketAddr};

use anyhow::{Context, Result};

#[derive(Debug, Clone)]
pub struct AdminApiConfig {
    pub bind_addr: SocketAddr,
    pub database_url: Option<String>,
    pub database_max_connections: u32,
    pub database_auto_migrate: bool,
    pub redis_url: Option<String>,
    pub jwt_secret: String,
}

impl AdminApiConfig {
    pub fn from_env() -> Result<Self> {
        let bind_addr = env_or("ADMIN_API_BIND_ADDR", "0.0.0.0:9000")
            .parse()
            .context("ADMIN_API_BIND_ADDR must be a valid socket address")?;

        Ok(Self {
            bind_addr,
            database_url: env::var("DATABASE_URL")
                .ok()
                .filter(|value| !value.is_empty()),
            database_max_connections: parse_u32_env("DATABASE_MAX_CONNECTIONS", 5)?,
            database_auto_migrate: parse_bool_env("DATABASE_AUTO_MIGRATE", true)?,
            redis_url: env::var("REDIS_URL").ok().filter(|value| !value.is_empty()),
            jwt_secret: env_or("JWT_SECRET", "local-dev-secret"),
        })
    }
}

fn env_or(key: &str, fallback: &str) -> String {
    env::var(key).unwrap_or_else(|_| fallback.to_owned())
}

fn parse_u32_env(key: &str, fallback: u32) -> Result<u32> {
    env::var(key)
        .ok()
        .filter(|value| !value.is_empty())
        .map(|value| {
            value
                .parse()
                .with_context(|| format!("{key} must be a positive integer"))
        })
        .transpose()
        .map(|value| value.unwrap_or(fallback))
}

fn parse_bool_env(key: &str, fallback: bool) -> Result<bool> {
    let Some(value) = env::var(key).ok().filter(|value| !value.is_empty()) else {
        return Ok(fallback);
    };

    match value.to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "on" => Ok(true),
        "0" | "false" | "no" | "off" => Ok(false),
        _ => anyhow::bail!("{key} must be a boolean"),
    }
}
