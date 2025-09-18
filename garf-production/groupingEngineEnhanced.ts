/**
 * Enhanced Grouping Engine - Main Entry Point
 * Complete TypeScript implementation with all enhancements
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  Participant, 
  GroupingPolicy, 
  Config,
  SubspacePartition
} from './types';
import {
  RunOptions,
  RunResult,
  RunSummary,
  RunDiagnostics,
  GroupResult,
  UnassignedParticipant,
  UnassignedReason,
  AllergyBreakdown,
  DietBreakdown,
  AgeDistribution,
  AgeBandStats
} from './types-enhanced';
import { 
  passPairwiseCuts,
  buildNormalizationRules,
  normalizeAnswer,
  normalizeMultiAnswer
} from './groupingEngineImpl';
import { DEFAULT_AGE_BANDS, groupAgeOk, analyzeGroupAges } from './ageBands';
import { 
  isKosherCompatible, 
  analyzeGroupDiet,
  isDietCompatible,
  groupAllergyOk
} from './dietRules';
import { calculateGroupScore } from './scoring';
import { 
  buildGroups, 
  convertToGroupResults, 
  createUnassignedRecords,
  DEFAULT_BUILDER_CONFIG
} from './builder';

/**
 * Main entry point for running the grouping algorithm
 * 
 * @param participants - Array of participants to group
 * @param options - Run configuration options
 * @returns Promise resolving to complete run result
 */
export async function runGrouping(
  participants: Participant[],
  options: RunOptions = {}
): Promise<RunResult> {
  const startTime = Date.now();
  
  // Generate run ID if not provided
  const runId = options.runId || uuidv4();
  // Build mapping from internal indices to Supabase UUIDs if provided on participants
  const indexToIdMap: Record<number, string> = {};
  participants.forEach((p, i) => {
    if (typeof (p as any).source_uuid === 'string' && (p as any).source_uuid) {
      indexToIdMap[i] = (p as any).source_uuid as string;
    }
  });
  
  // Set up configuration
  const config: Config = {
    algorithm_settings: {
      group_size: options.targetGroupSize || 6,
      debug_mode: options.enableDiagnostics || false,
      validation_enabled: true,
      use_sparse_matrix: false,
      use_parallel_processing: false,
      max_workers: 4,
      batch_size: 200
    },
    scoring_weights: {
      beta_diversity: 1.0,
      gamma_similarity: 0.2,
      alpha_constraints: 0.0,
      categorical_diversity: 0.3,
      multi_choice_overlap: 0.2,
      balance_bonus: 0.05
    },
    constraints: {
      hard_categorical: { fields: {} },
      hard_multi_choice: { fields: {} },
      hard_numeric_tolerance: { fields: {} },
      soft_categorical: { fields: {} },
      soft_multi_choice: { fields: {} },
      soft_numeric_fields: { fields: [] },
      age_rules: DEFAULT_AGE_BANDS
    },
    normalization: {
      flexible_answers: ['לא משנה לי', 'לא חשוב', 'גם וגם', 'flexible', "doesn't matter"]
    },
    scalability: {
      batch_processing_threshold: 500,
      graph_clustering_threshold: 1000,
      enable_community_detection: false
    },
    explainability: {
      log_constraint_details: options.enableDiagnostics || false,
      log_scoring_breakdown: options.enableDiagnostics || false,
      export_debug_info: options.exportCSV || false
    }
  };
  
  const policy = options.policy || createDefaultPolicy();
  
  // Phase 1: Filter participants
  const { eligible, filtered } = filterParticipants(participants, options);
  
  if (eligible.length === 0) {
    // No eligible participants
    return createEmptyResult(runId, participants.length, filtered);
  }
  
  // Phase 2: Build compatibility matrix
  const compatMatrix = buildCompatibilityMatrix(eligible, policy);
  
  // Phase 3: Partition into subspaces
  const subspaces = partitionIntoSubspaces(eligible, policy);
  
  // Phase 4: Build groups in each subspace
  const allGroups: GroupResult[] = [];
  const allUnassigned: UnassignedParticipant[] = [...filtered];
  const unassignedReasons = new Map<number, UnassignedReason>();
  
  for (const [subspaceKey, indices] of Object.entries(subspaces)) {
    // Check if subspace is too small
    if (indices.length < (options.minGroupSize || 4)) {
      indices.forEach(idx => {
        unassignedReasons.set(idx, 'subspace-too-small');
      });
      continue;
    }
    
    // Build groups in this subspace
    const subspaceParticipants = indices.map(idx => eligible[idx]);
    const subspaceMatrix = extractSubMatrix(compatMatrix, indices);
    
    const builderConfig = {
      ...DEFAULT_BUILDER_CONFIG,
      targetSize: options.targetGroupSize || 6,
      minSize: options.minGroupSize || 4,
      maxSize: options.maxGroupSize || 8
    };
    
    const { groups, unassigned } = buildGroups(
      subspaceParticipants,
      subspaceMatrix,
      policy,
      builderConfig
    );
    
    // Convert to group results
    const groupResults = convertToGroupResults(
      groups,
      subspaceParticipants,
      runId,
      builderConfig.targetSize
    );
    
    allGroups.push(...groupResults);
    
    // Track unassigned from this subspace
    unassigned.forEach(localIdx => {
      const globalIdx = indices[localIdx];
      if (!unassignedReasons.has(globalIdx)) {
        unassignedReasons.set(globalIdx, 'no-compatible-partners');
      }
    });
  }
  
  // Create unassigned records for remaining participants
  const remainingUnassigned = eligible
    .map((p, idx) => idx)
    .filter(idx => !allGroups.some(g => g.memberIds.includes(idx)))
    .filter(idx => !allUnassigned.some(u => u.participantId === idx));
  
  const unassignedRecords = createUnassignedRecords(
    new Set(remainingUnassigned),
    eligible,
    unassignedReasons
  );
  
  allUnassigned.push(...unassignedRecords);
  
  // Phase 5: Generate summary and diagnostics
  const processingTimeMs = Date.now() - startTime;
  
  const summary = generateSummary(
    participants.length,
    allGroups,
    allUnassigned,
    processingTimeMs
  );
  
  const diagnostics = options.enableDiagnostics
    ? generateDiagnostics(allGroups, allUnassigned, eligible)
    : undefined;
  
  // Export CSV if requested
  if (options.exportCSV) {
    await exportResultsToCSV(allGroups, allUnassigned, runId);
  }
  
  return {
    runId,
    groups: allGroups,
    unassigned: allUnassigned,
    summary,
    diagnostics,
    indexToIdMap,
    createdAt: new Date()
  };
}

