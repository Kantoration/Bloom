# Specification: Grouping Run Workflow

## Goal
As an admin, I want to run the grouping engine via the Lovable dashboard so that:
- Participants are grouped optimally based on kosher, age, and diet rules.
- The run results are persisted in Supabase (runs, groups, members, unassigned).
- Diagnostics (scores, allergy breakdown, age distribution) are visible in Lovable.

## Requirements
1. **Trigger**: A "Run Grouping" action in Lovable that calls `POST /build-groups`.
2. **Engine**: Uses `runGrouping(participants, options)` from `groupingEngineEnhanced.ts`.
3. **Persistence**: Saves results in Supabase (`runs`, `groups`, `group_members`, `unassigned_queue`).
4. **UI**: Lovable auto-dashboards show runs history, groups, and unassigned queue.
5. **Security**: Ensure only authenticated admins can trigger runs.

## Constraints
- Min group size = 4, target = 6, fallback = 5.
- Kosher-only and age band rules must always apply.
- Max 3 severe allergies per group.

## Success Criteria
- A run can be triggered end-to-end through Lovable.
- Groups are saved in Supabase and visible in the dashboard.
- Diagnostics summary is displayed automatically in Lovable views.