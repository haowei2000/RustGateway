use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json, Router,
};
use llm_gateway_common::models::{
    ApiKeyMappingPolicy, ApiKeySummary, AttachApiKeyMappingPolicyRequest, AuditLogEntry,
    CreateApiKeyRequest, CreateApiKeyResponse, CreateEpichustModelRequest,
    CreateMappingPolicyRequest, CreateProviderModelRequest, CreateProviderRequest,
    CreateProviderResponse, EpichustModel, MappingPolicy, ProviderAvailableModelsResponse,
    ProviderModel, ProviderSummary, UpdateMappingPolicyRequest,
};
use serde::Serialize;
use utoipa::ToSchema;
use utoipa_axum::{router::OpenApiRouter, routes};
use utoipa_swagger_ui::SwaggerUi;

use crate::config::AdminApiConfig;
use crate::db;
use crate::repositories;
use crate::upstream_models::{self, FetchProviderModelsError};

#[derive(Clone)]
pub struct AppState {
    config: AdminApiConfig,
    database: Option<sqlx::PgPool>,
}

impl AppState {
    pub fn new(config: AdminApiConfig, database: Option<sqlx::PgPool>) -> Self {
        Self { config, database }
    }
}

pub fn router(state: Arc<AppState>) -> Router {
    let (documented_routes, mut openapi) = OpenApiRouter::<Arc<AppState>>::new()
        .routes(routes!(healthz))
        .routes(routes!(readyz))
        .nest("/admin-api", api_routes())
        .split_for_parts();
    openapi.info.title = "LLM Gateway Admin API".to_owned();
    openapi.info.version = env!("CARGO_PKG_VERSION").to_owned();
    openapi.info.description = Some(
        "Administration API for managing API keys, providers, gateway models, and model mappings."
            .to_owned(),
    );

    documented_routes
        .nest("/api", Router::from(api_routes()))
        .merge(SwaggerUi::new("/docs").url("/openapi.json", openapi))
        .with_state(state)
}

fn api_routes() -> OpenApiRouter<Arc<AppState>> {
    OpenApiRouter::new()
        .routes(routes!(
            api_keys,
            create_api_key,
            update_api_key,
            delete_api_key,
            rotate_api_key
        ))
        .routes(routes!(attach_api_key_mapping_policy))
        .routes(routes!(detach_api_key_mapping_policy))
        .routes(routes!(
            epichust_models,
            create_epichust_model,
            delete_epichust_model,
            update_epichust_model
        ))
        .routes(routes!(providers, create_provider))
        .routes(routes!(provider_available_models))
        .routes(routes!(
            provider_models,
            create_provider_model,
            delete_provider_model
        ))
        .routes(routes!(mapping_policies, create_mapping_policy))
        .routes(routes!(
            get_mapping_policy,
            update_mapping_policy,
            delete_mapping_policy
        ))
        .routes(routes!(delete_provider, update_provider))
        .routes(routes!(audit_logs))
}

#[utoipa::path(
    get,
    path = "/healthz",
    tag = "Health",
    responses((status = OK, description = "Service is alive.", body = ServiceHealth))
)]
async fn healthz() -> Json<ServiceHealth> {
    Json(ServiceHealth {
        status: "ok".to_owned(),
        service: "axum-admin-api".to_owned(),
    })
}

#[utoipa::path(
    get,
    path = "/readyz",
    tag = "Health",
    responses(
        (status = OK, description = "Service dependency readiness.", body = Readiness),
        (status = 503, description = "A configured dependency is unavailable.", body = Readiness)
    )
)]
async fn readyz(State(state): State<Arc<AppState>>) -> (StatusCode, Json<Readiness>) {
    let database_configured = state.config.database_url.is_some();
    let database_ready = match &state.database {
        Some(pool) => db::is_ready(pool).await,
        None => false,
    };
    let ready = database_configured && database_ready;

    (
        if ready {
            StatusCode::OK
        } else {
            StatusCode::SERVICE_UNAVAILABLE
        },
        Json(Readiness {
            status: if ready { "ok" } else { "degraded" }.to_owned(),
            database_configured,
            database_ready,
            redis_configured: state.config.redis_url.is_some(),
            jwt_configured: !state.config.jwt_secret.is_empty(),
        }),
    )
}

