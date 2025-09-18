/**
 * Repository Layer for Supabase Data Persistence
 * Handles all database operations for the grouping engine
 */

import { supabaseAdmin, Database } from './supabaseClient';
import { Participant } from './types';
import { 
  RunResult, 
  GroupResult, 
  UnassignedParticipant,
  RunSummary,
  RunOptions
} from './types-enhanced';

export interface GroupingPolicyRecord {
  id: string;
  name: string;
  kosher_only: boolean;
  min_group_size: number;
  target_group_size: number;
  max_allergy_count: number;
  age_policy: 'banded' | 'loose' | string;
  scoring_weights: Record<string, any>;
  created_at: string;
  is_active: boolean;
}

export interface RunSummaryWithPolicy extends RunSummary {
  runId: string;
  createdAt: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  policyId?: string | null;
  policyName?: string | null;
}

/**
 * Save a complete run result to Supabase
 * Persists runs, groups, group_members, and unassigned_queue
 * 
 * @param run - The complete run result from the grouping engine
 * @returns Promise that resolves when save is complete
 */
export async function saveRun(run: RunResult, policyId?: string): Promise<void> {
  try {
    // Start a transaction-like operation
    // Note: Supabase doesn't support true transactions in JS client,
    // so we'll do our best with error handling
    
    // 1. Save the run record
    const { error: runError } = await supabaseAdmin
      .from('runs')
      .insert({
        id: run.runId,
        created_at: run.createdAt.toISOString(),
        options: run.summary as any, // Store summary in options for now
        summary: {
          totalGroups: run.summary.totalGroups,
          totalParticipants: run.summary.totalParticipants,
          groupedParticipants: run.summary.groupedParticipants,
          unassignedParticipants: run.summary.unassignedParticipants,
          averageGroupSize: run.summary.averageGroupSize,
          averageGroupScore: run.summary.averageGroupScore,
          processingTimeMs: run.summary.processingTimeMs
        },
        policy_id: policyId ?? null,
        status: 'completed'
      });

    if (runError) {
      throw new Error(`Failed to save run: ${runError.message}`);
    }

    // 2. Save groups and their members
    for (const group of run.groups) {
      // Save group
      const { data: groupData, error: groupError } = await supabaseAdmin
        .from('groups')
        .insert({
          id: group.groupId,
          run_id: run.runId,
          score: group.finalScore,
          size: group.size,
          metadata: {
            locked: group.locked,
            explanation: group.explanation
          }
        })
        .select()
        .single();

      if (groupError) {
        console.error(`Failed to save group ${group.groupId}:`, groupError);
        continue;
      }

      // Save group members
      const memberInserts = group.memberIds
        .map(memberIndex => {
          const participantId = run.indexToIdMap[memberIndex];
          if (!participantId) {
            console.warn(`Missing indexToIdMap for member index ${memberIndex}; skipping`);
            return null;
          }
          return {
            group_id: group.groupId,
            participant_id: participantId,
            role: null as string | null
          };
        })
        .filter(Boolean) as Array<{ group_id: string; participant_id: string; role: string | null }>;

      if (memberInserts.length > 0) {
        const { error: membersError } = await supabaseAdmin
          .from('group_members')
          .insert(memberInserts);

        if (membersError) {
          console.error(`Failed to save members for group ${group.groupId}:`, membersError);
        }
      }
    }

    // 3. Save unassigned participants
    const unassignedInserts = run.unassigned
      .map(u => {
        const participantId = run.indexToIdMap[u.participantId];
        if (!participantId) {
          console.warn(`Missing indexToIdMap for unassigned index ${u.participantId}; skipping`);
          return null;
        }
        return {
          run_id: run.runId,
          participant_id: participantId,
          reason: u.reason,
          details: u.details
        };
      })
      .filter(Boolean) as Array<{ run_id: string; participant_id: string; reason: string; details?: string }>;

    if (unassignedInserts.length > 0) {
      const { error: unassignedError } = await supabaseAdmin
        .from('unassigned_queue')
        .insert(unassignedInserts);

      if (unassignedError) {
        console.error('Failed to save unassigned participants:', unassignedError);
      }
    }

    console.log(`Successfully saved run ${run.runId} with ${run.groups.length} groups`);
  } catch (error) {
    console.error('Error saving run:', error);
    throw error;
  }
}

/**
 * Retrieve a complete run result from Supabase
 * Fetches and reconstructs the full run with groups and members
 * 
 * @param runId - The ID of the run to retrieve
 * @returns Complete run result or null if not found
 */
