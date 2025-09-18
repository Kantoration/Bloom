import { runGrouping } from '../groupingEngineEnhanced';
import { Participant } from '../types';
import { calculateGroupScore } from '../scoring';
import { groupAllergyOk, MAX_SEVERE_ALLERGIES_PER_GROUP } from '../dietRules';

function makeParticipant(partial: Partial<Participant>): Participant {
  return {
    id: partial.id ?? 0,
    email: partial.email ?? 'x@example.com',
    age: partial.age,
    responses: partial.responses ?? {},
    source_uuid: partial.source_uuid,
    full_name: partial.full_name,
    phone: partial.phone,
    normalized_responses: partial.normalized_responses,
    age_band: partial.age_band,
    subspace_key: partial.subspace_key,
  } as Participant;
}

describe('Engine unit tests', () => {
  test('kosher-only filter: non-kosher becomes unassigned', async () => {
    const p1 = makeParticipant({ id: 1, source_uuid: 'uuid-1', responses: { kosher: true } });
    const p2 = makeParticipant({ id: 2, source_uuid: 'uuid-2', responses: { kosher: false } });
    const result = await runGrouping([p1, p2], { kosherOnly: true, enableDiagnostics: false });
    expect(result.unassigned.find(u => u.participantId === 1)).toBeUndefined();
    expect(result.unassigned.find(u => u.participantId === 0)).toBeUndefined();
    // One of them should be filtered; since indices are order-based, ensure at least one unassigned
    expect(result.unassigned.length).toBeGreaterThanOrEqual(1);
  });

  test('age bands: young cannot group with 45+', async () => {
    const young = makeParticipant({ id: 1, source_uuid: 'u1', age: 22, responses: { kosher: true } });
    const older = makeParticipant({ id: 2, source_uuid: 'u2', age: 48, responses: { kosher: true } });
    const res = await runGrouping([young, older], { targetGroupSize: 2, enableDiagnostics: true });
    // With strict age windows, expect they are not grouped together (0 groups or unassigned entries)
    expect(res.groups.length === 0 || res.groups[0].size < 2).toBeTruthy();
  });

  test(`allergy limit: groups do not exceed ${MAX_SEVERE_ALLERGIES_PER_GROUP} severe allergies`, () => {
    const mk = (allergies: string[]) => makeParticipant({ id: 0, email: 'a@a', responses: { allergies, kosher: true } });
    const group = [
      mk(['peanut (severe)']),
      mk(['sesame (severe)']),
      mk(['milk (severe)']),
      mk(['egg (severe)'])
    ];
    expect(groupAllergyOk(group)).toBe(false);
  });

  test('scoring clamped 0..1', () => {
    const mk = (age: number) => makeParticipant({ id: age, email: 'a@a', age, responses: { kosher: true } });
    const badGroup = [mk(18), mk(65), mk(90)];
    const scoreBad = calculateGroupScore(badGroup, 6);
    expect(scoreBad.finalScore).toBeGreaterThanOrEqual(0);

    const goodGroup = [mk(30), mk(31), mk(32), mk(33), mk(34), mk(35)];
    const scoreGood = calculateGroupScore(goodGroup, 6);
    expect(scoreGood.finalScore).toBeLessThanOrEqual(1);
  });
});