#[utoipa::path(
    get,
    path = "/v1/epichust-models",
    tag = "Models",
    responses((status = OK, description = "List gateway model definitions.", body = [EpichustModel]))
)]
async fn epichust_models(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<EpichustModel>>, ApiError> {
    let pool = database_pool(&state)?;
    Ok(Json(repositories::list_epichust_models(pool).await?))
}

#[utoipa::path(
    post,
    path = "/v1/epichust-models",
    tag = "Models",
    request_body = CreateEpichustModelRequest,
    responses((status = OK, description = "Create a gateway model definition.", body = EpichustModel))
)]
async fn create_epichust_model(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateEpichustModelRequest>,
) -> Result<Json<EpichustModel>, ApiError> {
    let pool = database_pool(&state)?;
    Ok(Json(
        repositories::create_epichust_model(pool, request).await?,
    ))
}

#[utoipa::path(
    put,
    path = "/v1/epichust-models/{id}",
    tag = "Models",
    params(("id" = String, Path, description = "Gateway model identifier.")),
    request_body = CreateEpichustModelRequest,
    responses((status = NO_CONTENT, description = "Update a gateway model definition."))
)]
async fn update_epichust_model(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(request): Json<CreateEpichustModelRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let pool = database_pool(&state)?;
    repositories::update_epichust_model(pool, &id, request).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/v1/providers",
    tag = "Providers",
    responses((status = OK, description = "List upstream providers.", body = [ProviderSummary]))
)]
async fn providers(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<ProviderSummary>>, ApiError> {
    let pool = database_pool(&state)?;
    Ok(Json(repositories::list_providers(pool).await?))
}

#[utoipa::path(
    post,
    path = "/v1/providers",
    tag = "Providers",
    request_body = CreateProviderRequest,
    responses((status = OK, description = "Create an upstream provider.", body = CreateProviderResponse))
)]
async fn create_provider(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateProviderRequest>,
) -> Result<Json<CreateProviderResponse>, ApiError> {
    let pool = database_pool(&state)?;
    Ok(Json(repositories::create_provider(pool, request).await?))
}

#[derive(Serialize, ToSchema, serde::Deserialize)]
struct UpdateProviderRequest {
    provider_name: String,
    provider_base_url: String,
    /// New upstream key. Omit or leave empty to keep the existing key.
    #[serde(default)]
    #[schema(write_only)]
    provider_key: Option<String>,
}

#[utoipa::path(
    put,
    path = "/v1/providers/{id}",
    tag = "Providers",
    params(("id" = String, Path, description = "Provider identifier.")),
    request_body = UpdateProviderRequest,
    responses((status = NO_CONTENT, description = "Update an upstream provider."))
)]
async fn update_provider(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(request): Json<UpdateProviderRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let pool = database_pool(&state)?;
    repositories::update_provider(
        pool,
        &id,
        &request.provider_name,
        &request.provider_base_url,
        request.provider_key,
    )
    .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/v1/providers/{provider_id}/available-models",
    tag = "Providers",
    params(("provider_id" = String, Path, description = "Provider identifier.")),
    responses(
        (status = OK, description = "Fetch available model names from the upstream provider.", body = ProviderAvailableModelsResponse),
        (status = NOT_FOUND, description = "Provider was not found."),
        (status = BAD_GATEWAY, description = "Upstream provider did not return a valid model list.")
    )
)]
async fn provider_available_models(
    State(state): State<Arc<AppState>>,
    Path(provider_id): Path<String>,
) -> Result<Json<ProviderAvailableModelsResponse>, ApiError> {
    let pool = database_pool(&state)?;
    let provider = repositories::get_provider_credentials(pool, &provider_id)
        .await?
        .ok_or_else(|| ApiError::provider_not_found(provider_id.clone()))?;
    let models = upstream_models::fetch_available_models(&provider).await?;

    Ok(Json(ProviderAvailableModelsResponse {
        provider_id: provider.id,
        provider_name: provider.provider_name,
        models,
    }))
}

