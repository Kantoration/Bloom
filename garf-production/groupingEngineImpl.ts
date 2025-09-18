/**
 * TypeScript Grouping Engine - Implementation
 * Migrated from Python sotrim_algo.py
 */

import {
  Participant,
  Group,
  GroupingPolicy,
  PairwiseCheckResult,
  GroupConstraintResult,
  GroupExplanation,
  NormalizationConfig,
  SurveyResponse,
  CompatibilityMatrix,
  SubspacePartition,
  Config,
  GroupingResult,
  AgeRules
} from './types';

// ============================================
// Global Caches
// ============================================
const scoreCache = new Map<string, number>();
const featureCache = new Map<string, number[][]>();
const normalizationRulesCache = new Map<string, Map<string, Set<string>>>();

// ============================================
// 1. normalizeAnswer
// ============================================

/**
 * Normalize a single answer using normalization rules.
 * Handles flexible answers like "doesn't matter" that match all options.
 * 
 * @param answer - The answer to normalize
 * @param column - The column/field name for context
 * @param normalizationConfig - Normalization configuration with rules
 * @returns Set of normalized values
 */
export function normalizeAnswer(
  answer: string,
  column: string,
  normalizationConfig: NormalizationConfig
): Set<string> {
  // Clean the answer
  const cleanAnswer = answer?.toString().trim() || '';
  
  // Check if we have cached normalization rules for this column
  const columnRules = normalizationRulesCache.get(column);
  
  if (!columnRules) {
    // No normalization rules for this column, return as-is
    return new Set([cleanAnswer]);
  }
  
  // Check if this is a flexible answer
  const flexibleAnswers = new Set(normalizationConfig.flexible_answers || []);
  if (flexibleAnswers.has(cleanAnswer)) {
    // This is a flexible answer - get expanded values from rules
    const expandedValues = columnRules.get(cleanAnswer);
    if (expandedValues) {
      return new Set(expandedValues);
    }
  }
  
  // This is a concrete answer - return as-is
  return new Set([cleanAnswer]);
}

// ============================================
// 2. normalizeMultiAnswer
// ============================================

/**
 * Normalize a multi-choice answer (comma-separated or array).
 * Expands flexible answers to all concrete options.
 * 
 * @param answer - Multi-choice answer (string or array)
 * @param column - The column/field name
 * @param normalizationConfig - Normalization configuration
 * @returns Set of normalized values
 */
export function normalizeMultiAnswer(
  answer: string | string[] | null | undefined,
  column: string,
  normalizationConfig: NormalizationConfig
): Set<string> {
  // Handle null/undefined/empty
  if (!answer || answer === '') {
    return new Set<string>();
  }
  
  // Convert to array of parts
  let parts: string[] = [];
  if (Array.isArray(answer)) {
    parts = answer.map(a => a.toString().trim()).filter(a => a !== '');
  } else {
    parts = answer.toString()
      .split(',')
      .map(part => part.trim())
      .filter(part => part !== '');
  }
  
  // Normalize each part and combine results
  const normalizedParts = new Set<string>();
  for (const part of parts) {
    const normalized = normalizeAnswer(part, column, normalizationConfig);
    normalized.forEach(value => normalizedParts.add(value));
  }
  
  return normalizedParts;
}

// ============================================
// Helper: toSet - Convert value to Set<string>
// ============================================

function toSet(
  value: any,
  column?: string,
  normalizationConfig?: NormalizationConfig
): Set<string> {
  // Handle null/undefined/empty
  if (value === null || value === undefined || value === '') {
    return new Set<string>();
  }
  
  // If normalization is provided, use normalizeMultiAnswer
  if (column && normalizationConfig) {
    return normalizeMultiAnswer(value, column, normalizationConfig);
  }
  
  // Otherwise, simple conversion
  if (Array.isArray(value)) {
    return new Set(value.map(v => v.toString().trim()).filter(v => v !== ''));
  }
  
  // Handle comma-separated strings
  const strValue = value.toString();
  if (strValue.includes(',')) {
    return new Set(
      strValue.split(',')
        .map(part => part.trim())
        .filter(part => part !== '')
    );
  }
  
  return new Set([strValue.trim()]);
}

