/**
 * TypeScript Grouping Engine - Function Signatures
 * Based on Python sotrim_algo.py
 * 
 * This file contains function signatures only - no implementation yet.
 */

import {
  Participant,
  Group,
  Config,
  GroupingPolicy,
  SurveyResponse,
  CompatibilityMatrix,
  SubspacePartition,
  PairwiseCheckResult,
  GroupConstraintResult,
  GroupExplanation,
  GroupingResult,
  GroupingStatistics,
  Features,
  FeatureVector,
  CacheStructures,
  DataFrame,
  NDArray,
  SetType,
  Optional,
  Tuple,
  AgeRules,
  AgeBand,
  NormalizationConfig,
  AlgorithmTrace,
  DebugInfo,
  SotrimAlgorithmContext
} from './types';

// ============================================
// Main Algorithm Functions
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
): number[][];

/**
 * Extended version of makeGroups that returns detailed results
 * 
 * @param participants - Array of participants with their survey responses
 * @param config - Algorithm configuration
 * @param policy - Grouping policy with constraints and weights
 * @returns Complete grouping result with groups, ungrouped, and statistics
 */
export function makeGroupsExtended(
  participants: Participant[],
  config: Config,
  policy: GroupingPolicy
): GroupingResult;

// ============================================
// Compatibility Matrix Functions
// ============================================

/**
 * Build a compatibility matrix between all participants.
 * Matrix[i][j] = 1 if participants i and j are compatible, 0 otherwise.
 * 
 * @param participants - Array of participants
 * @param config - Algorithm configuration
 * @param policy - Grouping policy with constraints
 * @returns Compatibility matrix (dense or sparse based on config)
 */
export function buildCompatibilityMatrix(
  participants: Participant[],
  config: Config,
  policy: GroupingPolicy
): CompatibilityMatrix;

/**
 * Build a compatibility matrix for a specific subspace of participants.
 * Optimized version that only computes compatibility for given indices.
 * 
 * @param participants - Full array of participants
 * @param indices - Indices of participants in the subspace
 * @param config - Algorithm configuration
 * @param policy - Grouping policy with constraints
 * @returns Compatibility matrix for the subspace
 */
export function buildCompatibilityMatrixPerSubspace(
  participants: Participant[],
  indices: number[],
  config: Config,
  policy: GroupingPolicy
): CompatibilityMatrix;

/**
 * Vectorized version of compatibility matrix building for performance.
 * Uses batch operations to compute multiple compatibilities at once.
 * 
 * @param participants - Array of participants
 * @param config - Algorithm configuration
 * @param policy - Grouping policy with constraints
 * @param useSparse - Whether to use sparse matrix representation
 * @returns Compatibility matrix
 */
export function buildCompatibilityMatrixVectorized(
  participants: Participant[],
  config: Config,
  policy: GroupingPolicy,
  useSparse?: boolean
): CompatibilityMatrix;

// ============================================
// Group Building Functions
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
): number[];

/**
 * Alternative group building using graph-based approach.
 * Finds cliques or dense subgraphs in the compatibility graph.
 * 
 * @param participants - Array of participants
 * @param candidates - Indices of available candidates
 * @param compatMatrix - Compatibility matrix
 * @param minSize - Minimum group size
 * @param maxSize - Maximum group size
 * @returns Array of participant indices forming the group
 */
export function buildGroupGraphBased(
  participants: Participant[],
  candidates: number[],
  compatMatrix: CompatibilityMatrix,
  minSize: number,
  maxSize: number
): number[];

// ============================================
// Constraint Checking Functions
// ============================================

/**
 * Check if two participants pass all pairwise constraints.
 * Includes hard categorical, multi-choice, numeric, and age constraints.
 * 
 * @param participantA - First participant
 * @param participantB - Second participant
 * @param policy - Grouping policy with constraints
 * @param explain - Whether to return detailed explanation
 * @returns Tuple of [passed: boolean, details: object]
 */
export function passPairwiseCuts(
  participantA: Participant,
  participantB: Participant,
  policy: GroupingPolicy,
  explain?: boolean
): PairwiseCheckResult;

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
  explain?: boolean
): GroupConstraintResult;

/**
 * Vectorized version of pairwise constraint checking for efficiency.
 * Checks multiple pairs simultaneously using batch operations.
 * 
 * @param participants - Array of participants
 * @param pairs - Array of participant index pairs to check
 * @param policy - Grouping policy
 * @returns Array of boolean results for each pair
 */
export function passPairwiseCutsVectorized(
  participants: Participant[],
  pairs: Array<[number, number]>,
  policy: GroupingPolicy
): boolean[];

// ============================================
// Scoring Functions
// ============================================

/**
 * Calculate quality score for a group.
 * Higher score indicates better group quality based on diversity, similarity, and constraints.
 * 
 * @param group - Array of participants in the group
 * @param policy - Grouping policy with scoring weights
 * @param explain - Whether to return detailed scoring breakdown
 * @returns Tuple of [score: number, explanation: object]
 */
