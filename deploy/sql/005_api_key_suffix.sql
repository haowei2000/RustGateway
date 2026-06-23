-- Store the last 4 plaintext characters of an API key as a non-secret hint,
-- so the UI can persistently show which key is which (e.g. "llmgw…d36e").
-- Existing rows stay NULL until the key is next created/rotated.
ALTER TABLE epichust_api_keys ADD COLUMN IF NOT EXISTS key_suffix VARCHAR(8);
