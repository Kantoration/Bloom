/**
 * Diet and Allergy Rules for Grouping Algorithm
 * Handles dietary restrictions and allergy compatibility
 */

import { Participant, SurveyResponse } from './types';
import { 
  DietaryProfile, 
  AllergyProfile, 
  DietCompatibilityResult 
} from './types-enhanced';

/**
 * Maximum number of distinct severe allergies allowed in a group
 */
export const MAX_SEVERE_ALLERGIES_PER_GROUP = 3;

/**
 * Extract dietary profile from participant responses
 * 
 * @param participant - The participant
 * @returns Dietary profile
 */
export function extractDietaryProfile(participant: Participant): DietaryProfile {
  const responses = participant.responses;
  
  // Check kosher field
  const kosher = responses.kosher === 'כן' || 
                  responses.kosher === 'yes' || 
                  responses.kosher === true;

  // Check dietary restrictions field (multi-select)
  const restrictions = extractMultiSelect(responses.dietary_restrictions);
  
  const vegetarian = restrictions.some(r => 
    r.includes('צמחוני') || r.toLowerCase().includes('vegetarian')
  );
  
  const vegan = restrictions.some(r => 
    r.includes('טבעוני') || r.toLowerCase().includes('vegan')
  );
  
  const glutenFree = restrictions.some(r => 
    r.includes('גלוטן') || r.toLowerCase().includes('gluten')
  );

  // Collect other restrictions
  const other = restrictions.filter(r => 
    !r.includes('צמחוני') && !r.includes('טבעוני') && 
    !r.includes('גלוטן') && !r.includes('אין') &&
    !r.toLowerCase().includes('vegetarian') &&
    !r.toLowerCase().includes('vegan') &&
    !r.toLowerCase().includes('gluten') &&
    !r.toLowerCase().includes('none')
  );

  return {
    kosher,
    vegetarian,
    vegan,
    glutenFree,
    other: other.length > 0 ? other : undefined
  };
}

/**
 * Extract allergy profile from participant responses
 * 
 * @param participant - The participant
 * @returns Allergy profile
 */
export function extractAllergyProfile(participant: Participant): AllergyProfile {
  const responses = participant.responses;
  
  // Check for allergies in dietary_restrictions field
  const restrictions = extractMultiSelect(responses.dietary_restrictions);
  const allergyItems = restrictions.filter(r => 
    r.includes('אלרגי') || r.toLowerCase().includes('allerg')
  );

  // Check for specific allergy field if exists
  const specificAllergies = extractMultiSelect(responses.allergies);
  
  // Combine all allergies
  const allAllergies = [...allergyItems, ...specificAllergies];
  
  // Parse severity (default to moderate if not specified)
  const severity: Record<string, 'mild' | 'moderate' | 'severe'> = {};
  
  allAllergies.forEach(allergy => {
    // Look for severity indicators
    if (allergy.includes('חמור') || allergy.toLowerCase().includes('severe')) {
      severity[allergy] = 'severe';
    } else if (allergy.includes('קל') || allergy.toLowerCase().includes('mild')) {
      severity[allergy] = 'mild';
    } else {
      severity[allergy] = 'moderate';
    }
  });

  return {
    allergies: allAllergies,
    severity
  };
}

/**
 * Helper to extract multi-select values from response
 * 
 * @param value - Response value
 * @returns Array of string values
 */
function extractMultiSelect(value: any): string[] {
  if (!value) return [];
  
  if (Array.isArray(value)) {
    return value.map(v => v.toString()).filter(v => v !== '');
  }
  
  if (typeof value === 'string') {
    return value.split(',').map(v => v.trim()).filter(v => v !== '');
  }
  
  return [];
}

/**
 * Check if two participants are diet-compatible
 * 
 * @param a - First participant
 * @param b - Second participant
 * @returns True if diet-compatible
 */
