/**
 * Two-Phase Group Builder
 * Open phase: Build groups to target size
 * Finalize phase: Lock complete groups, reject incomplete ones
 */

import { Participant } from './types';
import { 
  BuilderConfig, 
  BuildPhase, 
  GroupCandidate,
  GroupResult,
  UnassignedParticipant,
  UnassignedReason
} from './types-enhanced';
import { passPairwiseCuts } from './groupingEngineImpl';
import { groupAgeOk } from './ageBands';
import { groupAllergyOk } from './dietRules';
import { quickScore, calculateGroupScore } from './scoring';
import { GroupingPolicy } from './types';

/**
 * Default builder configuration
 */
export const DEFAULT_BUILDER_CONFIG: BuilderConfig = {
  targetSize: 6,
  minSize: 4,
  maxSize: 8,
  seedStrategy: 'hardest',
  optimizationLevel: 'balanced'
};

/**
 * Build groups using two-phase greedy algorithm
 * 
 * @param participants - Array of all participants
 * @param compatibilityMatrix - Pre-computed compatibility matrix
 * @param policy - Grouping policy
 * @param config - Builder configuration
 * @returns Groups and unassigned participants
 */
export function buildGroups(
  participants: Participant[],
  compatibilityMatrix: number[][],
  policy: GroupingPolicy,
  config: BuilderConfig = DEFAULT_BUILDER_CONFIG
): {
  groups: GroupCandidate[];
  unassigned: Set<number>;
} {
  // Phase 1: Open phase - build groups
  const openPhase = openPhaseBuilder(
    participants,
    compatibilityMatrix,
    policy,
    config
  );
  
  // Phase 2: Finalize phase - lock complete, reject incomplete
  const finalPhase = finalizeGroups(
    openPhase.groups,
    openPhase.unassigned,
    config
  );
  
  return finalPhase;
}

/**
 * Open phase: Build groups up to target size
 * 
 * @param participants - Array of participants
 * @param compatMatrix - Compatibility matrix
 * @param policy - Grouping policy
 * @param config - Builder configuration
 * @returns Initial groups and unassigned
 */
function openPhaseBuilder(
  participants: Participant[],
  compatMatrix: number[][],
  policy: GroupingPolicy,
  config: BuilderConfig
): BuildPhase {
  const groups: GroupCandidate[] = [];
  const assigned = new Set<number>();
  const unassigned = new Set<number>(participants.map((_, i) => i));
  
  // Build groups until we can't form any more
  while (unassigned.size >= config.minSize) {
    const group = buildOneGroup(
      participants,
      Array.from(unassigned),
      compatMatrix,
      policy,
      config
    );
    
    if (group.length === 0) {
      break; // No more groups can be formed
    }
    
    // Calculate score for the group
    const groupParticipants = group.map(idx => participants[idx]);
    const score = quickScore(groupParticipants, config.targetSize);
    
    // Add to groups
    groups.push({
      members: group,
      score,
      locked: false,
      canExpand: group.length < config.targetSize
    });
    
    // Mark as assigned
    group.forEach(idx => {
      assigned.add(idx);
      unassigned.delete(idx);
    });
  }
  
  return {
    phase: 'open',
    groups,
    unassigned
  };
}

/**
 * Build one group using greedy algorithm
 * 
 * @param participants - All participants
 * @param available - Available participant indices
 * @param compatMatrix - Compatibility matrix
 * @param policy - Grouping policy
 * @param config - Builder configuration
 * @returns Array of participant indices for the group
 */
function buildOneGroup(
  participants: Participant[],
  available: number[],
  compatMatrix: number[][],
  policy: GroupingPolicy,
  config: BuilderConfig
): number[] {
  if (available.length < config.minSize) {
    return [];
  }
  
  // Select seed based on strategy
  const seed = selectSeed(
    participants,
    available,
    compatMatrix,
    config.seedStrategy
  );
  
  if (seed === -1) {
    return [];
  }
  
  const group = [seed];
  const remaining = new Set(available.filter(idx => idx !== seed));
  
  // Greedily add members
  while (group.length < config.targetSize && remaining.size > 0) {
    const candidates = findCompatibleCandidates(
      participants,
      group,
      Array.from(remaining),
      compatMatrix,
      policy
    );
    
    if (candidates.length === 0) {
      break; // No more compatible candidates
    }
    
    // Select best candidate based on optimization level
    const best = selectBestCandidate(
      participants,
      group,
      candidates,
      config.optimizationLevel
    );
    
    if (best === -1) {
      break;
    }
    
    group.push(best);
    remaining.delete(best);
  }
  
  // Check if group meets minimum requirements
  if (group.length < config.minSize) {
    return [];
  }
  
  // Final validation
  const groupParticipants = group.map(idx => participants[idx]);
  if (!validateGroup(groupParticipants, policy)) {
    return [];
  }
  
  return group;
}

