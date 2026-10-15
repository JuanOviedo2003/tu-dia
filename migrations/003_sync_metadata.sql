-- Migration 003: Sync metadata for offline-first
-- Reversible: Run down migration to revert

-- UP MIGRATION
BEGIN;

-- Sync state per client per calendar
CREATE TABLE sync_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
    client_id VARCHAR(100) NOT NULL,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_server_version BIGINT NOT NULL DEFAULT 0,
    pending_changes JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, calendar_id, client_id)
);

-- Version vectors for conflict detection (per entity)
CREATE TABLE version_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('calendar', 'task')),
    entity_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id VARCHAR(100) NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (entity_type, entity_id, user_id, client_id)
);

-- Sync log for debugging/audit
CREATE TABLE sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    calendar_id UUID REFERENCES calendars(id) ON DELETE SET NULL,
    client_id VARCHAR(100) NOT NULL,
    operation VARCHAR(20) NOT NULL CHECK (operation IN ('pull', 'push', 'conflict', 'error')),
    entity_type VARCHAR(20),
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for sync
CREATE INDEX idx_sync_states_user_calendar ON sync_states(user_id, calendar_id);
CREATE INDEX idx_sync_states_client ON sync_states(client_id);
CREATE INDEX idx_version_vectors_entity ON version_vectors(entity_type, entity_id);
CREATE INDEX idx_version_vectors_user_client ON version_vectors(user_id, client_id);
CREATE INDEX idx_sync_log_user_time ON sync_log(user_id, created_at DESC);
CREATE INDEX idx_sync_log_calendar_time ON sync_log(calendar_id, created_at DESC);

-- Trigger for sync_states updated_at
CREATE TRIGGER update_sync_states_updated_at BEFORE UPDATE ON sync_states FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS for sync tables
ALTER TABLE sync_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE version_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY sync_states_own ON sync_states FOR ALL USING (user_id = current_user_id());
CREATE POLICY version_vectors_own ON version_vectors FOR ALL USING (user_id = current_user_id());
CREATE POLICY sync_log_own ON sync_log FOR SELECT USING (user_id = current_user_id());

COMMIT;

-- DOWN MIGRATION
-- BEGIN;
-- DROP POLICY IF EXISTS sync_log_own ON sync_log;
-- DROP POLICY IF EXISTS version_vectors_own ON version_vectors;
-- DROP POLICY IF EXISTS sync_states_own ON sync_states;
-- DROP TRIGGER IF EXISTS update_sync_states_updated_at ON sync_states;
-- DROP INDEX IF EXISTS idx_sync_log_calendar_time;
-- DROP INDEX IF EXISTS idx_sync_log_user_time;
-- DROP INDEX IF EXISTS idx_version_vectors_user_client;
-- DROP INDEX IF EXISTS idx_version_vectors_entity;
-- DROP INDEX IF EXISTS idx_sync_states_client;
-- DROP INDEX IF EXISTS idx_sync_states_user_calendar;
-- DROP TABLE IF EXISTS sync_log;
-- DROP TABLE IF EXISTS version_vectors;
-- DROP TABLE IF EXISTS sync_states;
-- COMMIT;