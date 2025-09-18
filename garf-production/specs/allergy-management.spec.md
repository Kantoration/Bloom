# Specification: Allergy Management System

## Goal
As a group organizer, I want to ensure that groups don't have too many severe allergies, making it easier to find suitable dining venues while maintaining participant safety.

## Requirements
1. **Allergy Tracking**:
   - Extract allergies from `dietary_restrictions` field
   - Classify severity: mild, moderate, severe
   - Track unique allergies per group

2. **Hard Limit**: Maximum 3 distinct severe allergies per group

3. **Scoring Penalties**:
   - 0.05 per severe allergy
   - 0.02 per moderate allergy
   - 0.01 per mild allergy
   - 0.1 if >50% of group has allergies

4. **Unassigned Reason**: Participants marked with `"allergy-limit-exceeded"` if cannot be placed

5. **Diagnostics**:
   - Total unique allergies
   - Groups with allergies count
   - Average allergies per group
   - Allergy type breakdown

## Constraints
- Cannot exceed 3 severe allergies (hard constraint)
- Must preserve allergy details for venue selection
- Hebrew and English allergy names must be normalized

## Success Criteria
- No group exceeds severe allergy limit
- Allergy information visible in group details
- Venue recommendations consider allergy constraints
- Clear reporting of allergy distribution

## Dependencies
- `dietRules.ts` allergy functions
- Participant survey responses
- Supabase JSONB storage for allergy details

## Technical Details
### Allergy Profile Structure
```typescript
interface AllergyProfile {
  allergies: string[];
  severity: Record<string, 'mild' | 'moderate' | 'severe'>;
}
```

### Extraction Logic
```typescript
function extractAllergyProfile(participant: Participant): AllergyProfile {
  const restrictions = extractMultiSelect(responses.dietary_restrictions);
  const allergyItems = restrictions.filter(r => 
    r.includes('אלרגי') || r.toLowerCase().includes('allerg')
  );
  
  // Parse severity indicators
  const severity = {};
  allergyItems.forEach(allergy => {
    if (allergy.includes('חמור') || allergy.includes('severe')) {
      severity[allergy] = 'severe';
    } else if (allergy.includes('קל') || allergy.includes('mild')) {
      severity[allergy] = 'mild';
    } else {
      severity[allergy] = 'moderate';
    }
  });
  
  return { allergies: allergyItems, severity };
}
```

### Group Validation
```typescript
function groupAllergyOk(group: Participant[]): boolean {
  const severeAllergies = new Set<string>();
  
  group.forEach(p => {
    const profile = extractAllergyProfile(p);
    profile.allergies.forEach(allergy => {
      if (profile.severity[allergy] === 'severe') {
        severeAllergies.add(allergy);
      }
    });
  });
  
  return severeAllergies.size <= MAX_SEVERE_ALLERGIES_PER_GROUP;
}
```

## Testing Strategy
- Test allergy extraction from various formats
- Verify severe allergy limit enforcement
- Test scoring with different allergy combinations
- Integration test with real survey data

## Security Considerations
- Allergy data is health information (sensitive)
- Encrypt allergy details in database
- Limit allergy visibility to group members only
- Audit access to allergy information
