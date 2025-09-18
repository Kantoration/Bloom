# Grouping Algorithm Specification

## Overview
The grouping algorithm (SOTRIM → TypeScript migration) creates participant groups based on survey responses, applying hard and soft constraints, scoring rules, and diagnostics. It is policy-driven and tightly integrated with Supabase + Lovable.

## Goals
- Create optimal participant groups based on survey responses and constraints
- Apply hard constraints (kosher, age, diet, allergies) and soft constraints (scoring)
- Provide comprehensive diagnostics and explanations
- Integrate seamlessly with Supabase persistence and Lovable dashboards
- Support policy-driven grouping with configurable parameters

## Requirements
1. **Hard Constraints**: Enforce kosher-only, age bands, diet compatibility, and allergy limits
2. **Scoring System**: Calculate group quality scores with penalties and bonuses
3. **Two-Phase Builder**: Open expansion phase followed by finalization phase
4. **Policy Integration**: Support configurable grouping policies via Supabase
5. **UUID Mapping**: Handle numeric indices in engine with UUID persistence
6. **Diagnostics**: Provide comprehensive run statistics and group analysis
7. **Unassigned Tracking**: Track participants who couldn't be placed with reasons
8. **Test Coverage**: Verify all rules and constraints through comprehensive testing

## Inputs

### Participants
- **Source**: `participants` table + `survey_responses` table
- **Data**: name, email, age, kosher status, dietary restrictions, allergies, survey responses
- **Format**: Normalized to engine format with numeric indices for processing

### Grouping Policy
- **Source**: `grouping_policies` table
- **Parameters**:
  - `kosher_only` (boolean) - Enforce kosher-only groups
  - `min_group_size` (int, default 4) - Minimum participants per group
  - `target_group_size` (int, default 6) - Target participants per group
  - `max_allergy_count` (int, default 3) - Maximum severe allergies per group
  - `age_policy` (string) - 'banded' or 'loose' age handling
  - `scoring_weights` (jsonb) - Custom scoring weights

### Config Options
- `targetGroupSize` (default 6, fallback 5)
- `minGroupSize` (default 4)
- `kosherOnly` (boolean)
- `enableDiagnostics` (boolean)
- `maxAllergyCount` (default 3)
- `agePolicy` ('banded' or 'loose')

## Hard Constraints

### Kosher-Only Rule
- **Rule**: Participants with non-kosher flag cannot join kosher-only runs
- **Implementation**: Filter participants before grouping begins
- **Database**: `participants.kosher` boolean field
- **Policy**: Controlled by `grouping_policies.kosher_only`

### Age Bands
- **Flexible Rules**: Stricter under 30, relaxed 45+
- **Banded Mode**: Strict age band enforcement
- **Loose Mode**: Tolerance-based age matching
- **Implementation**: Age compatibility matrix with configurable thresholds
- **Policy**: Controlled by `grouping_policies.age_policy`

### Diet & Allergies
- **Pairwise Compatibility**: Check diet compatibility between participants
- **Allergy Limits**: Maximum 3 severe allergies per group
- **Implementation**: Diet compatibility matrix and allergy counting
- **Database**: Stored in `participants.responses` JSONB field
- **Policy**: Controlled by `grouping_policies.max_allergy_count`

### Group Size
- **Minimum**: Must respect `minGroupSize` (default 4)
- **Target**: Aim for `targetGroupSize` (default 6)
- **Maximum**: No hard maximum, but target size preferred
- **Rejection**: Groups below minimum size are rejected

## Soft Constraints / Scoring

### Base Score
- **Starting Point**: 1.0 for all groups
- **Range**: Final scores clamped to [0, 1]

### Penalties
- **Allergy Penalty**: −0.05 per allergy in group
- **Age Spread Penalty**: −0.1 for excessive age spread
- **Size Penalty**: −0.05 for groups far from target size

### Bonuses
- **Homogeneity Bonus**: +0.05 for similar participants
- **Perfect Size Bonus**: +0.1 for groups at target size
- **Compatibility Bonus**: +0.05 for high diet compatibility

### Score Calculation
```typescript
// Base score starts at 1.0
let score = 1.0;

// Penalties (subtract from score)
score -= (allergyCount * 0.05);  // Per allergy penalty
score -= (ageSpread > threshold ? 0.1 : 0);  // Age spread penalty
score -= (dietIncompatible ? 0.05 : 0);  // Diet incompatibility penalty

// Bonuses (add to score)
score += (isTargetSize ? 0.1 : 0);  // Perfect size bonus
score += (homogeneity > threshold ? 0.05 : 0);  // Homogeneity bonus
score += (diversity > threshold ? 0.05 : 0);  // Diversity bonus

// Clamp to valid range [0, 1]
score = Math.max(0, Math.min(1, score));
```

### Current Implementation Values
- **Base Score**: 1.0
- **Allergy Penalty**: 0.05 per allergy (max 0.15 for 3+ allergies)
- **Age Penalty**: 0.1 for excessive age spread
- **Diet Penalty**: 0.05 for diet incompatibility
- **Perfect Size Bonus**: 0.1 for groups at target size
- **Homogeneity Bonus**: 0.05 for similar participants
- **Diversity Bonus**: 0.05 for balanced diversity

## Algorithm Phases

### Phase 1: Open Phase
- **Seed Selection**: Start with hardest-to-place participant
- **Greedy Addition**: Add participants maximizing group score
- **Expansion**: Continue until target size reached or no compatible participants
- **Scoring**: Calculate score after each addition

