# Specification: Two-Phase Group Builder

## Goal
As a system designer, I want a two-phase building process that first attempts to create optimal groups (open phase) and then finalizes by locking complete groups and rejecting incomplete ones (finalize phase).

## Requirements
1. **Open Phase**:
   - Build groups up to target size (6, fallback 5)
   - Seed with hardest-to-place participant
   - Greedy addition maximizing group score
   - Continue until no more groups possible

2. **Finalize Phase**:
   - Sort groups by score (highest first)
   - Lock groups >= minSize (4)
   - Reject groups < minSize
   - Return members to unassigned pool

3. **Seed Selection Strategies**:
   - `'hardest'`: Fewest compatible partners
   - `'random'`: Random selection
   - `'oldest'`: Oldest participant first

4. **Optimization Levels**:
   - `'fast'`: First compatible candidate
   - `'balanced'`: Evaluate top 5 candidates
   - `'thorough'`: Evaluate all candidates

5. **Group Validation**: Must pass all constraints before locking

## Constraints
- Minimum group size: 4
- Maximum group size: 8
- Target group size: 6
- Groups must be locked once finalized

## Success Criteria
- All locked groups meet size requirements
- No partial groups in final output
- Unassigned participants properly tracked
- Performance: < 1s for 100 participants

## Dependencies
- Compatibility matrix
- Constraint checking functions
- Scoring system
- Participant pool management

## Technical Details
### Builder Configuration
```typescript
interface BuilderConfig {
  targetSize: number;
  minSize: number;
  maxSize: number;
  seedStrategy: 'hardest' | 'random' | 'oldest';
  optimizationLevel: 'fast' | 'balanced' | 'thorough';
}
```

### Open Phase Implementation
```typescript
function openPhaseBuilder(
  participants: Participant[],
  compatMatrix: number[][],
  policy: GroupingPolicy,
  config: BuilderConfig
): BuildPhase {
  const groups: GroupCandidate[] = [];
  const unassigned = new Set<number>(participants.map((_, i) => i));
  
  while (unassigned.size >= config.minSize) {
    const group = buildOneGroup(
      participants,
      Array.from(unassigned),
      compatMatrix,
      policy,
      config
    );
    
    if (group.length === 0) break;
    
    groups.push({
      members: group,
      score: quickScore(group.map(i => participants[i])),
      locked: false,
      canExpand: group.length < config.targetSize
    });
    
    group.forEach(idx => unassigned.delete(idx));
  }
  
  return { phase: 'open', groups, unassigned };
}
```

### Finalize Phase Implementation
```typescript
function finalizeGroups(
  groups: GroupCandidate[],
  unassigned: Set<number>,
  config: BuilderConfig
): BuildPhase {
  const sortedGroups = [...groups].sort((a, b) => b.score - a.score);
  const finalGroups: GroupCandidate[] = [];
  
  for (const group of sortedGroups) {
    if (group.members.length >= config.minSize) {
      finalGroups.push({
        ...group,
        locked: true,
        canExpand: false
      });
    } else {
      group.members.forEach(idx => unassigned.add(idx));
    }
  }
  
  return { phase: 'finalize', groups: finalGroups, unassigned };
}
```

## Testing Strategy
- Unit test each phase independently
- Test seed selection strategies
- Test optimization levels impact
- Integration test full builder flow
- Edge cases: empty pool, all incompatible

## Security Considerations
- Builder logic is deterministic for auditability
- Log all phase transitions
- Prevent manipulation of locked groups
