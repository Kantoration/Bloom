/**
 * Scoring System for Group Quality
 * Simplified, stable scoring model with penalties and bonuses
 */

import { Participant } from './types';
import { 
  ScoringConfig, 
  GroupScore, 
  ScoreBreakdown,
  PenaltyConfig,
  BonusConfig 
} from './types-enhanced';
import { getAgePenalty, ageHomogeneityScore } from './ageBands';
import { allergyLoadPenalty, dietaryHomogeneityScore } from './dietRules';

/**
 * Default scoring configuration
 */
export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  baseScore: 1.0,
  penalties: {
    allergyConflict: 0.05,
    ageStretch: 0.1,
    dietIncompatible: 0.05,
    constraintViolation: 0.15
  },
  bonuses: {
    homogeneityBonus: 0.05,
    perfectSizeBonus: 0.1,
    diversityBonus: 0.05
  },
  minScore: 0,
  maxScore: 1
};

/**
 * Calculate comprehensive score for a group
 * 
 * @param group - Array of participants
 * @param targetSize - Target group size
 * @param config - Scoring configuration
 * @param detailed - Whether to return detailed breakdown
 * @returns Group score with optional breakdown
 */
export function calculateGroupScore(
  group: Participant[],
  targetSize: number = 6,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
  detailed: boolean = false
): GroupScore {
  // Start with base score
  let score = config.baseScore;
  const details: string[] = [];
  const breakdown: Partial<ScoreBreakdown> = {};
  
  // Calculate penalties
  let totalPenalties = 0;
  
  // Age penalty
  const agePenalty = getAgePenalty(group);
  if (agePenalty > 0) {
    totalPenalties += agePenalty;
    breakdown.agePenalty = agePenalty;
    details.push(`Age penalty: -${agePenalty.toFixed(3)}`);
  }
  
  // Allergy penalty
  const allergyPenalty = allergyLoadPenalty(group);
  if (allergyPenalty > 0) {
    totalPenalties += Math.min(allergyPenalty, config.penalties.allergyConflict * 3);
    breakdown.allergyPenalty = allergyPenalty;
    details.push(`Allergy penalty: -${allergyPenalty.toFixed(3)}`);
  }
  
  // Calculate bonuses
  let totalBonuses = 0;
  
  // Size bonus - perfect size gets bonus
  if (group.length === targetSize) {
    totalBonuses += config.bonuses.perfectSizeBonus;
    breakdown.sizeBonus = config.bonuses.perfectSizeBonus;
    details.push(`Perfect size bonus: +${config.bonuses.perfectSizeBonus.toFixed(3)}`);
  }
  
  // Homogeneity bonuses
  const homogeneityScore = calculateHomogeneityScore(group);
  const homogeneityBonus = homogeneityScore * config.bonuses.homogeneityBonus;
  if (homogeneityBonus > 0) {
    totalBonuses += homogeneityBonus;
    breakdown.homogeneityBonus = homogeneityBonus;
    details.push(`Homogeneity bonus: +${homogeneityBonus.toFixed(3)}`);
  }
  
  // Apply penalties and bonuses
  score = score - totalPenalties + totalBonuses;
  
  // Clamp score to valid range
  const finalScore = Math.max(config.minScore, Math.min(config.maxScore, score));
  
  const result: GroupScore = {
    baseScore: config.baseScore,
    penalties: totalPenalties,
    bonuses: totalBonuses,
    finalScore
  };
  
  if (detailed) {
    result.breakdown = {
      allergyPenalty: breakdown.allergyPenalty || 0,
      agePenalty: breakdown.agePenalty || 0,
      dietPenalty: breakdown.dietPenalty || 0,
      homogeneityBonus: breakdown.homogeneityBonus || 0,
      sizeBonus: breakdown.sizeBonus || 0,
      details
    };
  }
  
  return result;
}

/**
 * Calculate homogeneity score across multiple dimensions
 * 
 * @param group - Array of participants
 * @returns Combined homogeneity score (0-1)
 */
export function calculateHomogeneityScore(group: Participant[]): number {
  const scores: number[] = [];
  
  // Age homogeneity
  scores.push(ageHomogeneityScore(group));
  
  // Dietary homogeneity
  scores.push(dietaryHomogeneityScore(group));
  
  // Language homogeneity
  const languageScore = calculateFieldHomogeneity(group, 'meeting_language');
  if (languageScore >= 0) scores.push(languageScore);
  
  // Area homogeneity
  const areaScore = calculateFieldHomogeneity(group, 'meeting_area');
  if (areaScore >= 0) scores.push(areaScore);
  
  // Meeting day homogeneity
  const dayScore = calculateMultiSelectOverlap(group, 'meeting_days');
  if (dayScore >= 0) scores.push(dayScore);
  
  // Return average of all homogeneity scores
  return scores.length > 0 
    ? scores.reduce((a, b) => a + b, 0) / scores.length 
    : 0;
}

