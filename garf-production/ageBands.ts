/**
 * Age Band Rules for Grouping Algorithm
 * Implements age-based compatibility checks with band system
 */

import { Participant } from './types';
import { AgeBandConfig, AgeBandDefinition } from './types-enhanced';

/**
 * Default age band configuration
 * Younger participants have stricter windows, older participants more flexible
 */
export const DEFAULT_AGE_BANDS: AgeBandConfig = {
  bands: [
    { name: '18-24', minAge: 18, maxAge: 24, maxSpread: 4, flexible: false },
    { name: '25-29', minAge: 25, maxAge: 29, maxSpread: 5, flexible: false },
    { name: '30-34', minAge: 30, maxAge: 34, maxSpread: 6, flexible: false },
    { name: '35-39', minAge: 35, maxAge: 39, maxSpread: 7, flexible: false },
    { name: '40-44', minAge: 40, maxAge: 44, maxSpread: 8, flexible: false },
    { name: '45-54', minAge: 45, maxAge: 54, maxSpread: 10, flexible: true },
    { name: '55-64', minAge: 55, maxAge: 64, maxSpread: 12, flexible: true },
    { name: '65+', minAge: 65, maxAge: 120, maxSpread: 15, flexible: true }
  ],
  strictMode: false,
  maxCrossBandSpread: 10
};

/**
 * Find which age band a participant belongs to
 * 
 * @param age - The participant's age
 * @param config - Age band configuration
 * @returns The age band definition or null if not found
 */
export function getAgeBand(
  age: number | undefined,
  config: AgeBandConfig = DEFAULT_AGE_BANDS
): AgeBandDefinition | null {
  if (age === undefined || age === null || Number.isNaN(age)) {
    return null;
  }

  for (const band of config.bands) {
    if (age >= band.minAge && age <= band.maxAge) {
      return band;
    }
  }

  return null;
}

/**
 * Check if two participants are in the same age window (pairwise check)
 * 
 * @param ageA - First participant's age
 * @param ageB - Second participant's age
 * @param config - Age band configuration
 * @returns True if ages are compatible
 */
export function inSameAgeWindow(
  ageA: number | undefined,
  ageB: number | undefined,
  config: AgeBandConfig = DEFAULT_AGE_BANDS
): boolean {
  // Handle missing ages
  if (ageA === undefined || ageB === undefined || 
      Number.isNaN(ageA) || Number.isNaN(ageB)) {
    return false;
  }

  const bandA = getAgeBand(ageA, config);
  const bandB = getAgeBand(ageB, config);

  // Both must be in valid bands
  if (!bandA || !bandB) {
    return false;
  }

  const ageDiff = Math.abs(ageA - ageB);

  // Same band check
  if (bandA.name === bandB.name) {
    // Within same band, check max spread
    return ageDiff <= bandA.maxSpread;
  }

  // Cross-band check
  if (!config.strictMode) {
    // Check if bands are adjacent
    const bandsAreAdjacent = 
      Math.abs(config.bands.indexOf(bandA) - config.bands.indexOf(bandB)) === 1;

    if (bandsAreAdjacent) {
      // For adjacent bands, use the more restrictive spread
      const maxSpread = Math.min(bandA.maxSpread, bandB.maxSpread);
      
      // If either band is flexible, add some tolerance
      if (bandA.flexible || bandB.flexible) {
        return ageDiff <= maxSpread + 2;
      }
      
      return ageDiff <= maxSpread;
    }

    // Non-adjacent bands - only allow if both are flexible
    if (bandA.flexible && bandB.flexible) {
      return ageDiff <= (config.maxCrossBandSpread || 10);
    }
  }

  return false;
}

/**
 * Check if a group's age distribution is acceptable (group-level check)
 * 
 * @param group - Array of participants
 * @param config - Age band configuration
 * @returns True if the group's age distribution is acceptable
 */