// ============================================
// 3. passPairwiseCuts
// ============================================

/**
 * Check if two participants pass all pairwise constraints.
 * Includes hard categorical, multi-choice, numeric, and age constraints.
 * 
 * @param participantA - First participant
 * @param participantB - Second participant
 * @param policy - Grouping policy with constraints
 * @param explain - Whether to return detailed explanation
 * @returns Pairwise check result with passed status and optional details
 */
export function passPairwiseCuts(
  participantA: Participant,
  participantB: Participant,
  policy: GroupingPolicy,
  explain: boolean = false
): PairwiseCheckResult {
  let passed = true;
  const details: Record<string, any> = {};
  
  const normConfig: NormalizationConfig = policy.normalization || { flexible_answers: [] };
  
  // Get responses
  const a = participantA.responses;
  const b = participantB.responses;
  
  // 1. Check categorical equality constraints (with normalization)
  const categoricalEqual = policy.hard?.categorical_equal || [];
  for (const col of categoricalEqual) {
    const sa = normalizeAnswer(
      (a[col] || '').toString().trim(),
      col,
      normConfig
    );
    const sb = normalizeAnswer(
      (b[col] || '').toString().trim(),
      col,
      normConfig
    );
    
    // Check if sets have any overlap
    const hasOverlap = Array.from(sa).some(val => sb.has(val));
    
    if (explain) {
      details[`categorical_${col}`] = {
        passed: hasOverlap,
        a_value: a[col]?.toString() || '',
        b_value: b[col]?.toString() || '',
        a_normalized: Array.from(sa),
        b_normalized: Array.from(sb)
      };
    }
    
    if (!hasOverlap) {
      passed = false;
      if (!explain) return { passed: false }; // Early exit if not explaining
    }
  }
  
  // 2. Check multi-choice overlap constraints (with normalization)
  const multiOverlap = policy.hard?.multi_overlap || [];
  for (const col of multiOverlap) {
    const setA = toSet(a[col], col, normConfig);
    const setB = toSet(b[col], col, normConfig);
    
    // Check for non-empty intersection
    const intersection = new Set<string>();
    setA.forEach(val => {
      if (setB.has(val)) intersection.add(val);
    });
    
    const hasOverlap = intersection.size > 0;
    
    if (explain) {
      details[`multi_choice_${col}`] = {
        passed: hasOverlap,
        a_value: a[col]?.toString() || '',
        b_value: b[col]?.toString() || '',
        a_set: Array.from(setA),
        b_set: Array.from(setB),
        intersection: Array.from(intersection)
      };
    }
    
    if (!hasOverlap) {
      passed = false;
      if (!explain) return { passed: false };
    }
  }
  
  // 3. Check numeric tolerance constraints
  const numericTol = policy.hard?.numeric_tol || {};
  for (const [col, tolerance] of Object.entries(numericTol)) {
    const va = a[col];
    const vb = b[col];
    
    // Check for missing values
    if (va === null || va === undefined || vb === null || vb === undefined ||
        va === '' || vb === '' || Number.isNaN(va) || Number.isNaN(vb)) {
      if (explain) {
        details[`numeric_${col}`] = {
          passed: false,
          reason: 'missing_values',
          a_value: va,
          b_value: vb
        };
      }
      passed = false;
      if (!explain) return { passed: false };
      continue;
    }
    
    try {
      const numA = typeof va === 'number' ? va : parseFloat(va.toString());
      const numB = typeof vb === 'number' ? vb : parseFloat(vb.toString());
      
      if (Number.isNaN(numA) || Number.isNaN(numB)) {
        if (explain) {
          details[`numeric_${col}`] = {
            passed: false,
            reason: 'invalid_values',
            a_value: va,
            b_value: vb
          };
        }
        passed = false;
        if (!explain) return { passed: false };
        continue;
      }
      
      const diff = Math.abs(numA - numB);
      const withinTolerance = diff <= tolerance;
      
      if (explain) {
        details[`numeric_${col}`] = {
          passed: withinTolerance,
          a_value: numA,
          b_value: numB,
          difference: diff,
          tolerance: tolerance
        };
      }
      
      if (!withinTolerance) {
        passed = false;
        if (!explain) return { passed: false };
      }
    } catch (error) {
      if (explain) {
        details[`numeric_${col}`] = {
          passed: false,
          reason: 'conversion_error',
          a_value: va,
          b_value: vb,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
      passed = false;
      if (!explain) return { passed: false };
    }
  }
  
  // 4. Check age compatibility if age rules are defined
  if (policy.age_rules && participantA.age !== undefined && participantB.age !== undefined) {
    const ageCompat = checkAgeCompatibility(
      participantA.age,
      participantB.age,
      policy.age_rules
    );
    
    if (explain) {
      details.age_compatibility = {
        passed: ageCompat,
        age_a: participantA.age,
        age_b: participantB.age,
        age_difference: Math.abs(participantA.age - participantB.age)
      };
    }
    
    if (!ageCompat) {
      passed = false;
    }
  }
  
  return {
    passed,
    ...(explain ? { details } : {})
  };
}

// ============================================
// Helper: checkAgeCompatibility
// ============================================

function checkAgeCompatibility(
  age1: number,
  age2: number,
  ageRules: AgeRules
): boolean {
  // Check if ages are valid
  if (!age1 || !age2 || Number.isNaN(age1) || Number.isNaN(age2)) {
    return false;
  }
  
  // Simple max age difference rule
  if (ageRules.group_constraints?.max_age_difference) {
    const maxDiff = ageRules.group_constraints.max_age_difference;
    if (Math.abs(age1 - age2) > maxDiff) {
      return false;
    }
  }
  
  // Band-based rules
  const bands = ageRules.bands || [];
  
  // Find bands for each age
  const bands1: number[] = [];
  const bands2: number[] = [];
  
  bands.forEach((band, index) => {
    if (age1 >= band.min && age1 <= band.max) {
      bands1.push(index);
    }
    if (age2 >= band.min && age2 <= band.max) {
      bands2.push(index);
    }
  });
  
  // If either age doesn't belong to any band, they're not compatible
  if (bands1.length === 0 || bands2.length === 0) {
    return false;
  }
  
  // Check if they share any common band
  const commonBands = bands1.filter(b => bands2.includes(b));
  
  if (commonBands.length > 0) {
    // They share at least one band, check max_spread for the most restrictive common band
    let minMaxSpread = Infinity;
    for (const bandIdx of commonBands) {
      const maxSpread = bands[bandIdx].max_spread;
      if (maxSpread !== undefined && maxSpread !== null) {
        minMaxSpread = Math.min(minMaxSpread, maxSpread);
      }
    }
    
    if (minMaxSpread === Infinity) {
      return true; // No max_spread limit in any common band
    } else {
      return Math.abs(age1 - age2) <= minMaxSpread;
    }
  }
  
  // No common bands - check if cross-band is allowed
  if (!ageRules.allow_cross_band) {
    return false;
  }
  
  // For cross-band compatibility, use the most permissive max_spread
  let maxMaxSpread = 0;
  [...bands1, ...bands2].forEach(bandIdx => {
    const maxSpread = bands[bandIdx].max_spread;
    if (maxSpread !== undefined && maxSpread !== null) {
      maxMaxSpread = Math.max(maxMaxSpread, maxSpread);
    }
  });
  
  return Math.abs(age1 - age2) <= maxMaxSpread;
}

// ============================================
// 4. passGroupConstraints
// ============================================

/**
 * Check if a group of participants passes all group-level constraints.
 * Includes age spread, diversity requirements, and other group constraints.
 * 
 * @param participants - Array of participants in the group
 * @param policy - Grouping policy with constraints
 * @param explain - Whether to return detailed explanation
 * @returns Group constraint check result
 */
export function passGroupConstraints(
  participants: Participant[],
  policy: GroupingPolicy,
  explain: boolean = false
): GroupConstraintResult {
  const violations: string[] = [];
  const statistics: Record<string, any> = {};
  
  // Check minimum group size
  const minSize = policy.fallback?.min_group_size || 4;
  const maxSize = policy.fallback?.max_group_size || 8;
  
  if (participants.length < minSize) {
    violations.push(`Group size ${participants.length} is below minimum ${minSize}`);
  }
  if (participants.length > maxSize) {
    violations.push(`Group size ${participants.length} exceeds maximum ${maxSize}`);
  }
  
  // Check age constraints if defined
  if (policy.age_rules) {
    const ages = participants
      .map(p => p.age)
      .filter((age): age is number => age !== undefined && age !== null && !Number.isNaN(age));
    
    if (ages.length > 0) {
      const minAge = Math.min(...ages);
      const maxAge = Math.max(...ages);
      const ageSpread = maxAge - minAge;
      const meanAge = ages.reduce((a, b) => a + b, 0) / ages.length;
      
      // Calculate standard deviation
      const variance = ages.reduce((sum, age) => sum + Math.pow(age - meanAge, 2), 0) / ages.length;
      const stdAge = Math.sqrt(variance);
      
      if (explain) {
        statistics.age = {
          min: minAge,
          max: maxAge,
          mean: meanAge,
          std: stdAge,
          spread: ageSpread,
          ages: ages
        };
      }
      
      // Check max age difference
      if (policy.age_rules.group_constraints?.max_age_difference) {
        const maxDiff = policy.age_rules.group_constraints.max_age_difference;
        if (ageSpread > maxDiff) {
          violations.push(`Age spread ${ageSpread} exceeds maximum ${maxDiff}`);
        }
      }
      
      // Check max age standard deviation
      if (policy.age_rules.group_constraints?.max_age_std) {
        const maxStd = policy.age_rules.group_constraints.max_age_std;
        if (stdAge > maxStd) {
          violations.push(`Age std dev ${stdAge.toFixed(2)} exceeds maximum ${maxStd}`);
        }
      }
    }
  }
  
  const passed = violations.length === 0;
  
  return {
    passed,
    ...(violations.length > 0 ? { violations } : {}),
    ...(explain ? { statistics } : {})
  };
}

// ============================================
// 5. groupScore
// ============================================

/**
 * Calculate quality score for a group.
 * Higher score indicates better group quality based on diversity, similarity, and constraints.
 * 
 * @param group - Array of participants in the group
 * @param policy - Grouping policy with scoring weights
 * @param explain - Whether to return detailed scoring breakdown
 * @returns Tuple of [score, explanation]
 */
export function groupScore(
  group: Participant[],
  policy: GroupingPolicy,
  explain: boolean = false
): [number, GroupExplanation] {
  if (group.length === 0) {
    return [-1e9, { 
      group_score: -1e9, 
      diversity_score: 0, 
      similarity_score: 0, 
      constraint_score: 0 
    }];
  }
  
  // Get scoring weights
  const weights = policy.soft?.weights || {
    diversity_numeric: 1.0,
    similarity_bonus: 0.2,
    categorical_diversity: 0.3,
    multi_overlap_bonus: 0.2
  };
  
  // Calculate diversity score for numeric features
  let diversityScore = 0;
  const numericFeatures = policy.soft?.numeric_features || [];
  const fieldVariances: Record<string, number> = {};
  
  if (numericFeatures.length > 0) {
    const variances: number[] = [];
    
    for (const feature of numericFeatures) {
      const values = group
        .map(p => {
          const val = p.responses[feature];
          if (val === null || val === undefined || val === '') return NaN;
          return typeof val === 'number' ? val : parseFloat(val.toString());
        })
        .filter(v => !Number.isNaN(v));
      
      if (values.length > 1) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        variances.push(variance);
        if (explain) {
          fieldVariances[feature] = variance;
        }
      }
    }
    
    if (variances.length > 0) {
      diversityScore = variances.reduce((a, b) => a + b, 0) / variances.length;
    }
  }
  
  // Calculate similarity bonus (inverse of average pairwise distance)
  let similarityScore = 0;
  if (group.length >= 2 && numericFeatures.length > 0) {
    const distances: number[] = [];
    
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        let distance = 0;
        let validFeatures = 0;
        
        for (const feature of numericFeatures) {
          const val1 = group[i].responses[feature];
          const val2 = group[j].responses[feature];
          
          const num1 = typeof val1 === 'number' ? val1 : parseFloat(val1?.toString() || '');
          const num2 = typeof val2 === 'number' ? val2 : parseFloat(val2?.toString() || '');
          
          if (!Number.isNaN(num1) && !Number.isNaN(num2)) {
            distance += Math.abs(num1 - num2);
            validFeatures++;
          }
        }
        
        if (validFeatures > 0) {
          distances.push(distance / validFeatures);
        }
      }
    }
    
    if (distances.length > 0) {
      const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
      // Convert to similarity (inverse distance, capped)
      similarityScore = 1 / (1 + avgDistance / 10);
    }
  }
  
  // Calculate categorical diversity score
  let categoricalDiversityScore = 0;
  const categoricalFields = [...(policy.hard?.categorical_equal || []), ...(policy.soft?.categorical_fields || [])];
  
  if (categoricalFields.length > 0) {
    const diversities: number[] = [];
    
    for (const field of categoricalFields) {
      const values = group
        .map(p => p.responses[field]?.toString() || '')
        .filter(v => v !== '');
      
      if (values.length > 0) {
        const uniqueValues = new Set(values);
        const diversity = uniqueValues.size / values.length;
        diversities.push(diversity);
      }
    }
    
    if (diversities.length > 0) {
      categoricalDiversityScore = diversities.reduce((a, b) => a + b, 0) / diversities.length;
    }
  }
  
  // Calculate multi-choice overlap score
  let multiChoiceOverlapScore = 0;
  const multiChoiceFields = policy.hard?.multi_overlap || [];
  
  if (multiChoiceFields.length > 0 && group.length >= 2) {
    const overlaps: number[] = [];
    
    for (const field of multiChoiceFields) {
      // Get all values as sets
      const sets = group.map(p => toSet(p.responses[field]));
      
      // Calculate average pairwise overlap
      let totalOverlap = 0;
      let pairCount = 0;
      
      for (let i = 0; i < sets.length; i++) {
        for (let j = i + 1; j < sets.length; j++) {
          const intersection = new Set([...sets[i]].filter(x => sets[j].has(x)));
          const union = new Set([...sets[i], ...sets[j]]);
          if (union.size > 0) {
            totalOverlap += intersection.size / union.size;
            pairCount++;
          }
        }
      }
      
      if (pairCount > 0) {
        overlaps.push(totalOverlap / pairCount);
      }
    }
    
    if (overlaps.length > 0) {
      multiChoiceOverlapScore = overlaps.reduce((a, b) => a + b, 0) / overlaps.length;
    }
  }
  
  // Combine scores with weights
  const totalScore = 
    diversityScore * weights.diversity_numeric +
    similarityScore * weights.similarity_bonus +
    categoricalDiversityScore * weights.categorical_diversity +
    multiChoiceOverlapScore * weights.multi_overlap_bonus;
  
  const explanation: GroupExplanation = {
    group_score: totalScore,
    diversity_score: diversityScore,
    similarity_score: similarityScore,
    constraint_score: 0, // Can be calculated based on constraint violations
    categorical_diversity_score: categoricalDiversityScore,
    multi_choice_overlap_score: multiChoiceOverlapScore
  };
  
  if (explain) {
    explanation.balance_bonus = 0; // Can add balance calculations if needed
  }
  
  return [totalScore, explanation];
}

