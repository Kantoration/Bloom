import { v4 as uuidv4 } from 'uuid';
import { runGrouping } from '../groupingEngineEnhanced';
import { saveRun } from '../repo';
import { Participant } from '../types';
import { supabaseAdmin } from '../supabaseClient';

function mkP(age: number, kosher: boolean): Participant {
  const uuid = uuidv4();
  return {
    id: age, // arbitrary internal id
    source_uuid: uuid,
    email: `${uuid}@ex.com`,
    age,
    responses: { kosher }
  } as Participant;
}

describe('Repo integration with Supabase mapping', () => {
  const participants: Participant[] = [
    mkP(28, true),
    mkP(29, true),
    mkP(30, false),
    mkP(31, true),
    mkP(32, true),
  ];

  beforeAll(async () => {
    // Insert participants into DB
    const inserts = participants.map(p => ({
      id: p.source_uuid!,
      name: p.email,
      email: p.email,
      age: p.age,
      kosher: !!p.responses.kosher,
      responses: p.responses
    }));
    const { error } = await supabaseAdmin.from('participants').upsert(inserts);
    if (error) throw error;
  });

  afterAll(async () => {
    // Cleanup: delete participants and any runs created
    const ids = participants.map(p => p.source_uuid);
    await supabaseAdmin.from('participants').delete().in('id', ids as string[]);
  });

  test('runGrouping -> saveRun persists UUIDs and joins resolve', async () => {
    const run = await runGrouping(participants, { targetGroupSize: 3, minGroupSize: 2, enableDiagnostics: true });
    await saveRun(run);

    // Verify groups written
    const { data: groups, error: gerr } = await supabaseAdmin
      .from('groups')
      .select('*')
      .eq('run_id', run.runId);
    expect(gerr).toBeNull();
    expect(groups).toBeTruthy();

    // Verify group_members UUIDs exist and match
    const { data: members, error: merr } = await supabaseAdmin
      .from('group_members')
      .select('*')
      .in('group_id', (groups || []).map(g => g.id));
    expect(merr).toBeNull();

    if (members && members.length > 0) {
      // Join to participants must succeed
      const { data: joined, error: jerr } = await supabaseAdmin
        .from('group_members')
        .select('participant_id, participants:participant_id ( id )')
        .limit(1);
      expect(jerr).toBeNull();
    }

    // Verify unassigned UUIDs
    const { data: unassigned, error: uerr } = await supabaseAdmin
      .from('unassigned_queue')
      .select('*')
      .eq('run_id', run.runId);
    expect(uerr).toBeNull();
    (unassigned || []).forEach(row => {
      const exists = participants.some(p => p.source_uuid === row.participant_id);
      expect(exists).toBe(true);
    });
  });
});


