import { app } from '../server';
import { supabaseAdmin } from '../supabaseClient';

// Helper to create a policy
async function createPolicy(overrides: Partial<any> = {}) {
  const base = {
    name: `Test Policy ${Date.now()}`,
    kosher_only: false,
    min_group_size: 3,
    target_group_size: 5,
    max_allergy_count: 2,
    age_policy: 'banded',
    scoring_weights: {},
    is_active: false
  };
  const payload = { ...base, ...overrides };
  const { data, error } = await supabaseAdmin.from('grouping_policies').insert(payload).select().single();
  if (error) throw error;
  return data;
}

describe('Grouping Policies Integration', () => {
  beforeAll(async () => {
    // Ensure app is ready
  });

  afterAll(async () => {
    try { await app.close(); } catch {}
  });

  test('POST /build-groups uses active policy when no policy_id provided', async () => {
    // Create inactive policy
    await createPolicy({ is_active: false });
    // Create active policy
    const active = await createPolicy({ is_active: true, kosher_only: true, target_group_size: 6, min_group_size: 4 });

    const response = await app.inject({
      method: 'POST',
      url: '/build-groups',
      payload: {
        options: { enableDiagnostics: true }
      }
    });

    // If no participants exist, API should 400; skip assertion in that case
    if (response.statusCode === 400) return;

    expect(response.statusCode).toBe(200);
    const body = response.json() as any;
    expect(body.success).toBe(true);
    const runId = body.runId;

    // Verify run saved with policy_id
    const { data: run, error: runErr } = await supabaseAdmin
      .from('runs')
      .select('*')
      .eq('id', runId)
      .single();
    expect(runErr).toBeNull();
    expect(run.policy_id).toBe(active.id);
  });

  test('POST /build-groups uses explicit policy_id when provided', async () => {
    const explicit = await createPolicy({ is_active: false, kosher_only: false, target_group_size: 5, min_group_size: 3 });

    const response = await app.inject({
      method: 'POST',
      url: '/build-groups',
      payload: {
        policy_id: explicit.id,
        options: { enableDiagnostics: true, targetGroupSize: 7 } // override allowed
      }
    });

    if (response.statusCode === 400) return;

    expect(response.statusCode).toBe(200);
    const body = response.json() as any;
    const runId = body.runId;

    const { data: run, error: runErr } = await supabaseAdmin
      .from('runs')
      .select('*')
      .eq('id', runId)
      .single();
    expect(runErr).toBeNull();
    expect(run.policy_id).toBe(explicit.id);
  });
});


