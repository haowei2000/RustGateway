use std::time::Duration;

use anyhow::{Context, Result};
use sqlx::{postgres::PgPoolOptions, Executor, PgPool};

use crate::config::AdminApiConfig;

const MIGRATIONS: &[&str] = &[
    include_str!("../../deploy/sql/001_init.sql"),
    include_str!("../../deploy/sql/002_mapping_policies.sql"),
    include_str!("../../deploy/sql/003_rate_limit_rules.sql"),
];

pub async fn connect(config: &AdminApiConfig) -> Result<Option<PgPool>> {
    let Some(database_url) = &config.database_url else {
        tracing::warn!("DATABASE_URL is not configured; admin-api data endpoints are unavailable");
        return Ok(None);
    };

    let pool = PgPoolOptions::new()
        .max_connections(config.database_max_connections)
        .acquire_timeout(Duration::from_secs(5))
        .after_connect(|connection, _metadata| {
            Box::pin(async move {
                connection
                    .execute("SET application_name = 'axum-admin-api';")
                    .await?;
                Ok(())
            })
        })
        .connect(database_url)
        .await
        .context("failed to connect to PostgreSQL")?;

    if config.database_auto_migrate {
        run_init_schema(&pool).await?;
    }

    tracing::info!(
        max_connections = config.database_max_connections,
        auto_migrate = config.database_auto_migrate,
        "PostgreSQL component initialized"
    );

    Ok(Some(pool))
}

pub async fn is_ready(pool: &PgPool) -> bool {
    sqlx::query("SELECT 1").execute(pool).await.is_ok()
}

async fn run_init_schema(pool: &PgPool) -> Result<()> {
    for (i, migration) in MIGRATIONS.iter().enumerate() {
        sqlx::raw_sql(migration)
            .execute(pool)
            .await
            .with_context(|| format!("failed to run migration {i}"))?;
    }
    Ok(())
}
