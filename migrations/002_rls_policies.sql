-- Migration 002: Row Level Security policies
-- Reversible: Run down migration to revert

-- UP MIGRATION
BEGIN;

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- USERS: Users can read/update their own profile
CREATE POLICY users_select_own ON users FOR SELECT USING (id = current_user_id());
CREATE POLICY users_update_own ON users FOR UPDATE USING (id = current_user_id());

-- CALENDARS: Owner + editors + viewers can read
CREATE POLICY calendars_select_access ON calendars FOR SELECT USING (
    owner_id = current_user_id()
    OR EXISTS (
        SELECT 1 FROM calendar_shares cs
        WHERE cs.calendar_id = calendars.id
        AND cs.user_id = current_user_id()
        AND cs.revoked_at IS NULL
        AND cs.accepted_at IS NOT NULL
    )
    OR deleted_at IS NOT NULL  -- Allow reading deleted for sync
);

-- CALENDARS: Only owner can insert/update/delete
CREATE POLICY calendars_insert_owner ON calendars FOR INSERT WITH CHECK (owner_id = current_user_id());
CREATE POLICY calendars_update_owner ON calendars FOR UPDATE USING (owner_id = current_user_id());
CREATE POLICY calendars_delete_owner ON calendars FOR DELETE USING (owner_id = current_user_id());

-- CALENDAR_SHARES: Owner manages shares, users see their own shares
CREATE POLICY shares_select_involved ON calendar_shares FOR SELECT USING (
    user_id = current_user_id()
    OR EXISTS (
        SELECT 1 FROM calendars c
        WHERE c.id = calendar_shares.calendar_id
        AND c.owner_id = current_user_id()
    )
);

CREATE POLICY shares_insert_owner ON calendar_shares FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM calendars c
        WHERE c.id = calendar_shares.calendar_id
        AND c.owner_id = current_user_id()
    )
    AND invited_by = current_user_id()
);

CREATE POLICY shares_update_owner ON calendar_shares FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM calendars c
        WHERE c.id = calendar_shares.calendar_id
        AND c.owner_id = current_user_id()
    )
);

CREATE POLICY shares_delete_owner ON calendar_shares FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM calendars c
        WHERE c.id = calendar_shares.calendar_id
        AND c.owner_id = current_user_id()
    )
);

-- TASKS: Read access = calendar read access
CREATE POLICY tasks_select_access ON tasks FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM calendars c
        WHERE c.id = tasks.calendar_id
        AND (
            c.owner_id = current_user_id()
            OR EXISTS (
                SELECT 1 FROM calendar_shares cs
                WHERE cs.calendar_id = c.id
                AND cs.user_id = current_user_id()
                AND cs.revoked_at IS NULL
                AND cs.accepted_at IS NOT NULL
            )
        )
    )
    OR deleted_at IS NOT NULL
);

-- TASKS: Insert = editor or owner
CREATE POLICY tasks_insert_editor ON tasks FOR INSERT WITH CHECK (
    user_id = current_user_id()
    AND EXISTS (
        SELECT 1 FROM calendars c
        WHERE c.id = tasks.calendar_id
        AND (
            c.owner_id = current_user_id()
            OR EXISTS (
                SELECT 1 FROM calendar_shares cs
                WHERE cs.calendar_id = c.id
                AND cs.user_id = current_user_id()
                AND cs.role = 'editor'
                AND cs.revoked_at IS NULL
                AND cs.accepted_at IS NOT NULL
            )
        )
    )
);

-- TASKS: Update = editor or owner (on calendar)
CREATE POLICY tasks_update_editor ON tasks FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM calendars c
        WHERE c.id = tasks.calendar_id
        AND (
            c.owner_id = current_user_id()
            OR EXISTS (
                SELECT 1 FROM calendar_shares cs
                WHERE cs.calendar_id = c.id
                AND cs.user_id = current_user_id()
                AND cs.role = 'editor'
                AND cs.revoked_at IS NULL
                AND cs.accepted_at IS NOT NULL
            )
        )
    )
);

-- TASKS: Delete = editor or owner
CREATE POLICY tasks_delete_editor ON tasks FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM calendars c
        WHERE c.id = tasks.calendar_id
        AND (
            c.owner_id = current_user_id()
            OR EXISTS (
                SELECT 1 FROM calendar_shares cs
                WHERE cs.calendar_id = c.id
                AND cs.user_id = current_user_id()
                AND cs.role = 'editor'
                AND cs.revoked_at IS NULL
                AND cs.accepted_at IS NOT NULL
            )
        )
    )
);

-- Helper function for current user ID (set by auth middleware)
CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
    SELECT current_setting('app.current_user_id', true)::UUID;
$$ LANGUAGE sql STABLE;

COMMIT;

-- DOWN MIGRATION
-- BEGIN;
-- DROP POLICY IF EXISTS users_select_own ON users;
-- DROP POLICY IF EXISTS users_update_own ON users;
-- DROP POLICY IF EXISTS calendars_select_access ON calendars;
-- DROP POLICY IF EXISTS calendars_insert_owner ON calendars;
-- DROP POLICY IF EXISTS calendars_update_owner ON calendars;
-- DROP POLICY IF EXISTS calendars_delete_owner ON calendars;
-- DROP POLICY IF EXISTS shares_select_involved ON calendar_shares;
-- DROP POLICY IF EXISTS shares_insert_owner ON calendar_shares;
-- DROP POLICY IF EXISTS shares_update_owner ON calendar_shares;
-- DROP POLICY IF EXISTS shares_delete_owner ON calendar_shares;
-- DROP POLICY IF EXISTS tasks_select_access ON tasks;
-- DROP POLICY IF EXISTS tasks_insert_editor ON tasks;
-- DROP POLICY IF EXISTS tasks_update_editor ON tasks;
-- DROP POLICY IF EXISTS tasks_delete_editor ON tasks;
-- DROP FUNCTION IF EXISTS current_user_id();
-- ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE calendar_shares DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE calendars DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE users DISABLE ROW LEVEL SECURITY;
-- COMMIT;