/**
 * Filter participants based on run options
 * 
 * @param participants - All participants
 * @param options - Run options
 * @returns Eligible and filtered participants
 */
function filterParticipants(
  participants: Participant[],
  options: RunOptions
): {
  eligible: Participant[];
  filtered: UnassignedParticipant[];
} {
  const eligible: Participant[] = [];
  const filtered: UnassignedParticipant[] = [];
  
  participants.forEach((participant, idx) => {
    let shouldFilter = false;
    let reason: UnassignedReason = 'constraints-violated';
    
    // Check kosher-only filter
    if (options.kosherOnly && !isKosherCompatible(participant)) {
      shouldFilter = true;
      reason = 'non-kosher-in-kosher-only-run';
    }
    
    if (shouldFilter) {
      filtered.push({
        participantId: idx,
        participant,
        reason,
        details: `Filtered due to: ${reason}`
      });
    } else {
      eligible.push(participant);
    }
  });
  
  return { eligible, filtered };
}

/**
 * Build compatibility matrix for participants
 * 
 * @param participants - Array of participants
 * @param policy - Grouping policy
 * @returns Compatibility matrix
 */
function buildCompatibilityMatrix(
  participants: Participant[],
  policy: GroupingPolicy
): number[][] {
  const n = participants.length;
  const matrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  
  // Build normalization rules
  buildNormalizationRules(participants, policy);
  
  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1; // Self-compatible
    
    for (let j = i + 1; j < n; j++) {
      const result = passPairwiseCuts(
        participants[i],
        participants[j],
        policy,
        false
      );
      
      // Additional diet compatibility check
      const dietCompat = isDietCompatible(participants[i], participants[j]);
      
      if (result.passed && dietCompat) {
        matrix[i][j] = 1;
        matrix[j][i] = 1;
      }
    }
  }
  
  return matrix;
}

/**
 * Partition participants into subspaces
 * 
 * @param participants - Array of participants
 * @param policy - Grouping policy
 * @returns Subspace partition
 */