#[utoipa::path(
    get,
    path = "/v1/provider-models",
    tag = "Provider Models",
    responses((status = OK, description = "List models fetched from upstream providers.", body = [ProviderModel]))
)]
async fn provider_models(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<ProviderModel>>, ApiError> {
    let pool = database_pool(&state)?;
    Ok(Json(repositories::list_provider_models(pool).await?))
}

#[utoipa::path(
    post,
    path = "/v1/provider-models",
    tag = "Provider Models",
    request_body = CreateProviderModelRequest,
    responses((status = OK, description = "Create an upstream provider model.", body = ProviderModel))
)]
async fn create_provider_model(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateProviderModelRequest>,
) -> Result<Json<ProviderModel>, ApiError> {
    let pool = database_pool(&state)?;
    Ok(Json(
        repositories::create_provider_model(pool, request).await?,
    ))
}

#[utoipa::path(
    delete,
    path = "/v1/provider-models/{id}",
    tag = "Provider Models",
    params(("id" = String, Path, description = "Provider model identifier.")),
    responses((status = NO_CONTENT, description = "Delete a provider model. Routes that reference it are removed."))
)]
async fn delete_provider_model(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let pool = database_pool(&state)?;
    repositories::delete_provider_model(pool, &id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/v1/mapping-policies",
    tag = "Mapping Policies",
    responses((status = OK, description = "List mapping policies.", body = [MappingPolicy]))
)]
async fn mapping_policies(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<MappingPolicy>>, ApiError> {
    let pool = database_pool(&state)?;
    Ok(Json(repositories::list_mapping_policies(pool).await?))
}

#[utoipa::path(
    post,
    path = "/v1/mapping-policies",
    tag = "Mapping Policies",
    request_body = CreateMappingPolicyRequest,
    responses((status = OK, description = "Create a mapping policy.", body = MappingPolicy))
)]
async fn create_mapping_policy(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateMappingPolicyRequest>,
) -> Result<Json<MappingPolicy>, ApiError> {
    let pool = database_pool(&state)?;
    Ok(Json(
        repositories::create_mapping_policy(pool, request).await?,
    ))
}

#[utoipa::path(
    get,
    path = "/v1/mapping-policies/{id}",
    tag = "Mapping Policies",
    params(("id" = String, Path, description = "Mapping policy identifier.")),
    responses((status = OK, description = "Get a mapping policy by ID.", body = MappingPolicy))
)]
async fn get_mapping_policy(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<MappingPolicy>, ApiError> {
    let pool = database_pool(&state)?;
    Ok(Json(repositories::get_mapping_policy(pool, &id).await?))
}

#[utoipa::path(
    put,
    path = "/v1/mapping-policies/{id}",
    tag = "Mapping Policies",
    params(("id" = String, Path, description = "Mapping policy identifier.")),
    request_body = UpdateMappingPolicyRequest,
    responses((status = OK, description = "Update a mapping policy.", body = MappingPolicy))
)]
async fn update_mapping_policy(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(request): Json<UpdateMappingPolicyRequest>,
) -> Result<Json<MappingPolicy>, ApiError> {
    let pool = database_pool(&state)?;
    Ok(Json(
        repositories::update_mapping_policy(pool, &id, request).await?,
    ))
}

#[utoipa::path(
    delete,
    path = "/v1/mapping-policies/{id}",
    tag = "Mapping Policies",
    params(("id" = String, Path, description = "Mapping policy identifier.")),
    responses((status = NO_CONTENT, description = "Delete a mapping policy."))
)]
async fn delete_mapping_policy(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let pool = database_pool(&state)?;
    repositories::delete_mapping_policy(pool, &id).await?;
    Ok(StatusCode::NO_CONTENT)
}

// ── API Key ↔ Mapping Policy ──

