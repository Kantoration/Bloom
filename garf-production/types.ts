/**
 * TypeScript Type Definitions for SOTRIM Grouping Algorithm
 * Extracted from Python sotrim_algo.py
 */

// ============================================
// Core Data Types
// ============================================

/**
 * Flexible survey response data
 * Can contain string, number, or array of strings
 */
export type SurveyResponse = Record<string, string | number | string[] | null | undefined>;

/**
 * Participant data structure
 */
export interface Participant {
  id: number;
  /** Supabase UUID for this participant when sourced from DB */
  source_uuid?: string;
  email: string;
  full_name?: string;
  phone?: string;
  age?: number;
  responses: SurveyResponse;
  normalized_responses?: SurveyResponse;
  age_band?: number;
  subspace_key?: string;
}

/**
 * Group of participants
 */
export interface Group {
  id?: number;
  members: number[]; // Array of participant indices/IDs
  score: number;
  size: number;
  explanation?: GroupExplanation;
  metadata?: Record<string, any>;
}

/**
 * Group explanation/scoring breakdown
 */
export interface GroupExplanation {
  group_score: number;
  diversity_score: number;
  similarity_score: number;
  constraint_score: number;
  categorical_diversity_score?: number;
  multi_choice_overlap_score?: number;
  balance_bonus?: number;
  constraint_violations?: ConstraintViolation[];
  age_statistics?: AgeStatistics;
}

export interface ConstraintViolation {
  type: 'categorical' | 'multi_choice' | 'numeric' | 'age';
  field: string;
  participants: [number, number];
  details: Record<string, any>;
}

export interface AgeStatistics {
  min_age: number;
  max_age: number;
  mean_age: number;
  std_age: number;
  age_spread: number;
  age_bands: number[];
}

// ============================================
// Configuration Types
// ============================================

/**
 * Main configuration object
 */
export interface Config {
  algorithm_settings: AlgorithmSettings;
  scoring_weights: ScoringWeights;
  constraints: Constraints;
  normalization: NormalizationConfig;
  scalability: ScalabilityConfig;
  explainability: ExplainabilityConfig;
}

export interface AlgorithmSettings {
  group_size: number;
  debug_mode: boolean;
  validation_enabled: boolean;
  use_sparse_matrix: boolean;
  use_parallel_processing: boolean;
  max_workers: number;
  batch_size: number;
}

export interface ScoringWeights {
  beta_diversity: number;
  gamma_similarity: number;
  alpha_constraints: number;
  categorical_diversity: number;
  multi_choice_overlap: number;
  balance_bonus: number;
}

export interface Constraints {
  hard_categorical: FieldConstraints;
  hard_multi_choice: FieldConstraints;
  hard_numeric_tolerance: NumericToleranceConstraints;
  soft_categorical: FieldConstraints;
  soft_multi_choice: FieldConstraints;
  soft_numeric_fields: SoftNumericFields;
  age_constraints?: AgeConstraints;
  age_rules?: AgeRules;
}

export interface FieldConstraints {
  fields: Record<string, any>;
}

export interface NumericToleranceConstraints {
  fields: Record<string, number>; // field name -> tolerance value
}

export interface SoftNumericFields {
  fields: string[];
}

export interface AgeConstraints {
  field: string;
  tolerance: number;
  max_age_difference?: number;
}

export interface AgeRules {
  field: string;
  bands: AgeBand[];
  allow_cross_band: boolean;
  group_constraints?: {
    max_age_difference: number;
    max_age_std: number;
  };
}

export interface AgeBand {
  name: string;
  min: number;
  max: number;
  max_spread?: number;
}

export interface NormalizationConfig {
  flexible_answers: string[];
  normalization_rules?: Record<string, Record<string, Set<string>>>;
}

export interface ScalabilityConfig {
  batch_processing_threshold: number;
  graph_clustering_threshold: number;
  enable_community_detection: boolean;
}

export interface ExplainabilityConfig {
  log_constraint_details: boolean;
  log_scoring_breakdown: boolean;
  export_debug_info: boolean;
}

// ============================================
// Grouping Policy Types (Production API)
// ============================================

export interface GroupingPolicy {
  group_size: number;
  subspaces: string[];
  hard: HardConstraints;
  soft: SoftConstraints;
  age_rules?: AgeRules;
  normalization?: NormalizationPolicy;
  fallback?: FallbackRules;
}

export interface HardConstraints {
  categorical_equal: string[];
  multi_overlap: string[];
  numeric_tol: Record<string, number>;
}

export interface SoftConstraints {
  numeric_features: string[];
  weights: {
    diversity_numeric: number;
    similarity_bonus: number;
    categorical_diversity: number;
    multi_overlap_bonus: number;
  };
}

export interface NormalizationPolicy {
  flexible_answers: string[];
  wildcards?: Record<string, string[]>; // wildcard value -> expanded values
}