export function groupAgeOk(
  group: Participant[],
  config: AgeBandConfig = DEFAULT_AGE_BANDS
): boolean {
  // Extract valid ages
  const ages = group
    .map(p => p.age)
    .filter((age): age is number => 
      age !== undefined && age !== null && !Number.isNaN(age)
    );

  // Need at least 2 ages to check
  if (ages.length < 2) {
    return true; // Not enough data to reject
  }

  // Calculate age statistics
  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages);
  const ageSpread = maxAge - minAge;

  // Get bands for min and max ages
  const minBand = getAgeBand(minAge, config);
  const maxBand = getAgeBand(maxAge, config);

  if (!minBand || !maxBand) {
    return false; // Invalid ages
  }

  // Same band - simple spread check
  if (minBand.name === maxBand.name) {
    return ageSpread <= minBand.maxSpread;
  }

  // Cross-band group
  if (config.strictMode) {
    // Strict mode: no cross-band groups
    return false;
  }

  // Check if all participants are in flexible bands
  const allFlexible = ages.every(age => {
    const band = getAgeBand(age, config);
    return band?.flexible === true;
  });

  if (allFlexible) {
    // All in flexible bands - use relaxed spread
    return ageSpread <= (config.maxCrossBandSpread || 10) + 5;
  }

  // Mixed flexible/strict - check pairwise compatibility
  for (let i = 0; i < ages.length; i++) {
    for (let j = i + 1; j < ages.length; j++) {
      if (!inSameAgeWindow(ages[i], ages[j], config)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Calculate age homogeneity score for a group
 * Used for scoring bonuses
 * 
 * @param group - Array of participants
 * @returns Score between 0 and 1 (1 = perfect homogeneity)
 */
export function ageHomogeneityScore(group: Participant[]): number {
  const ages = group
    .map(p => p.age)
    .filter((age): age is number => 
      age !== undefined && age !== null && !Number.isNaN(age)
    );

  if (ages.length < 2) {
    return 1.0; // Perfect homogeneity by default
  }

  // Calculate standard deviation
  const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
  const variance = ages.reduce((sum, age) => 
    sum + Math.pow(age - mean, 2), 0
  ) / ages.length;
  const stdDev = Math.sqrt(variance);

  // Convert to score (lower std dev = higher score)
  // Normalize: 0 std = 1.0 score, 10+ std = 0.0 score
  return Math.max(0, Math.min(1, 1 - (stdDev / 10)));
}

/**
 * Get age penalty for scoring
 * Returns a penalty value based on how much age rules are stretched
 * 
 * @param group - Array of participants
 * @param config - Age band configuration
 * @returns Penalty value (0 = no penalty, higher = more penalty)
 */
export function getAgePenalty(
  group: Participant[],
  config: AgeBandConfig = DEFAULT_AGE_BANDS
): number {
  const ages = group
    .map(p => p.age)
    .filter((age): age is number => 
      age !== undefined && age !== null && !Number.isNaN(age)
    );

  if (ages.length < 2) {
    return 0; // No penalty
  }

  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages);
  const ageSpread = maxAge - minAge;

  // Get bands
  const minBand = getAgeBand(minAge, config);
  const maxBand = getAgeBand(maxAge, config);

  if (!minBand || !maxBand) {
    return 0.2; // High penalty for invalid ages
  }

  // Same band
  if (minBand.name === maxBand.name) {
    if (ageSpread <= minBand.maxSpread) {
      return 0; // No penalty
    }
    // Slightly over spread
    const overSpread = ageSpread - minBand.maxSpread;
    return Math.min(0.1, overSpread * 0.02); // 0.02 per year over
  }

  // Cross-band
  const allFlexible = ages.every(age => {
    const band = getAgeBand(age, config);
    return band?.flexible === true;
  });

  if (allFlexible) {
    // Flexible bands - minimal penalty
    if (ageSpread <= config.maxCrossBandSpread!) {
      return 0.05; // Small penalty for cross-band
    }
    const overSpread = ageSpread - config.maxCrossBandSpread!;
    return Math.min(0.15, 0.05 + overSpread * 0.02);
  }

  // Mixed or non-flexible cross-band - higher penalty
  return 0.1;
}

/**
 * Get detailed age analysis for a group
 * Used for diagnostics and debugging
 * 
 * @param group - Array of participants
 * @param config - Age band configuration
 * @returns Detailed age analysis
 */
export function analyzeGroupAges(
  group: Participant[],
  config: AgeBandConfig = DEFAULT_AGE_BANDS
): {
  valid: boolean;
  ages: number[];
  minAge: number;
  maxAge: number;
  spread: number;
  mean: number;
  stdDev: number;
  bands: string[];
  crossBand: boolean;
  penalty: number;
  homogeneity: number;
} {
  const ages = group
    .map(p => p.age)
    .filter((age): age is number => 
      age !== undefined && age !== null && !Number.isNaN(age)
    );

  if (ages.length === 0) {
    return {
      valid: false,
      ages: [],
      minAge: 0,
      maxAge: 0,
      spread: 0,
      mean: 0,
      stdDev: 0,
      bands: [],
      crossBand: false,
      penalty: 0,
      homogeneity: 1
    };
  }

  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages);
  const spread = maxAge - minAge;
  const mean = ages.reduce((a, b) => a + b, 0) / ages.length;
  
  const variance = ages.reduce((sum, age) => 
    sum + Math.pow(age - mean, 2), 0
  ) / ages.length;
  const stdDev = Math.sqrt(variance);

  const bands = [...new Set(ages.map(age => 
    getAgeBand(age, config)?.name || 'unknown'
  ))];

  return {
    valid: groupAgeOk(group, config),
    ages,
    minAge,
    maxAge,
    spread,
    mean,
    stdDev,
    bands,
    crossBand: bands.length > 1,
    penalty: getAgePenalty(group, config),
    homogeneity: ageHomogeneityScore(group)
  };
}