export async function getRun(runId: string): Promise<RunResult | null> {
  try {
    // 1. Fetch the run
    const { data: runData, error: runError } = await supabaseAdmin
      .from('runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (runError || !runData) {
      console.error('Run not found:', runError);
      return null;
    }

    // 2. Fetch groups for this run
    const { data: groupsData, error: groupsError } = await supabaseAdmin
      .from('groups')
      .select(`
        *,
        group_members (
          participant_id,
          role
        )
      `)
      .eq('run_id', runId);

    if (groupsError) {
      console.error('Failed to fetch groups:', groupsError);
      return null;
    }

    // 3. Fetch unassigned participants
    const { data: unassignedData, error: unassignedError } = await supabaseAdmin
      .from('unassigned_queue')
      .select('*')
      .eq('run_id', runId);

    if (unassignedError) {
      console.error('Failed to fetch unassigned:', unassignedError);
    }

    // 4. Reconstruct the RunResult
    const groups: GroupResult[] = (groupsData || []).map(g => ({
      runId: runId,
      groupId: g.id,
      members: g.group_members?.map((m: any) => parseInt(m.participant_id)) || [],
      memberIds: g.group_members?.map((m: any) => parseInt(m.participant_id)) || [],
      score: g.score,
      finalScore: g.score,
      size: g.size || g.group_members?.length || 0,
      locked: g.metadata?.locked,
      explanation: g.metadata?.explanation
    }));

    // Note: We're not fetching full participant data here
    // In a real app, you'd join with participants table
    const unassigned: UnassignedParticipant[] = (unassignedData || []).map(u => ({
      participantId: parseInt(u.participant_id),
      participant: {} as Participant, // Would need to fetch actual participant
      reason: u.reason as any,
      details: u.details
    }));

    const result: RunResult = {
      runId: runData.id,
      groups,
      unassigned,
      summary: runData.summary as RunSummary,
      createdAt: new Date(runData.created_at)
    };

    return result;
  } catch (error) {
    console.error('Error fetching run:', error);
    return null;
  }
}

/**
 * Fetch the currently active grouping policy
 */
export async function fetchActivePolicy(): Promise<GroupingPolicyRecord | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('grouping_policies')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch active policy:', error);
      return null;
    }

    return data as GroupingPolicyRecord | null;
  } catch (error) {
    console.error('Error fetching active policy:', error);
    return null;
  }
}

/**
 * Fetch a grouping policy by ID
 */
export async function fetchPolicyById(id: string): Promise<GroupingPolicyRecord | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('grouping_policies')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Failed to fetch policy by id:', error);
      return null;
    }

    return data as GroupingPolicyRecord;
  } catch (error) {
    console.error('Error fetching policy by id:', error);
    return null;
  }
}

/**
 * List all runs with summary statistics
 * 
 * @param limit - Maximum number of runs to return (default 50)
 * @param offset - Number of runs to skip (for pagination)
 * @returns Array of run summaries
 */
export async function listRuns(
  limit: number = 50,
  offset: number = 0
): Promise<RunSummaryWithPolicy[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('runs')
      .select('id, created_at, summary, status, policy_id')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Failed to list runs:', error);
      return [];
    }

    const runs = data || [];
    const policyIds = Array.from(new Set(runs.map(r => r.policy_id).filter(Boolean))) as string[];
    let policyMap: Record<string, GroupingPolicyRecord> = {};
    if (policyIds.length > 0) {
      const { data: policies, error: policiesError } = await supabaseAdmin
        .from('grouping_policies')
        .select('*')
        .in('id', policyIds);
      if (policiesError) {
        console.error('Failed to fetch policies for runs:', policiesError);
      } else {
        policyMap = (policies || []).reduce((acc, p) => {
          acc[p.id] = p as GroupingPolicyRecord;
          return acc;
        }, {} as Record<string, GroupingPolicyRecord>);
      }
    }

    return runs.map(run => ({
      ...run.summary,
      runId: run.id,
      createdAt: run.created_at,
      status: run.status,
      policyId: run.policy_id ?? null,
      policyName: run.policy_id ? policyMap[run.policy_id]?.name ?? null : null
    }));
  } catch (error) {
    console.error('Error listing runs:', error);
    return [];
  }
}

/**
 * Fetch all participants from the database
 * Converts database format to Participant type for the engine
 * 
 * @param activeOnly - Whether to fetch only active participants
 * @returns Array of participants
 */