/**
 * Calculate homogeneity for a single field
 * 
 * @param group - Array of participants
 * @param field - Field name to check
 * @returns Homogeneity score (0-1) or -1 if field not found
 */
function calculateFieldHomogeneity(
  group: Participant[],
  field: string
): number {
  const values = group
    .map(p => p.responses[field])
    .filter(v => v !== undefined && v !== null && v !== '');
  
  if (values.length < 2) {
    return 1.0; // Perfect homogeneity by default
  }
  
  // Count occurrences of each value
  const counts = new Map<string, number>();
  values.forEach(v => {
    const key = v.toString();
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  
  // Find most common value
  let maxCount = 0;
  counts.forEach(count => {
    if (count > maxCount) maxCount = count;
  });
  
  // Return ratio of most common value
  return maxCount / values.length;
}

/**
 * Calculate overlap score for multi-select fields
 * 
 * @param group - Array of participants
 * @param field - Field name to check
 * @returns Overlap score (0-1) or -1 if field not found
 */
function calculateMultiSelectOverlap(
  group: Participant[],
  field: string
): number {
  const valueSets = group
    .map(p => {
      const val = p.responses[field];
      if (!val) return new Set<string>();
      
      if (Array.isArray(val)) {
        return new Set(val.map(v => v.toString()));
      }
      
      if (typeof val === 'string') {
        return new Set(val.split(',').map(v => v.trim()).filter(v => v !== ''));
      }
      
      return new Set([val.toString()]);
    })
    .filter(s => s.size > 0);
  
  if (valueSets.length < 2) {
    return 1.0;
  }
  
  // Find intersection of all sets
  let intersection = new Set(valueSets[0]);
  for (let i = 1; i < valueSets.length; i++) {
    intersection = new Set([...intersection].filter(x => valueSets[i].has(x)));
  }
  
  // Calculate average overlap
  let totalOverlap = 0;
  let comparisons = 0;
  
  for (let i = 0; i < valueSets.length; i++) {
    for (let j = i + 1; j < valueSets.length; j++) {
      const setI = valueSets[i];
      const setJ = valueSets[j];
      const intersect = new Set([...setI].filter(x => setJ.has(x)));
      const union = new Set([...setI, ...setJ]);
      
      if (union.size > 0) {
        totalOverlap += intersect.size / union.size;
        comparisons++;
      }
    }
  }
  
  return comparisons > 0 ? totalOverlap / comparisons : 0;
}

/**
 * Compare two groups by score (for sorting)
 * 
 * @param groupA - First group with participants and score
 * @param groupB - Second group with participants and score
 * @returns Comparison result (-1, 0, 1)
 */
export function compareGroupsByScore(
  groupA: { participants: Participant[]; score: number },
  groupB: { participants: Participant[]; score: number }
): number {
  // Higher scores first
  if (groupA.score > groupB.score) return -1;
  if (groupA.score < groupB.score) return 1;
  
  // If scores are equal, prefer larger groups
  if (groupA.participants.length > groupB.participants.length) return -1;
  if (groupA.participants.length < groupB.participants.length) return 1;
  
  return 0;
}

/**
 * Calculate diversity score for a group
 * Used for alternative scoring models
 * 
 * @param group - Array of participants
 * @param features - List of features to consider
 * @returns Diversity score (0-1)
 */
export function calculateDiversityScore(
  group: Participant[],
  features: string[] = []
): number {
  if (group.length < 2 || features.length === 0) {
    return 0;
  }
  
  const diversityScores: number[] = [];
  
  for (const feature of features) {
    const values = group
      .map(p => {
        const val = p.responses[feature];
        if (val === null || val === undefined || val === '') return NaN;
        return typeof val === 'number' ? val : parseFloat(val.toString());
      })
      .filter(v => !Number.isNaN(v));
    
    if (values.length > 1) {
      // Calculate variance
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, val) => 
        sum + Math.pow(val - mean, 2), 0
      ) / values.length;
      
      // Normalize variance (assume max variance of 25 for 1-10 scale)
      const normalizedVariance = Math.min(variance / 25, 1);
      diversityScores.push(normalizedVariance);
    }
  }
  
  return diversityScores.length > 0
    ? diversityScores.reduce((a, b) => a + b, 0) / diversityScores.length
    : 0;
}

/**
 * Quick score calculation for optimization
 * Faster version without detailed breakdown
 * 
 * @param group - Array of participants
 * @param targetSize - Target group size
 * @returns Final score only
 */
export function quickScore(
  group: Participant[],
  targetSize: number = 6
): number {
  let score = 1.0;
  
  // Quick penalties
  score -= getAgePenalty(group);
  score -= Math.min(allergyLoadPenalty(group), 0.15);
  
  // Quick bonuses
  if (group.length === targetSize) {
    score += 0.1;
  }
  
  // Simple homogeneity bonus
  const languageMatch = group.every(p => 
    p.responses.meeting_language === group[0].responses.meeting_language
  );
  if (languageMatch) {
    score += 0.05;
  }
  
  return Math.max(0, Math.min(1, score));
}