function partitionIntoSubspaces(
  participants: Participant[],
  policy: GroupingPolicy
): SubspacePartition {
  const subspaces: SubspacePartition = {};
  
  // Use hard categorical constraints as subspace boundaries
  const subspaceFields = policy.hard?.categorical_equal || [];
  
  if (subspaceFields.length === 0) {
    // No subspaces, all in global space
    subspaces['global'] = participants.map((_, i) => i);
    return subspaces;
  }
  
  // Partition based on categorical fields
  participants.forEach((participant, idx) => {
    const key = subspaceFields
      .map(field => `${field}:${participant.responses[field] || 'null'}`)
      .join('|');
    
    if (!subspaces[key]) {
      subspaces[key] = [];
    }
    
    subspaces[key].push(idx);
  });
  
  return subspaces;
}

/**
 * Extract submatrix for a subspace
 * 
 * @param fullMatrix - Full compatibility matrix
 * @param indices - Indices in the subspace
 * @returns Submatrix
 */
function extractSubMatrix(
  fullMatrix: number[][],
  indices: number[]
): number[][] {
  const n = indices.length;
  const subMatrix: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      subMatrix[i][j] = fullMatrix[indices[i]][indices[j]];
    }
  }
  
  return subMatrix;
}

/**
 * Create default grouping policy
 * 
 * @returns Default policy
 */
function createDefaultPolicy(): GroupingPolicy {
  return {
    group_size: 6,
    subspaces: [],
    hard: {
      categorical_equal: ['meeting_language', 'budget_range'],
      multi_overlap: ['meeting_days', 'meeting_area'],
      numeric_tol: {}
    },
    soft: {
      numeric_features: [],
      weights: {
        diversity_numeric: 1.0,
        similarity_bonus: 0.2,
        categorical_diversity: 0.3,
        multi_overlap_bonus: 0.2
      }
    },
    age_rules: DEFAULT_AGE_BANDS,
    normalization: {
      flexible_answers: ['לא משנה לי', 'לא חשוב', 'גם וגם']
    },
    fallback: {
      defer_if_infeasible: true,
      min_group_size: 4,
      max_group_size: 8
    }
  };
}

/**
 * Generate run summary
 * 
 * @param totalParticipants - Total number of participants
 * @param groups - Formed groups
 * @param unassigned - Unassigned participants
 * @param processingTimeMs - Processing time in milliseconds
 * @returns Run summary
 */
function generateSummary(
  totalParticipants: number,
  groups: GroupResult[],
  unassigned: UnassignedParticipant[],
  processingTimeMs: number
): RunSummary {
  const groupedParticipants = groups.reduce((sum, g) => sum + g.size, 0);
  const groupSizes = groups.map(g => g.size);
  
  // Calculate group size distribution
  const sizeDistribution: Record<number, number> = {};
  groupSizes.forEach(size => {
    sizeDistribution[size] = (sizeDistribution[size] || 0) + 1;
  });
  
  // Calculate average score
  const avgScore = groups.length > 0
    ? groups.reduce((sum, g) => sum + g.finalScore, 0) / groups.length
    : 0;
  
  // Calculate average size
  const avgSize = groups.length > 0
    ? groupedParticipants / groups.length
    : 0;
  
  return {
    totalParticipants,
    groupedParticipants,
    unassignedParticipants: unassigned.length,
    totalGroups: groups.length,
    averageGroupSize: avgSize,
    averageGroupScore: avgScore,
    groupSizeDistribution: sizeDistribution,
    processingTimeMs
  };
}

/**
 * Generate detailed diagnostics
 * 
 * @param groups - Formed groups
 * @param unassigned - Unassigned participants
 * @param participants - All eligible participants
 * @returns Diagnostics
 */
function generateDiagnostics(
  groups: GroupResult[],
  unassigned: UnassignedParticipant[],
  participants: Participant[]
): RunDiagnostics {
  // Group size histogram
  const groupSizeHistogram: Record<number, number> = {};
  groups.forEach(g => {
    groupSizeHistogram[g.size] = (groupSizeHistogram[g.size] || 0) + 1;
  });
  
  // Score distribution
  const scoreDistribution = groups.map(g => g.finalScore);
  
  // Allergy breakdown
  const allergyBreakdown = calculateAllergyBreakdown(groups, participants);
  
  // Diet breakdown
  const dietBreakdown = calculateDietBreakdown(groups, participants);
  
  // Age distribution
  const ageDistribution = calculateAgeDistribution(groups, participants);
  
  // Constraint violations
  const constraintViolations = unassigned
    .filter(u => u.reason === 'constraints-violated')
    .map(u => ({
      type: 'unassigned',
      participantIds: [u.participantId],
      details: u.details || ''
    }));
  
  return {
    groupSizeHistogram,
    scoreDistribution,
    allergyBreakdown,
    dietBreakdown,
    ageDistribution,
    constraintViolations
  };
}

