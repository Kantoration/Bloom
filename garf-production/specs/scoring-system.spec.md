# Specification: Group Scoring System

## Goal
As a system administrator, I want groups to be scored based on quality metrics so that the algorithm can optimize for better group compositions and provide transparency about group quality.

## Requirements
1. **Base Score**: Start at 1.0 for all groups

2. **Penalties** (subtract from score):
   - Allergy conflicts: -0.05 per severe allergy
   - Age stretch: -0.1 if age rules stretched
   - Diet incompatibility: -0.05 per issue
   - Constraint violations: -0.15 per violation

3. **Bonuses** (add to score):
   - Perfect size (6): +0.1
   - Homogeneity: +0.05 for shared attributes
   - Diversity: +0.05 for balanced numeric features

4. **Score Range**: Clamped between [0, 1]

5. **Quick Score**: Fast calculation for optimization loops

## Constraints
- Score must be deterministic (same input = same score)
- Calculation time < 10ms per group
- Must provide detailed breakdown on request

## Success Criteria
- All groups have scores between 0 and 1
- Higher quality groups consistently score higher
- Score breakdown available in diagnostics
- Performance meets requirements

## Dependencies
- All constraint modules (age, diet, allergy)
- Homogeneity calculations
- Group size configuration

## Technical Details
### Score Calculation
```typescript
function calculateGroupScore(
  group: Participant[],
  targetSize: number = 6,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
  detailed: boolean = false
): GroupScore {
  let score = config.baseScore; // 1.0
  
  // Apply penalties
  score -= getAgePenalty(group);
  score -= allergyLoadPenalty(group);
  
  // Apply bonuses
  if (group.length === targetSize) {
    score += config.bonuses.perfectSizeBonus; // +0.1
  }
  
  const homogeneity = calculateHomogeneityScore(group);
  score += homogeneity * config.bonuses.homogeneityBonus;
  
  // Clamp to valid range
  return Math.max(0, Math.min(1, score));
}
```

### Homogeneity Calculation
```typescript
function calculateHomogeneityScore(group: Participant[]): number {
  const scores = [
    ageHomogeneityScore(group),
    dietaryHomogeneityScore(group),
    calculateFieldHomogeneity(group, 'meeting_language'),
    calculateFieldHomogeneity(group, 'meeting_area'),
    calculateMultiSelectOverlap(group, 'meeting_days')
  ];
  
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
```

### Quick Score (Optimized)
```typescript
function quickScore(group: Participant[], targetSize: number = 6): number {
  let score = 1.0;
  score -= getAgePenalty(group);
  score -= Math.min(allergyLoadPenalty(group), 0.15);
  if (group.length === targetSize) score += 0.1;
  return Math.max(0, Math.min(1, score));
}
```

## Testing Strategy
- Unit tests for each scoring component
- Integration tests with various group compositions
- Performance benchmarks
- Regression tests for score consistency

## Security Considerations
- Scores are not sensitive but affect group formation
- Log score calculations for audit trail
- Prevent score manipulation through API
