# Specification: Kosher-Only Filter

## Goal
As an admin running a kosher-only event, I want to ensure that only kosher-observant participants are included in the grouping process, so that all groups maintain kosher dietary requirements.

## Requirements
1. **Filter Logic**: When `kosherOnly: true`, filter participants where `kosher === true` or response indicates flexibility.
2. **Unassigned Tracking**: Non-kosher participants marked as unassigned with reason `"non-kosher-in-kosher-only-run"`.
3. **UI Toggle**: Lovable form includes a clear "Kosher Only" checkbox.
4. **Reporting**: Show count of filtered participants in diagnostics.
5. **Flexibility Detection**: Recognize "לא משנה", "flexible", "doesn't matter" as kosher-compatible.

## Constraints
- Cannot mix kosher-only and non-kosher runs in the same batch.
- Must preserve original participant data (no modifications).
- Filter must run before compatibility matrix generation.

## Success Criteria
- Kosher-only runs contain 0 non-kosher participants.
- Filtered participants appear in unassigned_queue with correct reason.
- UI clearly indicates when kosher-only mode is active.
- Performance impact < 100ms for 1000 participants.

## Dependencies
- `isKosherCompatible()` function in `dietRules.ts`
- `filterParticipants()` in `groupingEngineEnhanced.ts`
- Supabase `participants.kosher` field
- Lovable form configuration

## Technical Details
### Implementation
```typescript
function isKosherCompatible(participant: Participant): boolean {
  const diet = extractDietaryProfile(participant);
  if (diet.kosher) return true;
  
  const kosherResponse = participant.responses.kosher;
  const flexibleResponses = ['לא משנה', 'flexible', "doesn't matter"];
  
  return flexibleResponses.some(flex => 
    kosherResponse?.toLowerCase().includes(flex.toLowerCase())
  );
}
```

### Database Query
```sql
-- Count kosher vs non-kosher participants
SELECT 
  COUNT(*) FILTER (WHERE kosher = true) as kosher_count,
  COUNT(*) FILTER (WHERE kosher = false) as non_kosher_count,
  COUNT(*) as total_count
FROM participants;
```

## Testing Strategy
- Unit test `isKosherCompatible()` with various inputs
- Integration test filter with mixed participant sets
- Verify unassigned_queue entries
- Test UI toggle behavior

## Security Considerations
- Kosher status is not PII but should be handled respectfully
- Audit log when kosher-only filter is applied
- No exposure of individual dietary preferences in public APIs
