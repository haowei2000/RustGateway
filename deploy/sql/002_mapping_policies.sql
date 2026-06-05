DO $$
DECLARE
    old_model_mappings_exists boolean;
    new_mapping_policies_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'model_mappings'
    ) INTO old_model_mappings_exists;

    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'mapping_policies'
    ) INTO new_mapping_policies_exists;

    IF old_model_mappings_exists AND NOT new_mapping_policies_exists THEN

        -- 1. Create new tables
        CREATE TABLE mapping_policies (
            id TEXT PRIMARY KEY,
            epichust_model_id TEXT NOT NULL REFERENCES epichust_models(id) ON DELETE CASCADE,
            routing_strategy TEXT NOT NULL DEFAULT 'weighted'
                CHECK (routing_strategy IN ('weighted', 'priority', 'round_robin')),
            usage_limit_type TEXT
                CHECK (usage_limit_type IN (
                    'requests_per_minute', 'requests_per_day',
                    'tokens_per_minute', 'tokens_per_day'
                )),
            usage_limit_value INTEGER
                CHECK (usage_limit_value IS NULL OR usage_limit_value > 0),
            enabled BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE TABLE mapping_policy_routes (
            mapping_policy_id TEXT NOT NULL
                REFERENCES mapping_policies(id) ON DELETE CASCADE,
            provider_model_id TEXT NOT NULL
                REFERENCES provider_models(id) ON DELETE CASCADE,
            weight INTEGER NOT NULL DEFAULT 100 CHECK (weight >= 0),
            priority INTEGER NOT NULL DEFAULT 100 CHECK (priority >= 0),
            enabled BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (mapping_policy_id, provider_model_id)
        );

        CREATE TABLE api_key_mapping_policies (
            api_key_id TEXT NOT NULL
                REFERENCES epichust_api_keys(id) ON DELETE CASCADE,
            mapping_policy_id TEXT NOT NULL
                REFERENCES mapping_policies(id) ON DELETE CASCADE,
            enabled BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (api_key_id, mapping_policy_id)
        );

        -- 2. Migrate api_key_model_configs → mapping_policies
        INSERT INTO mapping_policies (
            id, epichust_model_id, routing_strategy, enabled, created_at, updated_at
        )
        SELECT
            akc.id,
            akc.epichust_model_id,
            CASE
                WHEN akc.routing_strategy = 'priority' THEN 'priority'
                ELSE 'weighted'
            END,
            akc.enabled,
            akc.created_at,
            akc.updated_at
        FROM api_key_model_configs akc;

        -- 3. Migrate api_key_model_routes → mapping_policy_routes
        --    (resolve provider_model_id from model_mappings)
        INSERT INTO mapping_policy_routes (
            mapping_policy_id, provider_model_id, weight, priority, enabled, created_at
        )
        SELECT
            akr.api_key_model_config_id,
            mm.provider_model_id,
            akr.weight,
            akr.priority,
            akr.enabled,
            akr.created_at
        FROM api_key_model_routes akr
        JOIN model_mappings mm ON mm.id = akr.model_mapping_id
        ON CONFLICT (mapping_policy_id, provider_model_id) DO NOTHING;

        -- 4. Create api_key_mapping_policies link rows
        INSERT INTO api_key_mapping_policies (
            api_key_id, mapping_policy_id, enabled, created_at
        )
        SELECT
            akc.api_key_id,
            akc.id,
            akc.enabled,
            akc.created_at
        FROM api_key_model_configs akc;

        -- 5. Migrate orphan model_mappings (not referenced by any api_key_model_route)
        INSERT INTO mapping_policies (
            id, epichust_model_id, routing_strategy, enabled, created_at, updated_at
        )
        SELECT
            mm.id,
            mm.epichust_model_id,
            'weighted',
            mm.enabled,
            mm.created_at,
            mm.updated_at
        FROM model_mappings mm
        WHERE mm.id NOT IN (
            SELECT DISTINCT akr.model_mapping_id
            FROM api_key_model_routes akr
        )
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO mapping_policy_routes (
            mapping_policy_id, provider_model_id, weight, priority, enabled, created_at
        )
        SELECT
            mm.id,
            mm.provider_model_id,
            100,
            100,
            mm.enabled,
            mm.created_at
        FROM model_mappings mm
        WHERE mm.id NOT IN (
            SELECT DISTINCT akr.model_mapping_id
            FROM api_key_model_routes akr
        )
        ON CONFLICT (mapping_policy_id, provider_model_id) DO NOTHING;

        -- 6. Create indexes
        CREATE INDEX IF NOT EXISTS idx_mapping_policies_epichust
            ON mapping_policies(epichust_model_id, enabled);
        CREATE INDEX IF NOT EXISTS idx_mapping_policy_routes_policy
            ON mapping_policy_routes(mapping_policy_id, enabled);
        CREATE INDEX IF NOT EXISTS idx_mapping_policy_routes_provider
            ON mapping_policy_routes(provider_model_id, enabled);
        CREATE INDEX IF NOT EXISTS idx_api_key_mapping_policies_key
            ON api_key_mapping_policies(api_key_id, enabled);
        CREATE INDEX IF NOT EXISTS idx_api_key_mapping_policies_policy
            ON api_key_mapping_policies(mapping_policy_id, enabled);

        -- 7. Drop old tables
        DROP TABLE IF EXISTS api_key_model_routes CASCADE;
        DROP TABLE IF EXISTS api_key_model_configs CASCADE;
        DROP TABLE IF EXISTS model_mappings CASCADE;

    END IF;
END $$;