export function isDietCompatible(
  a: Participant,
  b: Participant
): boolean {
  const dietA = extractDietaryProfile(a);
  const dietB = extractDietaryProfile(b);
  
  // Kosher compatibility - if one needs kosher, venue must be kosher
  // This is more of a venue constraint than interpersonal
  // For interpersonal, we're more flexible
  
  // Vegan/vegetarian compatibility
  // Generally compatible unless there's a strong preference against
  
  // For now, consider all diets compatible at the interpersonal level
  // The venue selection will handle the actual dietary requirements
  return true;
}

/**
 * Check diet compatibility for entire group
 * 
 * @param group - Array of participants
 * @returns Compatibility result with details
 */
export function checkGroupDietCompatibility(
  group: Participant[]
): DietCompatibilityResult {
  const diets = group.map(p => extractDietaryProfile(p));
  
  // Check if there's a kosher requirement
  const hasKosher = diets.some(d => d.kosher);
  const hasNonKosher = diets.some(d => !d.kosher);
  
  // In a mixed group, the venue needs to be kosher if anyone needs it
  // This is acceptable as long as the venue can accommodate
  
  const issues: string[] = [];
  
  // Count dietary restrictions
  const vegetarianCount = diets.filter(d => d.vegetarian).length;
  const veganCount = diets.filter(d => d.vegan).length;
  const glutenFreeCount = diets.filter(d => d.glutenFree).length;
  
  // If more than half the group has the same restriction, note it
  if (vegetarianCount > group.length / 2) {
    issues.push(`High vegetarian concentration (${vegetarianCount}/${group.length})`);
  }
  if (veganCount > group.length / 2) {
    issues.push(`High vegan concentration (${veganCount}/${group.length})`);
  }
  if (glutenFreeCount > group.length / 2) {
    issues.push(`High gluten-free concentration (${glutenFreeCount}/${group.length})`);
  }
  
  return {
    compatible: true, // Generally compatible, venue will handle specifics
    issues: issues.length > 0 ? issues : undefined
  };
}

/**
 * Calculate allergy load penalty for a group
 * 
 * @param group - Array of participants
 * @returns Penalty value (0 = no allergies, higher = more problematic)
 */
export function allergyLoadPenalty(group: Participant[]): number {
  const allergyProfiles = group.map(p => extractAllergyProfile(p));
  
  // Count unique severe allergies
  const severeAllergies = new Set<string>();
  const moderateAllergies = new Set<string>();
  const mildAllergies = new Set<string>();
  
  allergyProfiles.forEach(profile => {
    profile.allergies.forEach(allergy => {
      const severity = profile.severity[allergy];
      if (severity === 'severe') {
        severeAllergies.add(allergy);
      } else if (severity === 'moderate') {
        moderateAllergies.add(allergy);
      } else {
        mildAllergies.add(allergy);
      }
    });
  });
  
  let penalty = 0;
  
  // Severe allergies - 0.05 penalty each
  penalty += severeAllergies.size * 0.05;
  
  // Hard limit on severe allergies
  if (severeAllergies.size > MAX_SEVERE_ALLERGIES_PER_GROUP) {
    penalty += 0.5; // Large penalty for exceeding limit
  }
  
  // Moderate allergies - 0.02 penalty each
  penalty += moderateAllergies.size * 0.02;
  
  // Mild allergies - 0.01 penalty each
  penalty += mildAllergies.size * 0.01;
  
  // Additional penalty if too many people have allergies
  const participantsWithAllergies = allergyProfiles.filter(
    p => p.allergies.length > 0
  ).length;
  
  if (participantsWithAllergies > group.length * 0.5) {
    penalty += 0.1; // Penalty if more than half have allergies
  }
  
  return penalty;
}

/**
 * Check if group exceeds allergy limits
 * 
 * @param group - Array of participants
 * @returns True if within limits
 */