// ============================================
// 6. buildOneGroupOptimized
// ============================================

/**
 * Build one optimized group from available candidates.
 * Uses greedy algorithm with compatibility matrix for efficiency.
 * 
 * @param participants - Full array of participants
 * @param candidates - Indices of available candidates for grouping
 * @param compatMatrix - Pre-computed compatibility matrix
 * @param localIndices - Local indices mapping for subspace
 * @param config - Algorithm configuration
 * @param policy - Grouping policy
 * @returns Array of participant indices forming the group, or empty if no valid group
 */
export function buildOneGroupOptimized(
  participants: Participant[],
  candidates: number[],
  compatMatrix: CompatibilityMatrix,
  localIndices: number[],
  config: Config,
  policy: GroupingPolicy
): number[] {
  if (candidates.length === 0 || localIndices.length === 0) {
    return [];
  }
  
  const groupSize = policy.group_size || 6;
  const minGroupSize = policy.fallback?.min_group_size || 4;
  
  // Create mapping between local and global indices
  const localToGlobal = new Map<number, number>();
  const globalToLocal = new Map<number, number>();
  
  localIndices.forEach((localIdx, i) => {
    const globalIdx = candidates[i];
    localToGlobal.set(localIdx, globalIdx);
    globalToLocal.set(globalIdx, localIdx);
  });
  
  // Choose seed participant - the one with fewest compatible candidates (hardest to place)
  const compatCounts = new Map<number, number>();
  
  for (let i = 0; i < localIndices.length; i++) {
    const localIdx = localIndices[i];
    const globalIdx = candidates[i];
    let count = 0;
    
    // Count compatible candidates
    for (let j = 0; j < localIndices.length; j++) {
      if (i !== j) {
        const otherLocalIdx = localIndices[j];
        // Check compatibility using matrix
        const isCompatible = Array.isArray(compatMatrix)
          ? compatMatrix[localIdx]?.[otherLocalIdx] === 1
          : getMatrixValue(compatMatrix, localIdx, otherLocalIdx) === 1;
        
        if (isCompatible) count++;
      }
    }
    
    compatCounts.set(globalIdx, count);
  }
  
  // Select seed with minimum compatible candidates
  let seedGlobal = candidates[0];
  let minCompat = Infinity;
  
  compatCounts.forEach((count, idx) => {
    if (count < minCompat) {
      minCompat = count;
      seedGlobal = idx;
    }
  });
  
  const groupGlobal = [seedGlobal];
  const remainingGlobal = new Set(candidates.filter(c => c !== seedGlobal));
  
  // Greedy addition of compatible participants
  while (groupGlobal.length < groupSize && remainingGlobal.size > 0) {
    const feasibles: number[] = [];
    
    for (const globalIdx of remainingGlobal) {
      const localIdx = globalToLocal.get(globalIdx)!;
      
      // Check compatibility with all current group members
      let isCompatible = true;
      for (const groupMemberGlobal of groupGlobal) {
        const groupMemberLocal = globalToLocal.get(groupMemberGlobal)!;
        
        const compatible = Array.isArray(compatMatrix)
          ? compatMatrix[localIdx]?.[groupMemberLocal] === 1
          : getMatrixValue(compatMatrix, localIdx, groupMemberLocal) === 1;
        
        if (!compatible) {
          isCompatible = false;
          break;
        }
      }
      
      if (!isCompatible) continue;
      
      // Check group constraints
      const testGroup = groupGlobal.map(idx => participants[idx]).concat([participants[globalIdx]]);
      const constraintResult = passGroupConstraints(testGroup, policy);
      
      if (!constraintResult.passed) continue;
      
      feasibles.push(globalIdx);
    }
    
    if (feasibles.length === 0) {
      break; // No more feasible candidates
    }
    
    // Choose the candidate that gives the best group score
    let bestCandidate = feasibles[0];
    let bestScore = -Infinity;
    
    for (const candidateIdx of feasibles) {
      const testGroup = groupGlobal.map(idx => participants[idx]).concat([participants[candidateIdx]]);
      const [score] = groupScore(testGroup, policy);
      
      if (score > bestScore) {
        bestScore = score;
        bestCandidate = candidateIdx;
      }
    }
    
    groupGlobal.push(bestCandidate);
    remainingGlobal.delete(bestCandidate);
  }
  
  // Return group if it meets minimum size requirement
  return groupGlobal.length >= minGroupSize ? groupGlobal : [];
}