#[utoipa::path(
    get,
    path = "/v1/api-keys",
    tag = "API Keys",
    responses((status = OK, description = "List API keys and their model access configuration.", body = [ApiKeySummary]))
)]
async fn api_keys(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<ApiKeySummary>>, ApiError> {
    let pool = database_pool(&state)?;
    Ok(Json(repositories::list_api_keys(pool).await?))
}

#[utoipa::path(
    post,
    path = "/v1/api-keys",
    tag = "API Keys",
    request_body = CreateApiKeyRequest,
    responses((status = OK, description = "Create an API key. The plaintext key is returned once.", body = CreateApiKeyResponse))
)]
async fn create_api_key(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateApiKeyRequest>,
) -> Result<Json<CreateApiKeyResponse>, ApiError> {
    let pool = database_pool(&state)?;
    Ok(Json(repositories::create_api_key(pool, request).await?))
}

#[derive(Serialize, ToSchema, serde::Deserialize)]
struct UpdateApiKeyRequest {
    key_name: String,
    enabled: bool,
}

#[utoipa::path(
    put,
    path = "/v1/api-keys/{id}",
    tag = "API Keys",
    params(("id" = String, Path, description = "API key identifier.")),
    request_body = UpdateApiKeyRequest,
    responses((status = NO_CONTENT, description = "Update an API key."))
)]
async fn update_api_key(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(request): Json<UpdateApiKeyRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let pool = database_pool(&state)?;
    repositories::update_api_key(pool, &id, &request.key_name, request.enabled).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/v1/api-keys/{id}",
    tag = "API Keys",
    params(("id" = String, Path, description = "API key identifier.")),
    responses((status = NO_CONTENT, description = "Delete an API key."))
)]
async fn delete_api_key(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let pool = database_pool(&state)?;
    repositories::delete_api_key(pool, &id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    patch,
    path = "/v1/api-keys/{id}/rotate",
    tag = "API Keys",
    params(("id" = String, Path, description = "API key identifier.")),
    responses((status = OK, description = "Rotate an API key. Returns the new plaintext key once.", body = CreateApiKeyResponse))
)]
async fn rotate_api_key(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<CreateApiKeyResponse>, ApiError> {
    let pool = database_pool(&state)?;
    Ok(Json(repositories::rotate_api_key(pool, &id).await?))
}

#[utoipa::path(
    delete,
    path = "/v1/epichust-models/{id}",
    tag = "Models",
    params(("id" = String, Path, description = "Model identifier.")),
    responses((status = NO_CONTENT, description = "Delete an Epichust model."))
)]
async fn delete_epichust_model(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let pool = database_pool(&state)?;
    repositories::delete_epichust_model(pool, &id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/v1/providers/{id}",
    tag = "Providers",
    params(("id" = String, Path, description = "Provider identifier.")),
    responses((status = NO_CONTENT, description = "Delete a provider and its models."))
)]
async fn delete_provider(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
    let pool = database_pool(&state)?;
    repositories::delete_provider(pool, &id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/v1/api-keys/{api_key_id}/mapping-policies",
    tag = "API Keys",
    params(("api_key_id" = String, Path, description = "API key identifier.")),
    request_body = AttachApiKeyMappingPolicyRequest,
    responses((status = OK, description = "Attach a mapping policy to an API key.", body = ApiKeyMappingPolicy))
)]
async fn attach_api_key_mapping_policy(
    State(state): State<Arc<AppState>>,
    Path(api_key_id): Path<String>,
    Json(request): Json<AttachApiKeyMappingPolicyRequest>,
) -> Result<Json<ApiKeyMappingPolicy>, ApiError> {
    let pool = database_pool(&state)?;
    Ok(Json(
        repositories::attach_api_key_mapping_policy(pool, api_key_id, request).await?,
    ))
}

