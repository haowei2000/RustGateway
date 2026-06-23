-- audit_logs foreign keys were created with the default ON DELETE NO ACTION,
-- which makes deleting any api key / provider / model that already has audit
-- rows fail with a foreign-key violation. Audit history should outlive the
-- referenced entities, so switch these FKs to ON DELETE SET NULL.
-- Idempotent: only rewrites a constraint that is still NO ACTION ('a').
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint
               WHERE conname = 'audit_logs_api_key_id_fkey' AND confdeltype = 'a') THEN
        ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_api_key_id_fkey;
        ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_api_key_id_fkey
            FOREIGN KEY (api_key_id) REFERENCES epichust_api_keys(id) ON DELETE SET NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint
               WHERE conname = 'audit_logs_epichust_model_id_fkey' AND confdeltype = 'a') THEN
        ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_epichust_model_id_fkey;
        ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_epichust_model_id_fkey
            FOREIGN KEY (epichust_model_id) REFERENCES epichust_models(id) ON DELETE SET NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint
               WHERE conname = 'audit_logs_provider_id_fkey' AND confdeltype = 'a') THEN
        ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_provider_id_fkey;
        ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_provider_id_fkey
            FOREIGN KEY (provider_id) REFERENCES providers(id) ON DELETE SET NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_constraint
               WHERE conname = 'audit_logs_provider_model_id_fkey' AND confdeltype = 'a') THEN
        ALTER TABLE audit_logs DROP CONSTRAINT audit_logs_provider_model_id_fkey;
        ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_provider_model_id_fkey
            FOREIGN KEY (provider_model_id) REFERENCES provider_models(id) ON DELETE SET NULL;
    END IF;
END $$;