// Helper function to get value from compatibility matrix (handles sparse matrices)
function getMatrixValue(matrix: CompatibilityMatrix, i: number, j: number): number {
  if (Array.isArray(matrix)) {
    return matrix[i]?.[j] || 0;
  }
  // Handle sparse matrix format if needed
  return 0;
}

// ============================================
// 7. buildCompatibilityMatrixVectorized
// ============================================

/**
 * Vectorized version of compatibility matrix building for performance.
 * Uses batch operations to compute multiple compatibilities at once.
 * 
 * @param participants - Array of participants
 * @param config - Algorithm configuration
 * @param policy - Grouping policy with constraints
 * @param indices - Optional subset of participant indices to consider
 * @returns Compatibility matrix
 */
export function buildCompatibilityMatrixVectorized(
  participants: Participant[],
  config: Config,
  policy: GroupingPolicy,
  indices?: number[]
): CompatibilityMatrix {
  const participantIndices = indices || participants.map((_, i) => i);
  const n = participantIndices.length;
  
  if (n === 0) {
    return [];
  }
  
  // Initialize matrix with all true (all compatible initially)
  const compat: number[][] = Array(n).fill(0).map(() => Array(n).fill(1));
  
  // Build normalization rules if needed
  const normConfig = policy.normalization || { flexible_answers: [] };
  
  // Apply constraints to mark incompatible pairs
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const idxI = participantIndices[i];
      const idxJ = participantIndices[j];
      
      const participantA = participants[idxI];
      const participantB = participants[idxJ];
      
      // Check pairwise compatibility
      const result = passPairwiseCuts(participantA, participantB, policy, false);
      
      if (!result.passed) {
        compat[i][j] = 0;
        compat[j][i] = 0;
      }
    }
    
    // Diagonal is always 1 (self-compatible)
    compat[i][i] = 1;
  }
  
  return compat;
}