/**
 * Select seed participant based on strategy
 * 
 * @param participants - All participants
 * @param available - Available indices
 * @param compatMatrix - Compatibility matrix
 * @param strategy - Seed selection strategy
 * @returns Index of seed participant or -1
 */
function selectSeed(
  participants: Participant[],
  available: number[],
  compatMatrix: number[][],
  strategy: 'hardest' | 'random' | 'oldest'
): number {
  if (available.length === 0) {
    return -1;
  }
  
  switch (strategy) {
    case 'hardest':
      // Select participant with fewest compatible partners
      let minCompat = Infinity;
      let hardestIdx = available[0];
      
      for (const idx of available) {
        let compatCount = 0;
        for (const other of available) {
          if (idx !== other && compatMatrix[idx][other] === 1) {
            compatCount++;
          }
        }
        
        if (compatCount < minCompat) {
          minCompat = compatCount;
          hardestIdx = idx;
        }
      }
      
      return hardestIdx;
    
    case 'random':
      // Random selection
      return available[Math.floor(Math.random() * available.length)];
    
    case 'oldest':
      // Select oldest participant
      let maxAge = -1;
      let oldestIdx = available[0];
      
      for (const idx of available) {
        const age = participants[idx].age || 0;
        if (age > maxAge) {
          maxAge = age;
          oldestIdx = idx;
        }
      }
      
      return oldestIdx;
    
    default:
      return available[0];
  }
}

/**
 * Find all compatible candidates for a group
 * 
 * @param participants - All participants
 * @param group - Current group member indices
 * @param available - Available participant indices
 * @param compatMatrix - Compatibility matrix
 * @param policy - Grouping policy
 * @returns Array of compatible candidate indices
 */
function findCompatibleCandidates(
  participants: Participant[],
  group: number[],
  available: number[],
  compatMatrix: number[][],
  policy: GroupingPolicy
): number[] {
  const candidates: number[] = [];
  
  for (const candidateIdx of available) {
    // Check pairwise compatibility with all group members
    let compatible = true;
    
    for (const memberIdx of group) {
      if (compatMatrix[candidateIdx][memberIdx] !== 1) {
        compatible = false;
        break;
      }
    }
    
    if (!compatible) continue;
    
    // Check group-level constraints
    const testGroup = [...group, candidateIdx].map(idx => participants[idx]);
    
    if (!groupAgeOk(testGroup)) continue;
    if (!groupAllergyOk(testGroup)) continue;
    
    candidates.push(candidateIdx);
  }
  
  return candidates;
}

/**
 * Select best candidate based on optimization level
 * 
 * @param participants - All participants
 * @param group - Current group member indices
 * @param candidates - Compatible candidate indices
 * @param level - Optimization level
 * @returns Index of best candidate or -1
 */
function selectBestCandidate(
  participants: Participant[],
  group: number[],
  candidates: number[],
  level: 'fast' | 'balanced' | 'thorough'
): number {
  if (candidates.length === 0) {
    return -1;
  }
  
  switch (level) {
    case 'fast':
      // Just pick the first compatible candidate
      return candidates[0];
    
    case 'balanced':
      // Evaluate a few candidates
      const sampleSize = Math.min(5, candidates.length);
      const sample = candidates.slice(0, sampleSize);
      
      let bestIdx = sample[0];
      let bestScore = -Infinity;
      
      for (const candidateIdx of sample) {
        const testGroup = [...group, candidateIdx].map(idx => participants[idx]);
        const score = quickScore(testGroup);
        
        if (score > bestScore) {
          bestScore = score;
          bestIdx = candidateIdx;
        }
      }
      
      return bestIdx;
    
    case 'thorough':
      // Evaluate all candidates
      let bestIdx = candidates[0];
      let bestScore = -Infinity;
      
      for (const candidateIdx of candidates) {
        const testGroup = [...group, candidateIdx].map(idx => participants[idx]);
        const score = quickScore(testGroup);
        
        if (score > bestScore) {
          bestScore = score;
          bestIdx = candidateIdx;
        }
      }
      
      return bestIdx;
    
    default:
      return candidates[0];
  }
}

