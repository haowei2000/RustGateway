//! Non-blocking audit persistence.
//!
//! The request hot path builds an [`AuditRow`] and `try_send`s it to a bounded
//! channel (never blocks; rows are dropped if the writer falls far behind). A
//! dedicated background thread owns a Postgres pool and batch-inserts rows into
//! `audit_logs`, so the proxy never waits on a DB round-trip.

use std::time::Duration;

use chrono::{DateTime, Utc};
use sqlx::PgPool;
use tokio::sync::mpsc;
use uuid::Uuid;

/// One row destined for `audit_logs`, built on the request path.
#[derive(Debug)]
pub struct AuditRow {
    pub request_id: Uuid,
    pub api_key_id: Option<String>,
    pub epichust_model_name: Option<String>,
    pub provider_id: Option<String>,
    pub provider_model_name: Option<String>,
    pub client_ip: Option<String>,
    pub method: String,
    pub path: String,
    pub stream: Option<bool>,
    pub status_code: i32,
    pub auth_result: String,
    pub reject_reason: Option<String>,
    pub upstream_host: Option<String>,
    pub latency_ms: i64,
    pub created_at: DateTime<Utc>,
}

const CHANNEL_CAPACITY: usize = 8192;
const BATCH_SIZE: usize = 256;
const FLUSH_INTERVAL: Duration = Duration::from_millis(500);

/// Spawn the background writer and return a bounded sender. The sender is cheap
/// to clone and safe to use from the proxy's async context via `try_send`.
pub fn start_audit_writer(database_url: &str) -> mpsc::Sender<AuditRow> {
    let (tx, mut rx) = mpsc::channel::<AuditRow>(CHANNEL_CAPACITY);
    let url = database_url.to_owned();

    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("audit writer tokio runtime");

        rt.block_on(async move {
            let pool = loop {
                match PgPool::connect(&url).await {
                    Ok(p) => break p,
                    Err(e) => {
                        log::warn!("audit writer DB connect failed, retrying in 3s: {e}");
                        tokio::time::sleep(Duration::from_secs(3)).await;
                    }
                }
            };
            log::info!("audit writer connected to PostgreSQL");

            let mut batch: Vec<AuditRow> = Vec::with_capacity(BATCH_SIZE);
            loop {
                // Block until at least one row arrives (or all senders drop).
                let Some(first) = rx.recv().await else { break };
                batch.push(first);

                // Coalesce more rows for up to FLUSH_INTERVAL, capped at BATCH_SIZE.
                let deadline = tokio::time::sleep(FLUSH_INTERVAL);
                tokio::pin!(deadline);
                while batch.len() < BATCH_SIZE {
                    tokio::select! {
                        _ = &mut deadline => break,
                        maybe = rx.recv() => match maybe {
                            Some(row) => batch.push(row),
                            None => break,
                        },
                    }
                }

                if let Err(e) = insert_batch(&pool, &batch).await {
                    log::error!("audit batch insert ({} rows) failed: {e}", batch.len());
                }
                batch.clear();
            }
            log::info!("audit writer stopped (all senders dropped)");
        });
    });

    tx
}

async fn insert_batch(pool: &PgPool, rows: &[AuditRow]) -> Result<(), sqlx::Error> {
    if rows.is_empty() {
        return Ok(());
    }
    let mut qb = sqlx::QueryBuilder::new(
        "INSERT INTO audit_logs (\
         request_id, api_key_id, epichust_model_name, provider_id, provider_model_name, \
         client_ip, method, path, stream, status_code, auth_result, reject_reason, \
         upstream_host, latency_ms, created_at) ",
    );
    qb.push_values(rows, |mut b, row| {
        b.push_bind(row.request_id)
            .push_bind(row.api_key_id.as_deref())
            .push_bind(row.epichust_model_name.as_deref())
            .push_bind(row.provider_id.as_deref())
            .push_bind(row.provider_model_name.as_deref())
            .push_bind(row.client_ip.as_deref())
            .push_bind(row.method.as_str())
            .push_bind(row.path.as_str())
            .push_bind(row.stream)
            .push_bind(row.status_code)
            .push_bind(row.auth_result.as_str())
            .push_bind(row.reject_reason.as_deref())
            .push_bind(row.upstream_host.as_deref())
            .push_bind(row.latency_ms)
            .push_bind(row.created_at);
    });
    // A request_id is the PK; a retry/duplicate must never fail the batch.
    qb.push(" ON CONFLICT (request_id) DO NOTHING");
    qb.build().execute(pool).await?;
    Ok(())
}
