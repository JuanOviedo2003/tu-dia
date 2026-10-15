# Database Design Report - Task T2

## Summary
Complete relational schema for tu-dia: calendar with daily tasks + Kanban board (todo/in-progress/done), calendar sharing with view/edit permissions, real-time multi-device sync with offline-first support.

## Files Created

### 1. `001_initial_schema.sql`
Core tables:
- **users** - Authentication profile
- **calendars** - Owned calendars with soft delete, versioning
- **calendar_shares** - Invitations + permissions (viewer/editor), acceptance workflow
- **tasks** - Daily tasks with Kanban state, position ordering, subtasks, offline sync fields

Indexes (8 total) optimized for:
- Daily view queries (calendar_id + day_date)
- Kanban board (calendar_id + kanban_state + day_date)
- User's tasks across calendars
- Offline sync deduplication (client_id)
- Incremental sync cursor (synced_at)

Triggers: auto-updated `updated_at` on all tables

### 2. `002_rls_policies.sql`
Row Level Security enforcing:
- Owners: full CRUD on calendars + shares
- Editors: CRUD tasks, read calendar
- Viewers: read-only
- Users: own profile + sync metadata

Helper function `current_user_id()` reads from `app.current_user_id` session variable (set by auth middleware).

### 3. `003_sync_metadata.sql`
Offline-first sync infrastructure:
- **sync_states** - Per-client per-calendar sync cursor + pending changes queue
- **version_vectors** - Per-entity version vectors for conflict detection
- **sync_log** - Audit trail for debugging

### 4. `ER_DIAGRAM.md`
Mermaid ER diagram with relationship details, Kanban state machine, sync fields, access control rules.

### 5. `INDEX_DECISIONS.md`
Detailed index rationale, cardinality estimates, sync cursor patterns, future candidates.

## Reversibility
Each migration includes a commented DOWN section that:
- Drops policies before tables
- Drops triggers before functions
- Drops indexes before tables
- Order respects foreign key dependencies

Run with: `psql -f 001_initial_schema.sql` (up), then manually run DOWN section to revert.

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| UUID PKs | Distributed ID generation, no coordination |
| Soft deletes | Sync deletions to offline clients |
| Version column | Optimistic locking for concurrent edits |
| client_id on tasks | Client-generated ID for deduplication |
| synced_at timestamp | Incremental pull sync cursor |
| Partial indexes | Exclude soft-deleted rows, sparse client_id |
| RLS at database layer | Defense in depth, works with any client |
| Separate sync_states table | Multiple devices per user, per-calendar cursors |
| Version vectors | Detect concurrent edits across devices |

## Offline-First Sync Flow

**Push (client → server):**
1. Client sends pending changes with `client_id` and local `version`
2. Server upserts by `client_id` (new) or `id` (existing)
3. Server increments `version`, sets `synced_at = now()`
4. Server returns new server version

**Pull (server → client):**
1. Client sends `last_synced_at` from `sync_states`
2. Server returns tasks WHERE `synced_at > last_synced_at`
3. Client applies, updates local `synced_at`

**Conflict Resolution:**
- Version vector mismatch → last-write-wins (server version wins)
- Client retries with server version
- `sync_log` records conflicts for audit

## Estimated Scale
- 10k users, 50k calendars, 2M tasks
- Index size: ~410 MB
- All queries use indexed paths
- Connection pooling recommended (PgBouncer)