/**
 * Validate group against all constraints
 * 
 * @param group - Array of participants
 * @param policy - Grouping policy
 * @returns True if group is valid
 */
function validateGroup(
  group: Participant[],
  policy: GroupingPolicy
): boolean {
  // Check age constraints
  if (!groupAgeOk(group)) {
    return false;
  }
  
  // Check allergy constraints
  if (!groupAllergyOk(group)) {
    return false;
  }
  
  // Additional validation can be added here
  
  return true;
}

/**
 * Finalize phase: Lock complete groups, reject incomplete ones
 * 
 * @param groups - Candidate groups from open phase
 * @param unassigned - Unassigned participants
 * @param config - Builder configuration
 * @returns Final groups and unassigned
 */
function finalizeGroups(
  groups: GroupCandidate[],
  unassigned: Set<number>,
  config: BuilderConfig
): {
  groups: GroupCandidate[];
  unassigned: Set<number>;
} {
  const finalGroups: GroupCandidate[] = [];
  const finalUnassigned = new Set(unassigned);
  
  // Sort groups by score (highest first)
  const sortedGroups = [...groups].sort((a, b) => b.score - a.score);
  
  for (const group of sortedGroups) {
    if (group.members.length >= config.minSize) {
      // Lock complete groups
      finalGroups.push({
        ...group,
        locked: true,
        canExpand: false
      });
    } else {
      // Reject incomplete groups
      group.members.forEach(idx => finalUnassigned.add(idx));
    }
  }
  
  return {
    groups: finalGroups,
    unassigned: finalUnassigned
  };
}

/**
 * Convert group candidates to final group results
 * 
 * @param candidates - Group candidates
 * @param participants - All participants
 * @param runId - Run ID
 * @param targetSize - Target group size
 * @returns Array of group results
 */
export function convertToGroupResults(
  candidates: GroupCandidate[],
  participants: Participant[],
  runId: string,
  targetSize: number = 6
): GroupResult[] {
  return candidates.map((candidate, index) => {
    const groupParticipants = candidate.members.map(idx => participants[idx]);
    const scoreResult = calculateGroupScore(groupParticipants, targetSize, undefined, true);
    
    return {
      runId,
      groupId: `${runId}-group-${index + 1}`,
      members: candidate.members,
      memberIds: candidate.members,
      score: candidate.score,
      finalScore: scoreResult.finalScore,
      size: candidate.members.length,
      locked: candidate.locked,
      explanation: scoreResult.breakdown
    };
  });
}

/**
 * Create unassigned participant records
 * 
 * @param unassignedIndices - Set of unassigned participant indices
 * @param participants - All participants
 * @param reasons - Map of participant index to reason
 * @returns Array of unassigned participant records
 */
export function createUnassignedRecords(
  unassignedIndices: Set<number>,
  participants: Participant[],
  reasons: Map<number, UnassignedReason> = new Map()
): UnassignedParticipant[] {
  const records: UnassignedParticipant[] = [];
  
  for (const idx of unassignedIndices) {
    const participant = participants[idx];
    const reason = reasons.get(idx) || 'no-compatible-partners';
    
    records.push({
      participantId: idx,
      participant,
      reason,
      details: getReasonDetails(reason)
    });
  }
  
  return records;
}

/**
 * Get human-readable details for unassigned reason
 * 
 * @param reason - Unassigned reason
 * @returns Details string
 */
function getReasonDetails(reason: UnassignedReason): string {
  switch (reason) {
    case 'non-kosher-in-kosher-only-run':
      return 'Participant does not meet kosher requirements for this run';
    case 'no-compatible-partners':
      return 'Could not find enough compatible partners to form a group';
    case 'group-too-small':
      return 'Group did not meet minimum size requirements';
    case 'diet-incompatible':
      return 'Dietary restrictions incompatible with available groups';
    case 'allergy-limit-exceeded':
      return 'Would exceed allergy limit in available groups';
    case 'age-incompatible':
      return 'Age not compatible with available groups';
    case 'subspace-too-small':
      return 'Not enough participants in matching subspace';
    case 'constraints-violated':
      return 'One or more hard constraints could not be satisfied';
    default:
      return 'Unknown reason';
  }
}
