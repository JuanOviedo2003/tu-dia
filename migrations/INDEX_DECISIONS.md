# Database Index Decisions for tu-dia

## Offline-First Sync Requirements
- Clients modify data offline, sync when online
- Conflict resolution: last-write-wins with version vectors
- Incremental sync via `synced_at` timestamp
- Client-generated IDs (`client_id`) for deduplication

## Index Strategy

### 1. `idx_tasks_calendar_day` (calendar_id, day_date) WHERE deleted_at IS NULL
**Purpose**: Primary query - fetch all tasks for a calendar on a specific day
**Used by**: Daily view, Kanban board per day
**Cardinality**: High (tasks per day ~10-50)
**Partial index**: Excludes soft-deleted tasks

### 2. `idx_tasks_calendar_kanban` (calendar_id, kanban_state, day_date) WHERE deleted_at IS NULL
**Purpose**: Kanban board queries - group by state within a day
**Used by**: Drag-drop reordering, state transitions
**Column order**: calendar_id first (filter), then kanban_state (group), day_date (range)

### 3. `idx_tasks_user_calendar` (user_id, calendar_id) WHERE deleted_at IS NULL
**Purpose**: User's tasks across calendars, permission checks
**Used by**: "My tasks" view, access control verification

### 4. `idx_tasks_client_id` (client_id) WHERE client_id IS NOT NULL
**Purpose**: Deduplication during sync - find server task by client ID
**Used by**: Sync engine upsert logic
**Sparse index**: Only tasks with client_id (new offline tasks)

### 5. `idx_tasks_synced_at` (synced_at) WHERE synced_at IS NOT NULL
**Purpose**: Incremental sync - find tasks modified since last sync
**Used by**: Pull sync cursor
**Maintenance**: Updated on every task change

### 6. `idx_calendars_owner` (owner_id) WHERE deleted_at IS NULL
**Purpose**: List user's owned calendars
**Used by**: Calendar picker, settings

### 7. `idx_calendar_shares_user` (user_id) WHERE revoked_at IS NULL
**Purpose**: List calendars shared with user
**Used by**: "Shared with me" view

### 8. `idx_calendar_shares_calendar` (calendar_id) WHERE revoked_at IS NULL
**Purpose**: List collaborators on a calendar
**Used by**: Share management UI, permission checks

## Version Column
- `version BIGINT` on calendars and tasks for optimistic locking
- Incremented on every update
- Prevents lost updates in concurrent edits

## Soft Deletes
- `deleted_at TIMESTAMPTZ` instead of hard deletes
- Enables sync of deletions to offline clients
- Partial indexes exclude deleted rows
- Cleanup job can hard-delete after 30 days

## Composite Index Considerations
- No index on (calendar_id, user_id) - covered by calendar_shares join
- No index on kanban_state alone - low selectivity
- Position column not indexed - reordering updates entire day's tasks anyway

## Sync Cursor Pattern
```sql
-- Pull changes since last sync
SELECT * FROM tasks 
WHERE calendar_id = $1 
  AND synced_at > $2 
  AND deleted_at IS NULL
ORDER BY synced_at ASC;
```

## Estimated Index Size (10k users, 50k calendars, 2M tasks)
- idx_tasks_calendar_day: ~120 MB
- idx_tasks_calendar_kanban: ~140 MB  
- idx_tasks_user_calendar: ~80 MB
- idx_tasks_client_id: ~10 MB (sparse)
- idx_tasks_synced_at: ~60 MB
- Total: ~410 MB (acceptable for PostgreSQL)

## Future Index Candidates (monitor query plans)
- (calendar_id, created_at) for "recent tasks" feed
- (user_id, day_date) for personal daily view
- Partial index on tasks WHERE kanban_state != 'done' for active boards