// ============================================
// 8. makeGroups - Main Algorithm
// ============================================

/**
 * Main algorithm entry point: partition into subspaces and build groups in each.
 * This is the primary function that orchestrates the entire grouping process.
 * 
 * @param participants - Array of participants with their survey responses
 * @param config - Algorithm configuration
 * @param policy - Grouping policy with constraints and weights
 * @returns Array of groups, where each group is an array of participant indices
 */
export function makeGroups(
  participants: Participant[],
  config: Config,
  policy: GroupingPolicy
): number[][] {
  if (participants.length === 0) {
    return [];
  }
  
  // Clear caches for fresh run
  scoreCache.clear();
  featureCache.clear();
  normalizationRulesCache.clear();
  
  // Build normalization rules
  buildNormalizationRules(participants, policy);
  
  // Partition into subspaces
  const subspaces = partitionIntoSubspaces(participants, policy);
  
  const allGroups: number[][] = [];
  const used = new Set<number>();
  
  // Process each subspace
  for (const [subspaceKey, indices] of Object.entries(subspaces)) {
    // Filter out already used participants
    let pool = indices.filter(idx => !used.has(idx));
    
    const minGroupSize = policy.fallback?.min_group_size || 4;
    
    if (pool.length < minGroupSize) {
      continue; // Not enough participants in this subspace
    }
    
    // Build compatibility matrix for this subspace
    const compatMatrix = buildCompatibilityMatrixVectorized(
      participants,
      config,
      policy,
      pool
    );
    
    // Build groups within this subspace
    while (true) {
      const availableCandidates = pool.filter(idx => !used.has(idx));
      
      if (availableCandidates.length < minGroupSize) {
        break; // Not enough candidates left
      }
      
      // Map global indices to local subspace indices
      const localIndices = availableCandidates.map(idx => pool.indexOf(idx));
      
      // Build one group
      const group = buildOneGroupOptimized(
        participants,
        availableCandidates,
        compatMatrix,
        localIndices,
        config,
        policy
      );
      
      if (group.length === 0) {
        break; // No more valid groups can be formed
      }
      
      // Add group and mark participants as used
      allGroups.push(group);
      group.forEach(idx => used.add(idx));
      
      // Update pool
      pool = pool.filter(idx => !used.has(idx));
    }
  }
  
  return allGroups;
}

