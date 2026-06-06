DO $$
DECLARE
    mapping_policies_exists boolean;
    usage_limit_col_exists boolean;
    rate_limit_rules_exists boolean;
BEGIN
    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'mapping_policies'
    ) INTO mapping_policies_exists;

    SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'mapping_policies' AND column_name = 'usage_limit_type'
    ) INTO usage_limit_col_exists;

    SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'rate_limit_rules'
    ) INTO rate_limit_rules_exists;

    IF mapping_policies_exists AND NOT rate_limit_rules_exists THEN

        -- 1. Create the rate_limit_rules table
        CREATE TABLE rate_limit_rules (
            id TEXT PRIMARY KEY,
            mapping_policy_id TEXT NOT NULL
                REFERENCES mapping_policies(id) ON DELETE CASCADE,
            limit_type TEXT NOT NULL
                CHECK (limit_type IN (
                    'requests_per_minute', 'requests_per_day',
                    'tokens_per_minute', 'tokens_per_day'
                )),
            limit_value INTEGER NOT NULL CHECK (limit_value > 0),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (mapping_policy_id, limit_type)
        );

        -- 2. Migrate existing usage_limit data into rate_limit_rules
        INSERT INTO rate_limit_rules (
            id, mapping_policy_id, limit_type, limit_value
        )
        SELECT
            gen_random_uuid()::text,
            id,
            usage_limit_type,
            usage_limit_value
        FROM mapping_policies
        WHERE usage_limit_type IS NOT NULL AND usage_limit_value IS NOT NULL
        ON CONFLICT (mapping_policy_id, limit_type) DO NOTHING;

        -- 3. Drop the old columns from mapping_policies
        ALTER TABLE mapping_policies DROP COLUMN IF EXISTS usage_limit_value;
        ALTER TABLE mapping_policies DROP COLUMN IF EXISTS usage_limit_type;

        -- 4. Create indexes
        CREATE INDEX IF NOT EXISTS idx_rate_limit_rules_policy
            ON rate_limit_rules(mapping_policy_id);
        CREATE INDEX IF NOT EXISTS idx_rate_limit_rules_type
            ON rate_limit_rules(limit_type);

    END IF;
END $$;