#[utoipa::path(
    delete,
    path = "/v1/api-keys/{api_key_id}/mapping-policies/{mapping_policy_id}",
    tag = "API Keys",
    params(
        ("api_key_id" = String, Path, description = "API key identifier."),
        ("mapping_policy_id" = String, Path, description = "Mapping policy identifier.")
    ),
    responses((status = NO_CONTENT, description = "Detach a mapping policy from an API key."))
)]
async fn detach_api_key_mapping_policy(
    State(state): State<Arc<AppState>>,
    Path((api_key_id, mapping_policy_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, ApiError> {
    let pool = database_pool(&state)?;
    repositories::detach_api_key_mapping_policy(pool, &api_key_id, &mapping_policy_id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    get,
    path = "/v1/audit-logs",
    tag = "Audit Logs",
    responses((status = OK, description = "List recent request audit log entries.", body = [AuditLogEntry]))
)]
async fn audit_logs(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<AuditLogEntry>>, ApiError> {
    let pool = database_pool(&state)?;
    Ok(Json(repositories::list_audit_logs(pool).await?))
}

#[derive(Serialize, ToSchema)]
struct ServiceHealth {
    status: String,
    service: String,
}

#[derive(Serialize, ToSchema)]
struct Readiness {
    status: String,
    database_configured: bool,
    database_ready: bool,
    redis_configured: bool,
    jwt_configured: bool,
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    error_type: &'static str,
    message: String,
}

impl ApiError {
    fn database_required() -> Self {
        Self {
            status: StatusCode::SERVICE_UNAVAILABLE,
            error_type: "database_unavailable",
            message: "DATABASE_URL is required for admin-api data endpoints".to_owned(),
        }
    }

    fn provider_not_found(provider_id: String) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            error_type: "provider_not_found",
            message: format!("provider {provider_id} was not found"),
        }
    }
}

impl From<sqlx::Error> for ApiError {
    fn from(error: sqlx::Error) -> Self {
        // Map well-known PostgreSQL SQLSTATE codes to actionable client errors
        // instead of an opaque 500. See https://www.postgresql.org/docs/current/errcodes-appendix.html
        if let Some(db_err) = error.as_database_error() {
            let code = db_err.code().unwrap_or_default();
            match code.as_ref() {
                "23505" => {
                    return Self {
                        status: StatusCode::CONFLICT,
                        error_type: "duplicate",
                        message: "a record with the same unique value already exists".to_owned(),
                    }
                }
                "23503" => {
                    return Self {
                        status: StatusCode::CONFLICT,
                        error_type: "foreign_key_violation",
                        message:
                            "this record is still referenced by, or references, another record"
                                .to_owned(),
                    }
                }
                "23514" => {
                    return Self {
                        status: StatusCode::BAD_REQUEST,
                        error_type: "check_violation",
                        message: "a field value violates a database constraint".to_owned(),
                    }
                }
                _ => {}
            }
        }
        tracing::error!(?error, "admin-api database operation failed");
        Self {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            error_type: "database_error",
            message: "database operation failed".to_owned(),
        }
    }
}

impl From<FetchProviderModelsError> for ApiError {
    fn from(error: FetchProviderModelsError) -> Self {
        match error {
            FetchProviderModelsError::InvalidBaseUrl { base_url } => Self {
                status: StatusCode::BAD_REQUEST,
                error_type: "invalid_provider_base_url",
                message: format!("provider_base_url is not a valid URL: {base_url}"),
            },
            FetchProviderModelsError::Request(error) => {
                tracing::error!(?error, "failed to fetch provider models");
                Self {
                    status: StatusCode::BAD_GATEWAY,
                    error_type: "provider_model_fetch_failed",
                    message: "failed to fetch models from upstream provider".to_owned(),
                }
            }
            FetchProviderModelsError::UpstreamStatus { status } => Self {
                status: StatusCode::BAD_GATEWAY,
                error_type: "provider_model_fetch_failed",
                message: format!("upstream provider returned {status} while fetching models"),
            },
            FetchProviderModelsError::InvalidResponse(error) => {
                tracing::error!(?error, "provider returned an invalid models response");
                Self {
                    status: StatusCode::BAD_GATEWAY,
                    error_type: "invalid_provider_models_response",
                    message: "upstream provider returned an invalid models response".to_owned(),
                }
            }
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(ErrorResponse {
                error: ErrorBody {
                    message: self.message,
                    error_type: self.error_type,
                },
            }),
        )
            .into_response()
    }
}

#[derive(Serialize)]
struct ErrorResponse {
    error: ErrorBody,
}

#[derive(Serialize)]
struct ErrorBody {
    message: String,
    #[serde(rename = "type")]
    error_type: &'static str,
}

fn database_pool(state: &AppState) -> Result<&sqlx::PgPool, ApiError> {
    state
        .database
        .as_ref()
        .ok_or_else(ApiError::database_required)
}
