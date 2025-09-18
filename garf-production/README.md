# 🌟 GARF - Intelligent Group Formation System (TypeScript + Supabase)

GARF turns survey responses into optimal discussion groups. The stack is fully TypeScript: a Node/Fastify API, a modular grouping engine, a Next.js frontend, Supabase for persistence, and Lovable for admin dashboards. Python/Docker have been removed.

## 🎯 Goals
- Admin-controllable grouping via policies stored in Supabase.
- Deterministic, explainable grouping with diagnostics and scoring.
- Simple operation: run locally with npm, manage data via Lovable.

## 🏗️ Architecture Overview
```
[Next.js Frontend] ──calls──> [Fastify API server.ts]
       ▲                               │
       │ Lovable actions/dashboards     │ Supabase JS client
       │                                ▼
 [Lovable UI] ───────────────> [repo.ts ↔ Supabase (schema.sql)]
                                    │
                                    ▼
                         [groupingEngine*.ts core logic]
```

## 📁 Project Structure
```
garf-production/
  server.ts                 Fastify API endpoints
  repo.ts                   Supabase repository (participants, runs, groups, policies)
  schema.sql                Supabase schema (tables, views, RLS, triggers)
  lovable-config.json       Lovable dashboards, tables, and actions
  groupingEngine*.ts        Grouping algorithm (core/impl/enhanced)
  ageBands.ts, dietRules.ts Domain rules & helpers
  scoring.ts                Score calculation helpers
  types.ts                  Algorithm and domain types
  types-enhanced.ts         Run options/results/diagnostics types
  frontend/                 Next.js app (survey UI + simple admin)
  tests/                    Jest unit+integration tests
  scripts/, specs/, *.ps1   Spec Kit and dev helpers
```

## 🗄️ Data Model (Supabase)
Tables in `schema.sql`:
- `participants(id, name, email, age, kosher, responses, …)`
- `runs(id, created_at, options, summary, status, policy_id)`
- `groups(id, run_id, score, size, metadata)`
- `group_members(id, group_id, participant_id, role)`
- `unassigned_queue(id, run_id, participant_id, reason, details)`
- `grouping_policies(id, name, kosher_only, min_group_size, target_group_size, max_allergy_count, age_policy, scoring_weights, created_at, is_active)`

Views and functions for dashboards:
- `run_statistics`, `group_details`, `participant_groups`, `unassigned_summary`
- RLS policies enable read for authenticated users and writes for admin/service role.
- Trigger `enforce_single_active_policy()` keeps one active policy.

## 🧠 Grouping Policies & Engine
Policy fields map to engine `RunOptions`:
- `kosher_only` → `kosherOnly`
- `min_group_size`, `target_group_size` → `minGroupSize`, `targetGroupSize`
- `max_allergy_count` → used in engine allergy checks
- `age_policy` → `'banded' | 'loose'` handling for age constraints
- `scoring_weights` → weights to tune final score

Engine modules:
- `groupingEngineImpl.ts`: Core building loop, pairing/compatibility checks, and scoring.
- `groupingEngineEnhanced.ts`: Adds diagnostics, summaries, and options handling.
- `ageBands.ts`: Age band definitions and utilities (banded policy).
- `dietRules.ts`: Kosher/other diet compatibility helpers.
- `scoring.ts`: Aggregates penalties/bonuses (size, homogeneity/diversity, constraints).

Method highlights:
- Hard rules: kosher-only, allergy cap, essential incompatibilities.
- Age handling: banded (strict bands) or loose (tolerance-based).
- Builder phases: open expansion then finalize; tries to reach `targetGroupSize` while respecting `minGroupSize`.
- Diagnostics: distributions, unassigned reasons, explanations per group.

## 🔌 API (server.ts)
Endpoints (JSON):
- `POST /build-groups`
  - Body: `{ policy_id?: string, options?: RunOptions }`
  - Uses explicit policy if provided else the active policy. Runs engine, persists full run, returns summary and diagnostics.
- `GET /runs` — list run summaries (with policy context).
- `GET /runs/:id` — full run with groups/members and statistics.
- `GET /runs/:id/stats` — analytics for a run.
- `DELETE /runs/:id` — delete a run (cascades to groups/members/unassigned).

## 🗂️ Repository (repo.ts)
- `fetchParticipants()` — load participants and normalize to engine format.
- `saveRun(run, policyId)` — persist run, groups, members, and unassigned.
- `getRun(runId)` / `listRuns()` — retrieve runs with policy info.
- `fetchActivePolicy()` / `fetchPolicyById(id)` — policy selection.
- `updateRunStatus()` — track run lifecycle.

## 🧭 Lovable (lovable-config.json)
- Tables: participants, runs (joined to policies), groups, group_members, unassigned_queue.
- Dashboard: Overview, Runs, Groups, Participants, Unassigned, Policies.
- Actions: “Run Grouping” form includes `policy_id` dropdown; triggers `/build-groups`.

## 🖥️ Frontend (frontend/)
- Next.js app with admin overview and a simple survey flow.
- Uses `src/lib/api.ts` to call API; Tailwind for styling.

## 🧪 Testing (tests/)
- `engine.unit.test.ts` — engine unit coverage.
- `repo.integration.test.ts` — Supabase persistence integration.
- `policy.integration.test.ts` — policy selection (active/explicit) and `runs.policy_id` persistence.

## ⚙️ Setup & Run
1) Install
```bash
cd garf-production
npm install
```
2) Supabase
```bash
cp env.template .env
# Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# Apply schema: open Supabase SQL editor and paste contents of schema.sql
```
3) Dev
```bash
npm run dev     # runs API and Web together (concurrently)
```
4) Test
```bash
npm test
```

Useful scripts:
```bash
npm run dev:api   # API only (Fastify)
npm run dev:web   # Frontend only (Next.js)
npm run build     # TypeScript build (API)
npm start         # Run compiled API server
```

## 🔐 Security
- RLS policies in `schema.sql` restrict writes to admin/service role.
- API CORS configured for Lovable.
- Avoid exposing service role keys to the browser; keep them server-side.

## 🛟 Troubleshooting
- “No participants found” on /build-groups: insert participants into `participants`.
- “No active policy found”: create a policy in Lovable and toggle `is_active`.
- Policy overrides: pass `options` in request body to temporarily override policy fields.
- Missing dashboards: ensure `lovable-config.json` is loaded by Lovable.

## 🔄 Migration Notes
- Legacy Python (FastAPI), worker, and Docker/infra were removed.
- Email verification flows are out-of-scope for this repo.
- Use Supabase (`schema.sql`) + Lovable for admin and data management.

---

Built with ❤️ for intelligent group formation.