export function groupAllergyOk(group: Participant[]): boolean {
  const allergyProfiles = group.map(p => extractAllergyProfile(p));
  
  // Count unique severe allergies
  const severeAllergies = new Set<string>();
  
  allergyProfiles.forEach(profile => {
    profile.allergies.forEach(allergy => {
      if (profile.severity[allergy] === 'severe') {
        severeAllergies.add(allergy);
      }
    });
  });
  
  return severeAllergies.size <= MAX_SEVERE_ALLERGIES_PER_GROUP;
}

/**
 * Get dietary homogeneity score for a group
 * Used for scoring bonuses
 * 
 * @param group - Array of participants
 * @returns Score between 0 and 1 (1 = all same diet)
 */
export function dietaryHomogeneityScore(group: Participant[]): number {
  const diets = group.map(p => extractDietaryProfile(p));
  
  if (diets.length < 2) {
    return 1.0;
  }
  
  let score = 0;
  let comparisons = 0;
  
  // Compare all pairs
  for (let i = 0; i < diets.length; i++) {
    for (let j = i + 1; j < diets.length; j++) {
      comparisons++;
      
      // Check similarity
      if (diets[i].kosher === diets[j].kosher) score += 0.25;
      if (diets[i].vegetarian === diets[j].vegetarian) score += 0.25;
      if (diets[i].vegan === diets[j].vegan) score += 0.25;
      if (diets[i].glutenFree === diets[j].glutenFree) score += 0.25;
    }
  }
  
  return comparisons > 0 ? score / comparisons : 1.0;
}

/**
 * Analyze dietary composition of a group
 * Used for diagnostics
 * 
 * @param group - Array of participants
 * @returns Dietary analysis
 */
export function analyzeGroupDiet(group: Participant[]): {
  kosherCount: number;
  vegetarianCount: number;
  veganCount: number;
  glutenFreeCount: number;
  allergiesCount: number;
  severeAllergiesCount: number;
  uniqueAllergies: string[];
  dietHomogeneity: number;
  allergyPenalty: number;
  withinAllergyLimit: boolean;
} {
  const diets = group.map(p => extractDietaryProfile(p));
  const allergies = group.map(p => extractAllergyProfile(p));
  
  const allUniqueAllergies = new Set<string>();
  const severeAllergies = new Set<string>();
  
  allergies.forEach(profile => {
    profile.allergies.forEach(allergy => {
      allUniqueAllergies.add(allergy);
      if (profile.severity[allergy] === 'severe') {
        severeAllergies.add(allergy);
      }
    });
  });
  
  return {
    kosherCount: diets.filter(d => d.kosher).length,
    vegetarianCount: diets.filter(d => d.vegetarian).length,
    veganCount: diets.filter(d => d.vegan).length,
    glutenFreeCount: diets.filter(d => d.glutenFree).length,
    allergiesCount: allergies.filter(a => a.allergies.length > 0).length,
    severeAllergiesCount: severeAllergies.size,
    uniqueAllergies: Array.from(allUniqueAllergies),
    dietHomogeneity: dietaryHomogeneityScore(group),
    allergyPenalty: allergyLoadPenalty(group),
    withinAllergyLimit: groupAllergyOk(group)
  };
}

/**
 * Check if participant should be filtered for kosher-only run
 * 
 * @param participant - The participant
 * @returns True if participant is kosher or doesn't care
 */
export function isKosherCompatible(participant: Participant): boolean {
  const diet = extractDietaryProfile(participant);
  
  // If they explicitly need kosher, they're compatible
  if (diet.kosher) return true;
  
  // Check if they have "doesn't matter" or flexible response
  const kosherResponse = participant.responses.kosher;
  if (!kosherResponse) return true; // No preference stated
  
  const flexibleResponses = ['לא משנה', 'לא חשוב', 'גמיש', 'flexible', "doesn't matter"];
  if (typeof kosherResponse === 'string') {
    return flexibleResponses.some(flex => 
      kosherResponse.toLowerCase().includes(flex.toLowerCase())
    );
  }
  
  return false;
}