// ============================================
// Helper: partitionIntoSubspaces
// ============================================

function partitionIntoSubspaces(
  participants: Participant[],
  policy: GroupingPolicy
): SubspacePartition {
  const subspaces: SubspacePartition = {};
  
  // If no subspace fields defined, put all in one global subspace
  const subspaceFields = policy.subspaces || [];
  
  if (subspaceFields.length === 0) {
    subspaces['global'] = participants.map((_, i) => i);
    return subspaces;
  }
  
  // Partition based on subspace fields
  participants.forEach((participant, idx) => {
    const key = getSubspaceKey(participant, subspaceFields);
    
    if (!subspaces[key]) {
      subspaces[key] = [];
    }
    
    subspaces[key].push(idx);
  });
  
  return subspaces;
}

function getSubspaceKey(
  participant: Participant,
  subspaceFields: string[]
): string {
  const keyParts: string[] = [];
  
  for (const field of subspaceFields) {
    const value = participant.responses[field];
    keyParts.push(`${field}:${value?.toString() || 'null'}`);
  }
  
  return keyParts.join('|');
}

// ============================================
// Helper: buildNormalizationRules
// ============================================

function buildNormalizationRules(
  participants: Participant[],
  policy: GroupingPolicy
): void {
  const flexibleAnswers = new Set(policy.normalization?.flexible_answers || []);
  
  // Analyze each field to build normalization rules
  const allFields = new Set<string>();
  
  // Collect all fields from participants
  participants.forEach(p => {
    Object.keys(p.responses).forEach(field => allFields.add(field));
  });
  
  // Build rules for each field
  allFields.forEach(field => {
    const uniqueValues = new Set<string>();
    
    // Collect all unique values for this field
    participants.forEach(p => {
      const value = p.responses[field];
      if (value !== null && value !== undefined && value !== '') {
        if (typeof value === 'string' || typeof value === 'number') {
          uniqueValues.add(value.toString().trim());
        } else if (Array.isArray(value)) {
          value.forEach(v => uniqueValues.add(v.toString().trim()));
        }
      }
    });
    
    // Separate flexible and concrete answers
    const flexibleInField = new Set<string>();
    const concreteInField = new Set<string>();
    
    uniqueValues.forEach(value => {
      if (flexibleAnswers.has(value)) {
        flexibleInField.add(value);
      } else {
        concreteInField.add(value);
      }
    });
    
    // Create normalization rules for this field
    if (flexibleInField.size > 0 && concreteInField.size > 0) {
      const fieldRules = new Map<string, Set<string>>();
      
      // Map each flexible answer to all concrete answers
      flexibleInField.forEach(flexible => {
        fieldRules.set(flexible, new Set(concreteInField));
      });
      
      normalizationRulesCache.set(field, fieldRules);
    }
  });
}
