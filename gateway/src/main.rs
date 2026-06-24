mod audit_writer;
mod config;
mod db;
mod proxy;

use std::{sync::Arc, time::Duration};

use anyhow::Result;
use audit_writer::start_audit_writer;
use config::GatewayConfig;
use db::{new_cache, start_db_thread};
use pingora_core::{server::configuration::Opt, server::Server, services::listening::Service};
use proxy::LlmGateway;

fn main() -> Result<()> {
    env_logger::init();

    let config = Arc::new(GatewayConfig::from_env()?);
    let cache = new_cache();
    let mut audit_tx = None;

    if let Some(ref database_url) = config.database_url {
        start_db_thread(cache.clone(), database_url, Duration::from_secs(5));
        audit_tx = Some(start_audit_writer(database_url));
        log::info!("DB thread + audit writer started, waiting for initial cache load...");
        // Brief wait for the thread to connect and load
        std::thread::sleep(Duration::from_secs(2));
    } else {
        log::warn!("DATABASE_URL not configured — all requests will be rejected");
    }

    log::info!(
        "starting pingora-gateway on {}, metrics on {}, db_configured={}",
        config.bind_addr,
        config.metrics_bind_addr,
        config.database_url.is_some()
    );

    let opt = Opt::parse_args();
    let mut server = Server::new(Some(opt))?;
    server.bootstrap();

    let mut gateway = pingora_proxy::http_proxy_service(
        &server.configuration,
        LlmGateway::new(config.clone(), cache, audit_tx)?,
    );
    gateway.add_tcp(&config.bind_addr);
    server.add_service(gateway);

    let mut metrics = Service::prometheus_http_service();
    metrics.add_tcp(&config.metrics_bind_addr);
    server.add_service(metrics);

    server.run_forever();
}
