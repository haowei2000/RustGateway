mod config;
mod proxy;

use std::sync::Arc;

use anyhow::Result;
use config::GatewayConfig;
use pingora_core::{server::configuration::Opt, server::Server, services::listening::Service};
use proxy::LlmGateway;

fn main() -> Result<()> {
    env_logger::init();

    let config = Arc::new(GatewayConfig::from_env()?);
    log::info!(
        "starting pingora-gateway on {}, metrics on {}, upstream {}, redis_configured={}, openai_key_ref={}",
        config.bind_addr,
        config.metrics_bind_addr,
        config.upstream_base_url,
        config.redis_url.is_some(),
        &config.openai_key_ref
    );

    let opt = Opt::parse_args();
    let mut server = Server::new(Some(opt))?;
    server.bootstrap();

    let mut gateway =
        pingora_proxy::http_proxy_service(&server.configuration, LlmGateway::new(config.clone())?);
    gateway.add_tcp(&config.bind_addr);
    server.add_service(gateway);

    let mut metrics = Service::prometheus_http_service();
    metrics.add_tcp(&config.metrics_bind_addr);
    server.add_service(metrics);

    server.run_forever();
}
