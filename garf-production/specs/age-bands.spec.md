# Specification: Age Band System

## Goal
As a group organizer, I want participants to be grouped with others of similar age, with stricter rules for younger participants and more flexibility for older participants (45+), ensuring comfortable social dynamics.

## Requirements
1. **Band Definition**: Age ranges with maximum spread limits:
   - 18-24: max 4 years spread
   - 25-29: max 5 years spread
   - 30-34: max 6 years spread
   - 35-39: max 7 years spread
   - 40-44: max 8 years spread
   - 45-54: max 10 years spread (flexible)
   - 55-64: max 12 years spread (flexible)
   - 65+: max 15 years spread (flexible)

2. **Compatibility Rules**:
   - Same band: Check max spread
   - Adjacent bands: Use restrictive spread
   - Non-adjacent: Only if both flexible
   - Cross-band: Max 10 years default

3. **Group Validation**: `groupAgeOk()` validates entire group age distribution.

4. **Scoring Impact**: Age penalties affect group score:
   - 0 penalty for within-band
   - 0.05 for flexible cross-band
   - 0.1 for stretched rules

5. **UI Display**: Show age distribution in group details.

## Constraints
- Ages must be valid (18-120)
- Missing ages treated as incompatible
- Cannot override age rules per run (system-wide)

## Success Criteria
- No groups violate age band rules
- 45+ participants can form cross-band groups
- Age distribution visible in diagnostics
- Performance: < 50ms for 100 participant checks

## Dependencies
- `ageBands.ts` module
- Participant age field in database
- Age validation in survey schema

## Technical Details
### Age Band Configuration
```typescript
const DEFAULT_AGE_BANDS: AgeBandConfig = {
  bands: [
    { name: '18-24', minAge: 18, maxAge: 24, maxSpread: 4, flexible: false },
    { name: '45-54', minAge: 45, maxAge: 54, maxSpread: 10, flexible: true },
    // ... other bands
  ],
  strictMode: false,
  maxCrossBandSpread: 10
};
```

### Compatibility Check
```typescript
function inSameAgeWindow(ageA: number, ageB: number): boolean {
  const bandA = getAgeBand(ageA);
  const bandB = getAgeBand(ageB);
  
  if (bandA.name === bandB.name) {
    return Math.abs(ageA - ageB) <= bandA.maxSpread;
  }
  
  // Cross-band logic...
}
```

## Testing Strategy
- Unit tests for each age band boundary
- Test cross-band compatibility matrix
- Verify group validation with edge cases
- Performance test with large age ranges

## Security Considerations
- Age is sensitive data - limit exposure
- Don't reveal exact ages in public groups
- Use age bands in UI instead of exact ages