export function groupScore(
  group: Participant[],
  policy: GroupingPolicy,
  explain?: boolean
): [number, GroupExplanation];

/**
 * Calculate diversity score for numeric features in a group.
 * Based on variance of numeric features across group members.
 * 
 * @param group - Array of participants
 * @param features - List of numeric feature names
 * @returns Diversity score
 */
export function calculateDiversityScore(
  group: Participant[],
  features: string[]
): number;

/**
 * Calculate similarity bonus for a group.
 * Rewards groups with moderate similarity (not too diverse, not too homogeneous).
 * 
 * @param group - Array of participants
 * @param features - List of feature names
 * @returns Similarity bonus score
 */
export function calculateSimilarityBonus(
  group: Participant[],
  features: string[]
): number;

/**
 * Calculate categorical diversity score.
 * Measures diversity in categorical features.
 * 
 * @param group - Array of participants
 * @param categoricalFields - List of categorical field names
 * @returns Categorical diversity score
 */
export function calculateCategoricalDiversity(
  group: Participant[],
  categoricalFields: string[]
): number;

/**
 * Calculate multi-choice overlap score.
 * Rewards groups with overlapping interests in multi-choice fields.
 * 
 * @param group - Array of participants
 * @param multiChoiceFields - List of multi-choice field names
 * @returns Multi-choice overlap score
 */
export function calculateMultiChoiceOverlap(
  group: Participant[],
  multiChoiceFields: string[]
): number;

// ============================================
// Normalization Functions
// ============================================

/**
 * Normalize a single answer using normalization rules.
 * Handles flexible answers like "doesn't matter" that match all options.
 * 
 * @param answer - The answer to normalize
 * @param column - The column/field name for context
 * @param normalizationRules - Normalization configuration
 * @returns Set of normalized values
 */
export function normalizeAnswer(
  answer: string,
  column: string,
  normalizationRules: NormalizationConfig
): Set<string>;

/**
 * Normalize a multi-choice answer (comma-separated or array).
 * Expands flexible answers to all concrete options.
 * 
 * @param answer - Multi-choice answer (string or array)
 * @param column - The column/field name
 * @param normalizationRules - Normalization configuration
 * @returns Set of normalized values
 */
export function normalizeMultiAnswer(
  answer: string | string[],
  column: string,
  normalizationRules: NormalizationConfig
): Set<string>;

/**
 * Build normalization rules by analyzing all unique values in each column.
 * Creates mappings from flexible answers to concrete options.
 * 
 * @param participants - Array of participants to analyze
 * @param flexibleAnswers - List of flexible answer patterns
 * @returns Normalization rules mapping
 */
export function buildNormalizationRules(
  participants: Participant[],
  flexibleAnswers: string[]
): Record<string, Record<string, Set<string>>>;

// ============================================
// Subspace Partitioning Functions
// ============================================

/**
 * Partition participants into subspaces based on hard categorical constraints.
 * Creates separate pools of participants that must be grouped together.
 * 
 * @param participants - Array of all participants
 * @param categoricalFields - Fields that define subspace boundaries
 * @returns Subspace partition mapping
 */
export function partitionIntoSubspaces(
  participants: Participant[],
  categoricalFields: string[]
): SubspacePartition;

/**
 * Generate a unique key for a participant's subspace.
 * Used to group participants with matching categorical values.
 * 
 * @param participant - The participant
 * @param categoricalFields - Fields to use for key generation
 * @returns Subspace key string
 */
export function getSubspaceKey(
  participant: Participant,
  categoricalFields: string[]
): string;

// ============================================
// Age-Related Functions
// ============================================

/**
 * Get the age band index for a given age.
 * 
 * @param age - The participant's age
 * @param ageRules - Age band configuration
 * @returns Band index, or -1 if not in any band
 */
export function getAgeBand(
  age: number,
  ageRules: AgeRules
): number;

/**
 * Check if two ages are compatible based on age rules.
 * Considers age bands, max spread, and cross-band allowance.
 * 
 * @param age1 - First participant's age
 * @param age2 - Second participant's age
 * @param ageRules - Age compatibility rules
 * @returns Whether the ages are compatible
 */
export function checkAgeCompatibility(
  age1: number,
  age2: number,
  ageRules: AgeRules
): boolean;

/**
 * Check if a group passes age-related constraints.
 * Validates age spread, standard deviation, and band consistency.
 * 
 * @param ages - Array of ages in the group
 * @param ageRules - Age rules configuration
 * @returns Whether the group passes age constraints
 */
export function passAgeGroupConstraints(
  ages: number[],
  ageRules: AgeRules
): boolean;

// ============================================
// Utility Functions
// ============================================

