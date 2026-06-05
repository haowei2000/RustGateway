mod config;
mod db;
mod repositories;
mod routes;
mod upstream_models;

use std::sync::Arc;

use anyhow::Result;
use config::AdminApiConfig;
use routes::{router, AppState};
use tokio::net::TcpListener;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "axum_admin_api=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    let config = AdminApiConfig::from_env()?;
    let addr = config.bind_addr;
    let database = db::connect(&config).await?;
    let state = Arc::new(AppState::new(config, database));

    let app = router(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());

    tracing::info!(%addr, "starting axum-admin-api");
    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
