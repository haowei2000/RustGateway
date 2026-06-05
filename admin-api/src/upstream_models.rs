use std::time::Duration;

use llm_gateway_common::models::AvailableProviderModel;
use reqwest::{StatusCode, Url};
use serde::Deserialize;

use crate::repositories::ProviderCredentials;

const MODEL_FETCH_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Debug)]
pub enum FetchProviderModelsError {
    InvalidBaseUrl { base_url: String },
    Request(reqwest::Error),
    UpstreamStatus { status: StatusCode },
    InvalidResponse(reqwest::Error),
}

pub async fn fetch_available_models(
    provider: &ProviderCredentials,
) -> Result<Vec<AvailableProviderModel>, FetchProviderModelsError> {
    let url = provider_models_url(&provider.provider_base_url)?;
    let client = reqwest::Client::builder()
        .timeout(MODEL_FETCH_TIMEOUT)
        .build()
        .map_err(FetchProviderModelsError::Request)?;

    let response = client
        .get(url)
        .bearer_auth(provider.provider_key.trim())
        .send()
        .await
        .map_err(FetchProviderModelsError::Request)?;

    let status = response.status();
    if !status.is_success() {
        return Err(FetchProviderModelsError::UpstreamStatus { status });
    }

    let upstream = response
        .json::<UpstreamModelsResponse>()
        .await
        .map_err(FetchProviderModelsError::InvalidResponse)?;

    let mut models = upstream
        .data
        .into_iter()
        .filter_map(|model| {
            let model_name = model.id.trim().to_owned();
            if model_name.is_empty() {
                None
            } else {
                Some(AvailableProviderModel {
                    model_name,
                    owned_by: model.owned_by,
                })
            }
        })
        .collect::<Vec<_>>();

    models.sort_by(|left, right| left.model_name.cmp(&right.model_name));
    models.dedup_by(|left, right| left.model_name == right.model_name);
    Ok(models)
}

fn provider_models_url(base_url: &str) -> Result<Url, FetchProviderModelsError> {
    let trimmed = base_url.trim().trim_end_matches('/');
    let model_url = if trimmed.ends_with("/models") {
        trimmed.to_owned()
    } else if trimmed.ends_with("/v1") {
        format!("{trimmed}/models")
    } else {
        format!("{trimmed}/v1/models")
    };

    Url::parse(&model_url).map_err(|_| FetchProviderModelsError::InvalidBaseUrl {
        base_url: base_url.to_owned(),
    })
}

#[derive(Debug, Deserialize)]
struct UpstreamModelsResponse {
    data: Vec<UpstreamModel>,
}

#[derive(Debug, Deserialize)]
struct UpstreamModel {
    id: String,
    owned_by: Option<String>,
}
