-- Migration 001: Initial schema for tu-dia calendar + Kanban
-- Reversible: Run down migration to revert

-- UP MIGRATION
BEGIN;

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Calendars table
CREATE TABLE calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#3B82F6',
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 1
);

-- Calendar shares (invitations + permissions)
CREATE TABLE calendar_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('viewer', 'editor')),
    invited_by UUID NOT NULL REFERENCES users(id),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    UNIQUE (calendar_id, user_id)
);

-- Tasks table with Kanban states
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    kanban_state VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (kanban_state IN ('todo', 'in_progress', 'done')),
    day_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    all_day BOOLEAN NOT NULL DEFAULT false,
    position INTEGER NOT NULL DEFAULT 0,
    parent_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 1,
    client_id VARCHAR(100),
    synced_at TIMESTAMPTZ
);

-- Indexes for offline-first sync and common queries
CREATE INDEX idx_tasks_calendar_day ON tasks(calendar_id, day_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_calendar_kanban ON tasks(calendar_id, kanban_state, day_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_user_calendar ON tasks(user_id, calendar_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_tasks_client_id ON tasks(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX idx_tasks_synced_at ON tasks(synced_at) WHERE synced_at IS NOT NULL;
CREATE INDEX idx_calendars_owner ON calendars(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_calendar_shares_user ON calendar_shares(user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_calendar_shares_calendar ON calendar_shares(calendar_id) WHERE revoked_at IS NULL;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_calendars_updated_at BEFORE UPDATE ON calendars FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- DOWN MIGRATION (revert)
-- BEGIN;
-- DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
-- DROP TRIGGER IF EXISTS update_calendars_updated_at ON calendars;
-- DROP TRIGGER IF EXISTS update_users_updated_at ON users;
-- DROP FUNCTION IF EXISTS update_updated_at_column();
-- DROP INDEX IF EXISTS idx_tasks_synced_at;
-- DROP INDEX IF EXISTS idx_tasks_client_id;
-- DROP INDEX IF EXISTS idx_tasks_user_calendar;
-- DROP INDEX IF EXISTS idx_tasks_calendar_kanban;
-- DROP INDEX IF EXISTS idx_tasks_calendar_day;
-- DROP INDEX IF EXISTS idx_calendar_shares_calendar;
-- DROP INDEX IF EXISTS idx_calendar_shares_user;
-- DROP INDEX IF EXISTS idx_calendars_owner;
-- DROP TABLE IF EXISTS tasks;
-- DROP TABLE IF EXISTS calendar_shares;
-- DROP TABLE IF EXISTS calendars;
-- DROP TABLE IF EXISTS users;
-- COMMIT;