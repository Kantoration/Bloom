# Specification: Grouping Run Workflow

## Goal
As an admin, I want to run the grouping engine via the Lovable dashboard so that:
- Participants are grouped optimally based on kosher, age, and diet rules.
- The run results are persisted in Supabase (runs, groups, members, unassigned).
- Diagnostics (scores, allergy breakdown, age distribution) are visible in Lovable.
- Every run is tied to a grouping policy for parameter control.

## Requirements
1. **Trigger**: A "Run Grouping" action in Lovable that calls `POST /build-groups`.
2. **Engine**: Uses `runGrouping(participants, options)` from `groupingEngineEnhanced.ts`.
3. **Persistence**: Saves results in Supabase (`runs`, `groups`, `group_members`, `unassigned_queue`).
4. **UI**: Lovable auto-dashboards show runs history, groups, and unassigned queue.
5. **Security**: Ensure only authenticated admins can trigger runs.
6. **Policy Integration**: Every run must be associated with a grouping policy.

## Policy System
- **Grouping Policies**: Admin-configurable parameters stored in `grouping_policies` table
- **Policy Parameters**: kosher_only, min_group_size, target_group_size, max_allergy_count, age_policy, scoring_weights
- **Active Policy**: Only one policy can be active at a time (enforced by database trigger)
- **Run Association**: Each run is linked to a policy via `policy_id` foreign key
- **Policy Override**: Optional parameter overrides can be passed during run execution

## Database Schema
```sql
-- Grouping policies table
CREATE TABLE grouping_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  kosher_only BOOLEAN DEFAULT FALSE,
  min_group_size INT DEFAULT 4,
  target_group_size INT DEFAULT 6,
  max_allergy_count INT DEFAULT 3,
  age_policy TEXT DEFAULT 'banded', -- 'banded' or 'loose'
  scoring_weights JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT FALSE
);

-- Policy enforcement trigger
CREATE TRIGGER single_active_policy_trigger
BEFORE INSERT OR UPDATE ON grouping_policies
FOR EACH ROW EXECUTE FUNCTION enforce_single_active_policy();

-- Link runs to policies
ALTER TABLE runs ADD COLUMN policy_id UUID REFERENCES grouping_policies(id);
```

## API Endpoints
- `POST /build-groups` - Accepts optional `policy_id` and `options` overrides
- `GET /grouping/policies` - List all policies
- `POST /grouping/policies` - Create new policy
- `PUT /grouping/policies/:id` - Update policy
- `DELETE /grouping/policies/:id` - Delete policy

## Lovable Integration
- **Grouping Policies Dashboard**: CRUD interface for managing policies
- **Runs Dashboard**: Shows policy association and policy name
- **Run Grouping Action**: Form with policy selection dropdown and parameter overrides

## Constraints
- Min group size = 4, target = 6, fallback = 5 (configurable per policy)
- Kosher-only and age band rules must always apply (configurable per policy)
- Max 3 severe allergies per group (configurable per policy)
- Only one active policy at a time

## Success Criteria
- A run can be triggered end-to-end through Lovable with policy selection
- Groups are saved in Supabase and visible in the dashboard
- Diagnostics summary is displayed automatically in Lovable views
- Policy parameters are correctly applied to grouping runs
- Run history shows which policy was used for each run