/**
 * Calculate allergy breakdown for diagnostics
 */
function calculateAllergyBreakdown(
  groups: GroupResult[],
  participants: Participant[]
): AllergyBreakdown {
  const allAllergies = new Set<string>();
  let groupsWithAllergies = 0;
  let totalAllergyCount = 0;
  
  groups.forEach(group => {
    const groupParticipants = group.memberIds.map(id => participants[id]);
    const analysis = analyzeGroupDiet(groupParticipants);
    
    if (analysis.allergiesCount > 0) {
      groupsWithAllergies++;
      totalAllergyCount += analysis.uniqueAllergies.length;
      analysis.uniqueAllergies.forEach(a => allAllergies.add(a));
    }
  });
  
  return {
    totalAllergies: allAllergies.size,
    uniqueAllergies: Array.from(allAllergies),
    groupsWithAllergies,
    averageAllergiesPerGroup: groups.length > 0
      ? totalAllergyCount / groups.length
      : 0
  };
}

/**
 * Calculate diet breakdown for diagnostics
 */
function calculateDietBreakdown(
  groups: GroupResult[],
  participants: Participant[]
): DietBreakdown {
  let kosherGroups = 0;
  let vegetarianGroups = 0;
  let veganGroups = 0;
  let mixedDietGroups = 0;
  
  groups.forEach(group => {
    const groupParticipants = group.memberIds.map(id => participants[id]);
    const analysis = analyzeGroupDiet(groupParticipants);
    
    if (analysis.kosherCount === groupParticipants.length) {
      kosherGroups++;
    }
    if (analysis.vegetarianCount > 0) {
      vegetarianGroups++;
    }
    if (analysis.veganCount > 0) {
      veganGroups++;
    }
    if (analysis.kosherCount > 0 && analysis.kosherCount < groupParticipants.length) {
      mixedDietGroups++;
    }
  });
  
  return {
    kosherGroups,
    vegetarianGroups,
    veganGroups,
    mixedDietGroups
  };
}

/**
 * Calculate age distribution for diagnostics
 */
function calculateAgeDistribution(
  groups: GroupResult[],
  participants: Participant[]
): AgeDistribution {
  const bandStats = new Map<string, AgeBandStats>();
  let crossBandGroups = 0;
  let totalSpread = 0;
  let groupCount = 0;
  
  // Initialize band stats
  DEFAULT_AGE_BANDS.bands.forEach(band => {
    bandStats.set(band.name, {
      bandName: band.name,
      minAge: band.minAge,
      maxAge: band.maxAge,
      participantCount: 0,
      groupCount: 0
    });
  });
  
  groups.forEach(group => {
    const groupParticipants = group.memberIds.map(id => participants[id]);
    const analysis = analyzeGroupAges(groupParticipants);
    
    if (analysis.crossBand) {
      crossBandGroups++;
    }
    
    if (analysis.spread > 0) {
      totalSpread += analysis.spread;
      groupCount++;
    }
    
    // Update band stats
    analysis.bands.forEach(bandName => {
      const stats = bandStats.get(bandName);
      if (stats) {
        stats.groupCount++;
      }
    });
  });
  
  return {
    bands: Array.from(bandStats.values()),
    crossBandGroups,
    averageAgeSpread: groupCount > 0 ? totalSpread / groupCount : 0
  };
}

/**
 * Create empty result when no participants can be grouped
 */
function createEmptyResult(
  runId: string,
  totalParticipants: number,
  filtered: UnassignedParticipant[]
): RunResult {
  return {
    runId,
    groups: [],
    unassigned: filtered,
    summary: {
      totalParticipants,
      groupedParticipants: 0,
      unassignedParticipants: filtered.length,
      totalGroups: 0,
      averageGroupSize: 0,
      averageGroupScore: 0,
      groupSizeDistribution: {},
      processingTimeMs: 0
    },
    createdAt: new Date()
  };
}

/**
 * Export results to CSV files
 * (Placeholder - actual implementation would write to files or return CSV strings)
 */
async function exportResultsToCSV(
  groups: GroupResult[],
  unassigned: UnassignedParticipant[],
  runId: string
): Promise<void> {
  // This would typically write to actual files
  // For now, just log that export was requested
  console.log(`CSV export requested for run ${runId}`);
  console.log(`- ${groups.length} groups`);
  console.log(`- ${unassigned.length} unassigned participants`);
  
  // In a real implementation:
  // - Generate group_formation_results.csv
  // - Generate diet_allergy_breakdown.csv
  // - Write to filesystem or return as strings
}
