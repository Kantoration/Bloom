-- GARF Production Database Schema
-- PostgreSQL 15+ with CITEXT extension for case-insensitive text

CREATE EXTENSION IF NOT EXISTS citext;

-- Participants table (users who fill out surveys)
CREATE TABLE participants (
  id            BIGSERIAL PRIMARY KEY,
  email         CITEXT UNIQUE,
  phone         TEXT,
  full_name     TEXT,
  locale        TEXT DEFAULT 'he',
  banned        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Versioned survey definitions (schema-driven forms)
CREATE TABLE surveys (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  version       INT  NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  schema_json   JSONB NOT NULL,   -- typed field meta-schema
  ui_config_json JSONB NOT NULL,  -- labels, order, RTL hints
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, version)
);

-- Raw survey responses (immutable exact payload)
CREATE TABLE responses (
  id            BIGSERIAL PRIMARY KEY,
  participant_id BIGINT REFERENCES participants(id) ON DELETE SET NULL,
  survey_id     BIGINT REFERENCES surveys(id) ON DELETE RESTRICT,
  status        TEXT NOT NULL DEFAULT 'submitted', -- draft|submitted
  raw_json      JSONB NOT NULL,
  user_agent    TEXT,
  ip_hash       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Derived features for the algorithm
CREATE TABLE features (
  id            BIGSERIAL PRIMARY KEY,
  response_id   BIGINT UNIQUE REFERENCES responses(id) ON DELETE CASCADE,
  numeric_json  JSONB NOT NULL,   -- scales as floats
  categorical_json JSONB NOT NULL,-- normalized + expanded sets
  nlp_features_json JSONB,        -- optional embeddings/topics
  age_band      TEXT,             -- 20s|30s|40s|50plus
  computed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Policy snapshots and runs
CREATE TABLE grouping_policies (
  id            BIGSERIAL PRIMARY KEY,
  survey_id     BIGINT REFERENCES surveys(id),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  rules_json    JSONB NOT NULL,   -- hard/soft constraints, tolerances
  weights_json  JSONB NOT NULL,   -- scoring weights
  normalization_json JSONB NOT NULL,  -- wildcard tokens & options
  subspace_json JSONB NOT NULL,   -- hierarchical subspace keys
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE grouping_runs (
  id            BIGSERIAL PRIMARY KEY,
  survey_id     BIGINT REFERENCES surveys(id),
  policy_json   JSONB NOT NULL,   -- frozen snapshot from grouping_policies
  status        TEXT NOT NULL,    -- queued|running|done|failed
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  error_text    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE groups (
  id            BIGSERIAL PRIMARY KEY,
  survey_id     BIGINT REFERENCES surveys(id),
  run_id        BIGINT REFERENCES grouping_runs(id),
  score         DOUBLE PRECISION,
  size          INT,
  explain_json  JSONB,            -- constraints & soft-score breakdown
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE group_members (
  group_id      BIGINT REFERENCES groups(id) ON DELETE CASCADE,
  participant_id BIGINT REFERENCES participants(id) ON DELETE CASCADE,
  role          TEXT,             -- host|icebreaker|friend etc.
  pair_id       BIGINT,           -- friend-pair linking if set
  PRIMARY KEY (group_id, participant_id)
);

CREATE TABLE admins (
  id            BIGSERIAL PRIMARY KEY,
  auth_provider TEXT NOT NULL,    -- github|google|passwordless
  subject       TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  actor_admin_id BIGINT REFERENCES admins(id),
  action        TEXT NOT NULL,
  payload_json  JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_responses_survey_id ON responses(survey_id);
CREATE INDEX idx_responses_participant_id ON responses(participant_id);
CREATE INDEX idx_features_response_id ON features(response_id);
CREATE INDEX idx_groups_run_id ON groups(run_id);
CREATE INDEX idx_group_members_participant_id ON group_members(participant_id);
CREATE INDEX idx_grouping_runs_survey_id ON grouping_runs(survey_id);
CREATE INDEX idx_grouping_runs_status ON grouping_runs(status);
CREATE INDEX idx_audit_logs_actor_admin_id ON audit_logs(actor_admin_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Useful views
CREATE VIEW v_active_surveys AS
SELECT id, name, version, schema_json, ui_config_json, created_at
FROM surveys
WHERE is_active = TRUE;

CREATE VIEW v_active_policies AS
SELECT id, survey_id, rules_json, weights_json, normalization_json, subspace_json, created_at
FROM grouping_policies
WHERE is_active = TRUE;

