CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS epichust_models (
    id TEXT PRIMARY KEY,
    model_name TEXT NOT NULL UNIQUE,
    model_type TEXT NOT NULL CHECK (
        model_type IN ('chat_model', 'embedding_model')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS providers (
    id TEXT PRIMARY KEY,
    provider_name TEXT NOT NULL,
    provider_base_url TEXT NOT NULL,
    provider_key_ciphertext BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS provider_models (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider_id, model_name)
);

CREATE TABLE IF NOT EXISTS model_mappings (
    id TEXT PRIMARY KEY,
    epichust_model_id TEXT NOT NULL REFERENCES epichust_models(id) ON DELETE CASCADE,
    provider_model_id TEXT NOT NULL REFERENCES provider_models(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (epichust_model_id, provider_model_id)
);

CREATE TABLE IF NOT EXISTS epichust_api_keys (
    id TEXT PRIMARY KEY,
    key_name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_hash_prefix TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_key_model_configs (
    id TEXT PRIMARY KEY,
    api_key_id TEXT NOT NULL REFERENCES epichust_api_keys(id) ON DELETE CASCADE,
    epichust_model_id TEXT NOT NULL REFERENCES epichust_models(id) ON DELETE CASCADE,
    routing_strategy TEXT NOT NULL DEFAULT 'weighted' CHECK (
        routing_strategy IN ('weighted', 'priority')
    ),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (api_key_id, epichust_model_id)
);

CREATE TABLE IF NOT EXISTS api_key_model_routes (
    api_key_model_config_id TEXT NOT NULL REFERENCES api_key_model_configs(id) ON DELETE CASCADE,
    model_mapping_id TEXT NOT NULL REFERENCES model_mappings(id) ON DELETE CASCADE,
    weight INTEGER NOT NULL DEFAULT 100 CHECK (weight >= 0),
    priority INTEGER NOT NULL DEFAULT 100 CHECK (priority >= 0),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (api_key_model_config_id, model_mapping_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    request_id UUID PRIMARY KEY,
    api_key_id TEXT REFERENCES epichust_api_keys(id),
    epichust_model_id TEXT REFERENCES epichust_models(id),
    epichust_model_name TEXT,
    provider_id TEXT REFERENCES providers(id),
    provider_model_id TEXT REFERENCES provider_models(id),
    provider_model_name TEXT,
    client_ip TEXT,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    stream BOOLEAN,
    status_code INTEGER NOT NULL,
    auth_result TEXT NOT NULL,
    reject_reason TEXT,
    upstream_host TEXT,
    upstream_request_id TEXT,
    latency_ms BIGINT NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_epichust_models_type ON epichust_models(model_type);
CREATE INDEX IF NOT EXISTS idx_provider_models_provider ON provider_models(provider_id);
CREATE INDEX IF NOT EXISTS idx_model_mappings_epichust ON model_mappings(epichust_model_id, enabled);
CREATE INDEX IF NOT EXISTS idx_model_mappings_provider_model ON model_mappings(provider_model_id, enabled);
CREATE INDEX IF NOT EXISTS idx_epichust_api_keys_enabled ON epichust_api_keys(enabled);
CREATE INDEX IF NOT EXISTS idx_api_key_model_configs_key ON api_key_model_configs(api_key_id, enabled);
CREATE INDEX IF NOT EXISTS idx_api_key_model_routes_config ON api_key_model_routes(api_key_model_config_id, enabled);
CREATE INDEX IF NOT EXISTS idx_audit_logs_api_key_created_at ON audit_logs(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_epichust_created_at ON audit_logs(epichust_model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_provider_created_at ON audit_logs(provider_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