export interface FallbackRules {
  defer_if_infeasible: boolean;
  min_group_size: number;
  max_group_size: number;
}

// ============================================
// Survey Schema Types
// ============================================

export interface SurveySchema {
  version: number;
  fields: SurveyField[];
}

export interface SurveyField {
  name: string;
  label: LocalizedString;
  type: FieldType;
  required: boolean;
  role: FieldRole;
  options?: string[];
  min?: number;
  max?: number;
  normalization?: FieldNormalization;
}

export interface LocalizedString {
  he: string;
  en: string;
}

export type FieldType = 
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'scale'
  | 'single_select'
  | 'multi_select';

export type FieldRole = 
  | 'identifier'
  | 'hard_constraint'
  | 'soft_constraint'
  | 'demographic';

export interface FieldNormalization {
  wildcards: string[];
  expansion: string[];
}

// ============================================
// Algorithm Internal Types
// ============================================

/**
 * Compatibility matrix between participants
 */
export type CompatibilityMatrix = number[][] | SparseMatrix;

export interface SparseMatrix {
  data: number[];
  indices: number[];
  indptr: number[];
  shape: [number, number];
}

/**
 * Subspace partition
 */
export type SubspacePartition = Record<string, number[]>;

/**
 * Pairwise compatibility check result
 */
export interface PairwiseCheckResult {
  passed: boolean;
  details?: Record<string, any>;
}

/**
 * Group constraint check result
 */
export interface GroupConstraintResult {
  passed: boolean;
  violations?: string[];
  statistics?: Record<string, any>;
}

/**
 * Cache structures for optimization
 */
export interface CacheStructures {
  pairwise_cache: Map<string, boolean>;
  group_cache: Map<string, GroupConstraintResult>;
  score_cache: Map<string, number>;
  normalization_cache: Map<string, Set<string>>;
}

// ============================================
// Algorithm Output Types
// ============================================

export interface GroupingResult {
  groups: Group[];
  ungrouped: number[];
  statistics: GroupingStatistics;
  explanations: GroupExplanation[];
}

export interface GroupingStatistics {
  total_participants: number;
  grouped_participants: number;
  ungrouped_participants: number;
  total_groups: number;
  average_group_size: number;
  average_group_score: number;
  subspace_distribution?: Record<string, number>;
  processing_time_ms?: number;
}

// ============================================
// API Request/Response Types
// ============================================

export interface GroupingRequest {
  survey_id: number;
  policy_id?: number;
  participant_ids?: number[];
  dry_run?: boolean;
}

export interface GroupingResponse {
  run_id: number;
  status: GroupingStatus;
  groups?: Group[];
  statistics?: GroupingStatistics;
  error?: string;
}

export type GroupingStatus = 
  | 'pending'
  | 'running'
  | 'done'
  | 'failed'
  | 'cancelled';

// ============================================
// Utility Types
// ============================================

/**
 * Tuple type for Python-like tuples
 */
export type Tuple<T, N extends number> = N extends N
  ? number extends N
    ? T[]
    : _TupleOf<T, N, []>
  : never;

type _TupleOf<T, N extends number, R extends unknown[]> = R['length'] extends N
  ? R
  : _TupleOf<T, N, [...R, T]>;

/**
 * Optional type (Python Optional[T])
 */
export type Optional<T> = T | null | undefined;

/**
 * Set type representation
 */
export type SetType<T> = Set<T> | T[];

/**
 * DataFrame-like structure
 */
export interface DataFrame<T = any> {
  columns: string[];
  index: number[];
  data: T[][];
  shape: [number, number];
}

/**
 * Numpy-like array type
 */
export type NDArray<T = number> = T[] | T[][];

// ============================================
// Feature Extraction Types
// ============================================

export interface Features {
  numeric_features: Record<string, number>;
  categorical_features: Record<string, string>;
  multi_choice_features: Record<string, string[]>;
  age_band?: number;
  subspace_key?: string;
}

export interface FeatureVector {
  values: number[];
  labels: string[];
  participant_id: number;
}

// ============================================
// Debugging and Logging Types
// ============================================

export interface DebugInfo {
  timestamp: string;
  message: string;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  context?: Record<string, any>;
}

export interface AlgorithmTrace {
  step: string;
  timestamp: number;
  input: any;
  output: any;
  duration_ms: number;
}

// ============================================
// Export aggregated types for convenience
// ============================================

export interface SotrimAlgorithmContext {
  config: Config;
  policy: GroupingPolicy;
  participants: Participant[];
  survey_schema: SurveySchema;
  caches: CacheStructures;
  debug_mode: boolean;
}

export interface SotrimAlgorithmOutput {
  result: GroupingResult;
  traces?: AlgorithmTrace[];
  debug_info?: DebugInfo[];
}