### Phase 2: Finalize Phase
- **Lock Groups**: Lock groups at target size
- **Reject Small Groups**: Reject groups below `minGroupSize`
- **Unassigned Queue**: Move rejected participants to unassigned queue
- **Final Scoring**: Calculate final scores for all groups

## Outputs

### RunResult
```typescript
interface RunResult {
  runId: string;
  groups: Group[];
  unassigned: UnassignedParticipant[];
  summary: RunSummary;
  diagnostics: RunDiagnostics;
  indexToIdMap: Record<number, string>;
}
```

### Groups
- **Members**: Array of participant IDs
- **Score**: Calculated group score (0-1)
- **Size**: Number of participants
- **Explanation**: Human-readable explanation of group formation
- **Metadata**: Additional group information

### Unassigned
- **Participant**: Participant ID and details
- **Reason**: Explanation for why participant couldn't be placed
- **Details**: Additional context about placement failure

## Diagnostics

### Group Size Histogram
- Distribution of group sizes
- Count of groups at each size
- Visual representation for Lovable dashboards

### Average Group Score
- Mean score across all groups
- Score distribution analysis
- Performance metrics

### Allergy Breakdown
- Count of groups by allergy level
- Severe allergy distribution
- Allergy compatibility analysis

### Diet Composition
- Diet type distribution across groups
- Compatibility matrix analysis
- Dietary constraint effectiveness

### Age Distribution
- Age range analysis per group
- Age band effectiveness
- Age compatibility metrics

## Supabase Integration

### Database Tables
- **`runs`**: Run metadata, policy reference, summary
- **`groups`**: Group details, scores, metadata
- **`group_members`**: Participant-group relationships
- **`unassigned_queue`**: Rejected participants with reasons
- **`grouping_policies`**: Policy configuration and parameters

### UUID Mapping
- **Engine Processing**: Uses numeric indices for performance
- **Database Storage**: Maps indices to UUIDs via `indexToIdMap`
- **Persistence**: Saves UUIDs to Supabase tables
- **Retrieval**: Maps UUIDs back to indices for processing

### Lovable Dashboards
- **Groups Dashboard**: View groups with scores, members, explanations
- **Runs Dashboard**: Run history with policy context and summaries
- **Unassigned Dashboard**: Track rejected participants and reasons
- **Policies Dashboard**: Manage grouping policies and parameters
- **Statistics Dashboard**: View diagnostics and performance metrics

## API Integration

### Endpoints
- `POST /build-groups` - Trigger grouping with policy selection
- `GET /runs/:id` - Retrieve run details and diagnostics
- `GET /runs/:id/stats` - Get run statistics and analytics

### Policy Integration
- **Active Policy**: Use default active policy if none specified
- **Explicit Policy**: Override with specific policy ID
- **Parameter Overrides**: Allow runtime parameter overrides
- **Policy Validation**: Ensure policy parameters are valid

## Testing Requirements

### Unit Tests
- **Kosher Filter**: Test kosher-only participant filtering
- **Age Bands**: Test age compatibility calculations
- **Allergy Limits**: Test allergy counting and limits
- **Scoring Clamp**: Test score calculation and clamping
- **Group Size**: Test minimum and target size enforcement

### Integration Tests
- **End-to-End**: `runGrouping` → `saveRun` → verify database
- **UUID Mapping**: Verify index-to-UUID mapping works correctly
- **Policy Integration**: Test policy selection and parameter application
- **Database Joins**: Verify all table relationships work correctly

### Policy Tests
- **Active Policy**: Test default active policy selection
- **Explicit Policy**: Test specific policy ID usage
- **Parameter Overrides**: Test runtime parameter overrides
- **Policy Validation**: Test invalid policy handling

### Diagnostics Tests
- **Histogram Generation**: Test group size histogram calculation
- **Score Averages**: Test average score calculations
- **Allergy Breakdown**: Test allergy distribution analysis
- **Age Distribution**: Test age range calculations

## Performance Considerations

### Optimization
- **Indexed Queries**: Database indexes for fast participant retrieval
- **Cached Compatibility**: Pre-calculate compatibility matrices
- **Batch Operations**: Efficient database writes for large datasets
- **Async Processing**: Non-blocking grouping for large participant sets

### Scalability
- **Memory Management**: Efficient handling of large participant sets
- **Database Connections**: Connection pooling for concurrent requests
- **Caching Strategy**: Cache frequently accessed data
- **Rate Limiting**: Prevent system overload

## Error Handling

### Validation
- **Input Validation**: Validate all input parameters
- **Policy Validation**: Ensure policy parameters are valid
- **Participant Validation**: Check participant data integrity
- **Constraint Validation**: Verify constraint parameters

### Error Recovery
- **Graceful Degradation**: Handle partial failures gracefully
- **Retry Logic**: Retry failed operations where appropriate
- **Error Logging**: Comprehensive error logging and monitoring
- **User Feedback**: Clear error messages for users

## Security Considerations

### Data Protection
- **Participant Privacy**: Protect sensitive participant information
- **Access Control**: Restrict access to grouping functions
- **Audit Logging**: Log all grouping operations
- **Data Encryption**: Encrypt sensitive data in transit and at rest

### Input Sanitization
- **SQL Injection**: Prevent SQL injection attacks
- **XSS Prevention**: Sanitize user inputs
- **Parameter Validation**: Validate all input parameters
- **Rate Limiting**: Prevent abuse and DoS attacks