/**
 * Convert a value to a set of strings.
 * Handles various input types: string, array, comma-separated, etc.
 * 
 * @param value - Value to convert
 * @param column - Optional column name for normalization context
 * @returns Set of string values
 */
export function toSet(
  value: any,
  column?: string
): Set<string>;

/**
 * Extract numeric features from participants.
 * Creates feature vectors for similarity/diversity calculations.
 * 
 * @param participants - Array of participants
 * @param featureNames - Names of numeric features to extract
 * @returns Array of feature vectors
 */
export function extractNumericFeatures(
  participants: Participant[],
  featureNames: string[]
): FeatureVector[];

/**
 * Calculate pairwise distances between participants.
 * Used for similarity calculations.
 * 
 * @param features - Array of feature vectors
 * @param metric - Distance metric ('euclidean', 'manhattan', etc.)
 * @returns Distance matrix
 */
export function calculatePairwiseDistances(
  features: FeatureVector[],
  metric?: string
): number[][];

// ============================================
// Validation Functions
// ============================================

/**
 * Validate algorithm configuration.
 * Checks for required fields, valid ranges, and consistency.
 * 
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateConfig(
  config: Config
): void;

/**
 * Validate participant data.
 * Checks for required fields and data types.
 * 
 * @param participants - Array of participants to validate
 * @param requiredFields - List of required field names
 * @throws Error if data is invalid
 */
export function validateParticipants(
  participants: Participant[],
  requiredFields: string[]
): void;

/**
 * Validate grouping policy.
 * Ensures policy has all required fields and valid values.
 * 
 * @param policy - Policy to validate
 * @throws Error if policy is invalid
 */
export function validatePolicy(
  policy: GroupingPolicy
): void;

// ============================================
// Caching Functions
// ============================================

/**
 * Get cached features for a group of participants.
 * Improves performance by avoiding repeated feature extraction.
 * 
 * @param participants - Array of participants
 * @param indices - Indices to extract features for
 * @param cache - Cache structure
 * @returns Cached or newly computed features
 */
export function getCachedFeatures(
  participants: Participant[],
  indices: number[],
  cache: CacheStructures
): NDArray<number>;

/**
 * Clear all caches to free memory.
 * Should be called before starting a new grouping run.
 * 
 * @param cache - Cache structure to clear
 */
export function clearCaches(
  cache: CacheStructures
): void;

// ============================================
// Debug and Logging Functions
// ============================================

/**
 * Print debug message if debug mode is enabled.
 * 
 * @param message - Debug message
 * @param context - Optional context object
 * @param config - Configuration with debug settings
 */
export function debugPrint(
  message: string,
  context?: any,
  config?: Config
): void;

/**
 * Log algorithm trace for debugging and analysis.
 * 
 * @param step - Algorithm step name
 * @param input - Input data
 * @param output - Output data
 * @param startTime - Start timestamp
 * @returns Algorithm trace object
 */
export function logTrace(
  step: string,
  input: any,
  output: any,
  startTime: number
): AlgorithmTrace;

/**
 * Export debug information for analysis.
 * 
 * @param groups - Formed groups
 * @param ungrouped - Ungrouped participants
 * @param traces - Algorithm traces
 * @param config - Configuration
 * @returns Debug info object
 */
export function exportDebugInfo(
  groups: Group[],
  ungrouped: number[],
  traces: AlgorithmTrace[],
  config: Config
): DebugInfo[];

// ============================================
// Statistical Functions
// ============================================

/**
 * Calculate grouping statistics.
 * Provides summary metrics for the grouping result.
 * 
 * @param groups - Array of formed groups
 * @param totalParticipants - Total number of participants
 * @param subspaceDistribution - Optional subspace distribution
 * @returns Grouping statistics
 */
export function calculateStatistics(
  groups: Group[],
  totalParticipants: number,
  subspaceDistribution?: Record<string, number>
): GroupingStatistics;

/**
 * Calculate variance for numeric features.
 * 
 * @param values - Array of numeric values
 * @returns Variance
 */
export function calculateVariance(
  values: number[]
): number;

/**
 * Calculate standard deviation for numeric features.
 * 
 * @param values - Array of numeric values
 * @returns Standard deviation
 */
export function calculateStdDev(
  values: number[]
): number;

// ============================================
// Export Main API
// ============================================

/**
 * Main API entry point for the grouping engine.
 * Provides a high-level interface for running the algorithm.
 * 
 * @param context - Complete algorithm context
 * @returns Grouping result with all details
 */
export function runGroupingAlgorithm(
  context: SotrimAlgorithmContext
): GroupingResult;

/**
 * Async version of the main algorithm for non-blocking execution.
 * 
 * @param context - Complete algorithm context
 * @returns Promise resolving to grouping result
 */
export async function runGroupingAlgorithmAsync(
  context: SotrimAlgorithmContext
): Promise<GroupingResult>;