export async function fetchParticipants(
  activeOnly: boolean = true
): Promise<Participant[]> {
  try {
    let query = supabaseAdmin
      .from('participants')
      .select('*');

    // Add any filtering logic here
    // For example, filter by active status if such field exists

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch participants:', error);
      return [];
    }

    // Convert database format to Participant type
    return (data || []).map(p => ({
      id: Math.abs(hashStringToInt(p.id)), // stable numeric index for engine
      email: p.email || '',
      full_name: p.name,
      age: p.age,
      source_uuid: p.id, // keep original Supabase UUID
      responses: {
        ...p.responses,
        kosher: p.kosher,
        email: p.email,
        age: p.age,
        full_name: p.name
      }
    }));
  } catch (error) {
    console.error('Error fetching participants:', error);
    return [];
  }
}

// Helper to generate a stable numeric ID from a UUID string for internal indexing
function hashStringToInt(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const chr = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
}

/**
 * Save participants to the database
 * Used to import or update participant data
 * 
 * @param participants - Array of participants to save
 * @returns Number of participants saved
 */
export async function saveParticipants(
  participants: Participant[]
): Promise<number> {
  try {
    const inserts = participants.map(p => ({
      name: p.full_name,
      email: p.email,
      age: p.age,
      kosher: p.responses.kosher === true || p.responses.kosher === 'כן',
      responses: p.responses
    }));

    const { data, error } = await supabaseAdmin
      .from('participants')
      .upsert(inserts, {
        onConflict: 'email', // Assuming email is unique
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Failed to save participants:', error);
      return 0;
    }

    return data?.length || inserts.length;
  } catch (error) {
    console.error('Error saving participants:', error);
    return 0;
  }
}

/**
 * Get statistics for a specific run
 * Provides detailed analytics about the grouping results
 * 
 * @param runId - The run ID to analyze
 * @returns Statistics object or null
 */
export async function getRunStatistics(runId: string): Promise<{
  totalGroups: number;
  totalParticipants: number;
  avgGroupSize: number;
  avgScore: number;
  groupSizeDistribution: Record<number, number>;
  reasonDistribution: Record<string, number>;
} | null> {
  try {
    // Get groups statistics
    const { data: groupStats, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('score, size')
      .eq('run_id', runId);

    if (groupError) {
      console.error('Failed to get group stats:', groupError);
      return null;
    }

    // Get unassigned statistics
    const { data: unassignedStats, error: unassignedError } = await supabaseAdmin
      .from('unassigned_queue')
      .select('reason')
      .eq('run_id', runId);

    if (unassignedError) {
      console.error('Failed to get unassigned stats:', unassignedError);
    }

    // Calculate statistics
    const groups = groupStats || [];
    const unassigned = unassignedStats || [];

    const totalGroups = groups.length;
    const totalParticipants = groups.reduce((sum, g) => sum + (g.size || 0), 0) + unassigned.length;
    const avgGroupSize = totalGroups > 0 ? 
      groups.reduce((sum, g) => sum + (g.size || 0), 0) / totalGroups : 0;
    const avgScore = totalGroups > 0 ?
      groups.reduce((sum, g) => sum + g.score, 0) / totalGroups : 0;

    // Group size distribution
    const groupSizeDistribution: Record<number, number> = {};
    groups.forEach(g => {
      const size = g.size || 0;
      groupSizeDistribution[size] = (groupSizeDistribution[size] || 0) + 1;
    });

    // Reason distribution
    const reasonDistribution: Record<string, number> = {};
    unassigned.forEach(u => {
      reasonDistribution[u.reason] = (reasonDistribution[u.reason] || 0) + 1;
    });

    return {
      totalGroups,
      totalParticipants,
      avgGroupSize,
      avgScore,
      groupSizeDistribution,
      reasonDistribution
    };
  } catch (error) {
    console.error('Error getting run statistics:', error);
    return null;
  }
}

/**
 * Delete a run and all associated data
 * Cascades to delete groups, members, and unassigned queue entries
 * 
 * @param runId - The run ID to delete
 * @returns True if successful
 */
export async function deleteRun(runId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('runs')
      .delete()
      .eq('id', runId);

    if (error) {
      console.error('Failed to delete run:', error);
      return false;
    }

    console.log(`Successfully deleted run ${runId}`);
    return true;
  } catch (error) {
    console.error('Error deleting run:', error);
    return false;
  }
}

/**
 * Update run status
 * Used to track run progress (pending, running, completed, failed)
 * 
 * @param runId - The run ID to update
 * @param status - New status
 * @returns True if successful
 */
export async function updateRunStatus(
  runId: string,
  status: 'pending' | 'running' | 'completed' | 'failed'
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('runs')
      .update({ status })
      .eq('id', runId);

    if (error) {
      console.error('Failed to update run status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating run status:', error);
    return false;
  }
}
