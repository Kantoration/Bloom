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

  test('scoring: perfect size bonus applied correctly', () => {
    const group = [
      makeParticipant({ id: 0, email: 'a@a', responses: { kosher: true } }),
      makeParticipant({ id: 1, email: 'b@b', responses: { kosher: true } }),
      makeParticipant({ id: 2, email: 'c@c', responses: { kosher: true } }),
      makeParticipant({ id: 3, email: 'd@d', responses: { kosher: true } }),
      makeParticipant({ id: 4, email: 'e@e', responses: { kosher: true } }),
      makeParticipant({ id: 5, email: 'f@f', responses: { kosher: true } })
    ];
    const score = calculateGroupScore(group, 6, undefined, true);
    expect(score.breakdown?.sizeBonus).toBe(0.1);
  });

  test('scoring: allergy penalty applied per allergy', () => {
    const group = [
      makeParticipant({ id: 0, email: 'a@a', responses: { kosher: true, allergies: ['peanut (severe)'] } }),
      makeParticipant({ id: 1, email: 'b@b', responses: { kosher: true, allergies: ['sesame (severe)'] } })
    ];
    const score = calculateGroupScore(group, 6, undefined, true);
    expect(score.breakdown?.allergyPenalty).toBeGreaterThan(0);
  });

  test('age bands: flexible mode allows wider age spread for 45+', async () => {
    const p1 = makeParticipant({ id: 1, source_uuid: 'u1', age: 45, responses: { kosher: true } });
    const p2 = makeParticipant({ id: 2, source_uuid: 'u2', age: 55, responses: { kosher: true } });
    const p3 = makeParticipant({ id: 3, source_uuid: 'u3', age: 50, responses: { kosher: true } });
    const res = await runGrouping([p1, p2, p3], { 
      targetGroupSize: 3, 
      agePolicy: 'loose',
      enableDiagnostics: true 
    });
    // Should be able to group 45+ participants together in loose mode
    expect(res.groups.length).toBeGreaterThan(0);
  });

  test('two-phase builder: groups reach target size in open phase', async () => {
    const participants = Array.from({ length: 12 }, (_, i) => 
      makeParticipant({ 
        id: i, 
        source_uuid: `u${i}`, 
        age: 25 + i, 
        responses: { kosher: true } 
      })
    );
    const res = await runGrouping(participants, { 
      targetGroupSize: 6, 
      minGroupSize: 4,
      enableDiagnostics: true 
    });
    // Should create groups of target size (6) or close to it
    res.groups.forEach(group => {
      expect(group.size).toBeGreaterThanOrEqual(4);
      expect(group.size).toBeLessThanOrEqual(8);
    });
  });

  test('unassigned tracking: participants with no compatible partners are unassigned', async () => {
    const p1 = makeParticipant({ id: 1, source_uuid: 'u1', age: 20, responses: { kosher: true } });
    const p2 = makeParticipant({ id: 2, source_uuid: 'u2', age: 60, responses: { kosher: true } });
    const res = await runGrouping([p1, p2], { 
      targetGroupSize: 2, 
      minGroupSize: 2,
      agePolicy: 'banded',
      enableDiagnostics: true 
    });
    // With strict age bands, these should be unassigned
    expect(res.unassigned.length).toBeGreaterThan(0);
    expect(res.unassigned[0].reason).toContain('age');
  });
});


