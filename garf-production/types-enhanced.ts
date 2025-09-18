/**
 * Enhanced TypeScript Type Definitions for SOTRIM Grouping Algorithm
 * Includes run-based types and enhanced constraints
 */

import { 
  Participant, 
  Group, 
  GroupingPolicy,
  SurveyResponse 
} from './types';

// ============================================
// Run-Based Types
// ============================================

/**
 * Options for a grouping run
 */
export interface RunOptions {
  runId?: string;
  kosherOnly?: boolean;
  targetGroupSize?: number;
  minGroupSize?: number;
  maxGroupSize?: number;
  policy?: GroupingPolicy;
  enableDiagnostics?: boolean;
  exportCSV?: boolean;
  strict?: boolean; // Strict mode for constraint enforcement
}

/**
 * Result of a grouping run
 */
export interface RunResult {
  runId: string;
  groups: GroupResult[];
  unassigned: UnassignedParticipant[];
  summary: RunSummary;
  diagnostics?: RunDiagnostics;
  /** Mapping from internal engine index -> Supabase participants.id (UUID as string) */
  indexToIdMap: Record<number, string>;
  createdAt: Date;
}

/**
 * Enhanced group result with run association
 */
export interface GroupResult extends Group {
  runId: string;
  groupId: string;
  finalScore: number;
  memberIds: number[];
  locked?: boolean;
}

/**
 * Unassigned participant with reason
 */
export interface UnassignedParticipant {
  participantId: number;
  participant: Participant;
  reason: UnassignedReason;
  details?: string;
}

export type UnassignedReason = 
  | 'non-kosher-in-kosher-only-run'
  | 'no-compatible-partners'
  | 'group-too-small'
  | 'diet-incompatible'
  | 'allergy-limit-exceeded'
  | 'age-incompatible'
  | 'subspace-too-small'
  | 'constraints-violated';

/**
 * Run summary statistics
 */
export interface RunSummary {
  totalParticipants: number;
  groupedParticipants: number;
  unassignedParticipants: number;
  totalGroups: number;
  averageGroupSize: number;
  averageGroupScore: number;
  groupSizeDistribution: Record<number, number>;
  processingTimeMs: number;
}

/**
 * Detailed diagnostics for debugging
 */
export interface RunDiagnostics {
  groupSizeHistogram: Record<number, number>;
  scoreDistribution: number[];
  allergyBreakdown: AllergyBreakdown;
  dietBreakdown: DietBreakdown;
  ageDistribution: AgeDistribution;
  constraintViolations: ConstraintViolation[];
}

export interface AllergyBreakdown {
  totalAllergies: number;
  uniqueAllergies: string[];
  groupsWithAllergies: number;
  averageAllergiesPerGroup: number;
}

export interface DietBreakdown {
  kosherGroups: number;
  vegetarianGroups: number;
  veganGroups: number;
  mixedDietGroups: number;
}

export interface AgeDistribution {
  bands: AgeBandStats[];
  crossBandGroups: number;
  averageAgeSpread: number;
}

export interface AgeBandStats {
  bandName: string;
  minAge: number;
  maxAge: number;
  participantCount: number;
  groupCount: number;
}

export interface ConstraintViolation {
  type: string;
  groupId?: string;
  participantIds?: number[];
  details: string;
}

// ============================================
// Age Band Types
// ============================================

export interface AgeBandConfig {
  bands: AgeBandDefinition[];
  strictMode?: boolean;
  maxCrossBandSpread?: number;
}

export interface AgeBandDefinition {
  name: string;
  minAge: number;
  maxAge: number;
  maxSpread: number;
  flexible?: boolean; // More flexible for older age groups
}

// ============================================
// Diet and Allergy Types
// ============================================

export interface DietaryProfile {
  kosher: boolean;
  vegetarian: boolean;
  vegan: boolean;
  glutenFree: boolean;
  other?: string[];
}

export interface AllergyProfile {
  allergies: string[];
  severity: Record<string, 'mild' | 'moderate' | 'severe'>;
}

export interface DietCompatibilityResult {
  compatible: boolean;
  issues?: string[];
}

// ============================================
// Scoring Types
// ============================================

export interface ScoringConfig {
  baseScore: number;
  penalties: PenaltyConfig;
  bonuses: BonusConfig;
  minScore: number;
  maxScore: number;
}

export interface PenaltyConfig {
  allergyConflict: number;
  ageStretch: number;
  dietIncompatible: number;
  constraintViolation: number;
}

export interface BonusConfig {
  homogeneityBonus: number;
  perfectSizeBonus: number;
  diversityBonus: number;
}

export interface GroupScore {
  baseScore: number;
  penalties: number;
  bonuses: number;
  finalScore: number;
  breakdown?: ScoreBreakdown;
}

export interface ScoreBreakdown {
  allergyPenalty: number;
  agePenalty: number;
  dietPenalty: number;
  homogeneityBonus: number;
  sizeBonus: number;
  details: string[];
}

// ============================================
// Builder Types
// ============================================

export interface BuilderConfig {
  targetSize: number;
  minSize: number;
  maxSize: number;
  seedStrategy: 'hardest' | 'random' | 'oldest';
  optimizationLevel: 'fast' | 'balanced' | 'thorough';
}

export interface BuildPhase {
  phase: 'open' | 'finalize';
  groups: GroupCandidate[];
  unassigned: Set<number>;
}

export interface GroupCandidate {
  members: number[];
  score: number;
  locked: boolean;
  canExpand: boolean;
}

// ============================================
// Database Schema Types (Supabase)
// ============================================

export interface RunRecord {
  id: string;
  created_at: Date;
  options: Record<string, any>; // JSONB
  summary: Record<string, any>; // JSONB
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface GroupRecord {
  id: string;
  run_id: string;
  score: number;
  size: number;
  metadata?: Record<string, any>; // JSONB
  created_at: Date;
}

export interface GroupMemberRecord {
  group_id: string;
  participant_id: number;
  role?: string;
  joined_at: Date;
}

export interface UnassignedQueueRecord {
  run_id: string;
  participant_id: number;
  reason: string;
  details?: string;
  created_at: Date;
}
