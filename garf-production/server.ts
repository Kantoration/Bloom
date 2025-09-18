/**
 * Fastify API Server for Grouping Engine
 * Exposes REST endpoints for grouping operations
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { runGrouping } from './groupingEngineEnhanced';
import { 
  saveRun, 
  getRun, 
  listRuns, 
  fetchParticipants,
  getRunStatistics,
  deleteRun,
  updateRunStatus,
  fetchActivePolicy,
  fetchPolicyById
} from './repo';
import { RunOptions } from './types-enhanced';

/**
 * Initialize and configure Fastify server
 */
const app: FastifyInstance = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    prettyPrint: process.env.NODE_ENV !== 'production'
  }
});

// Register CORS plugin for cross-origin requests (needed for Lovable)
app.register(cors, {
  origin: true, // Allow all origins in development
  credentials: true
});

/**
 * Health check endpoint
 * GET /health
 * 
 * @returns Status object indicating server health
 */
app.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'garf-grouping-engine',
    version: '1.0.0'
  };
});

/**
 * Build groups endpoint - Main grouping operation
 * POST /build-groups
 * 
 * @body RunOptions - Configuration for the grouping run
 * @returns Run summary with groups and statistics
 */
interface BuildGroupsRequest {
  Body: {
    policy_id?: string;
    options?: RunOptions;
  };
}

app.post<BuildGroupsRequest>('/build-groups', async (request, reply) => {
  try {
    const { policy_id, options = {} } = request.body;
    
    // Log the request
    app.log.info({ options }, 'Starting grouping run');
    
    // Fetch participants from database
    const participants = await fetchParticipants(true);
    
    if (participants.length === 0) {
      return reply.status(400).send({
        error: 'No participants found',
        message: 'Please ensure participants are loaded in the database'
      });
    }
    
    app.log.info(`Found ${participants.length} participants`);
    
    // Determine policy
    const policy = policy_id ? await fetchPolicyById(policy_id) : await fetchActivePolicy();
    if (!policy) {
      return reply.status(400).send({
        error: 'No active policy found',
        message: 'Please create and activate a policy, or provide policy_id'
      });
    }

    // Create run with pending status
    const runId = options.runId || generateRunId();
    await updateRunStatus(runId, 'pending');
    
    // Run the grouping algorithm
    await updateRunStatus(runId, 'running');
    const runResult = await runGrouping(participants, {
      kosherOnly: policy.kosher_only,
      minGroupSize: policy.min_group_size,
      targetGroupSize: policy.target_group_size,
      // maxGroupSize left to engine default or provided override
      agePolicy: policy.age_policy as any,
      scoringWeights: policy.scoring_weights as any,
      ...options,
      runId
    });
    
    // Save results to database
    await saveRun(runResult, policy.id);
    await updateRunStatus(runId, 'completed');
    
    app.log.info({
      runId: runResult.runId,
      groups: runResult.groups.length,
      unassigned: runResult.unassigned.length
    }, 'Grouping run completed');
    
    // Return summary and basic results
    return {
      success: true,
      runId: runResult.runId,
      summary: runResult.summary,
      groups: runResult.groups.map(g => ({
        groupId: g.groupId,
        size: g.size,
        score: g.finalScore,
        memberCount: g.memberIds.length
      })),
      unassignedCount: runResult.unassigned.length,
      diagnostics: runResult.diagnostics
    };
  } catch (error) {
    app.log.error(error, 'Failed to build groups');
    
    // Update run status to failed if we have a runId
    if (request.body?.options?.runId) {
      await updateRunStatus(request.body.options.runId, 'failed');
    }
    
    return reply.status(500).send({
      error: 'Failed to build groups',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get specific run details
 * GET /runs/:id
 * 
 * @param id - Run ID to retrieve
 * @returns Full run details with groups and members
 */
interface GetRunRequest {
  Params: {
    id: string;
  };
}

app.get<GetRunRequest>('/runs/:id', async (request, reply) => {
  try {
    const { id } = request.params;
    
    const run = await getRun(id);
    
    if (!run) {
      return reply.status(404).send({
        error: 'Run not found',
        runId: id
      });
    }
    
    // Get additional statistics
    const stats = await getRunStatistics(id);
    
    return {
      ...run,
      statistics: stats
    };
  } catch (error) {
    app.log.error(error, 'Failed to get run');
    return reply.status(500).send({
      error: 'Failed to retrieve run',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * List all runs
 * GET /runs
 * 
 * @query limit - Maximum number of runs to return
 * @query offset - Number of runs to skip
 * @returns List of run summaries
 */
interface ListRunsRequest {
  Querystring: {
    limit?: number;
    offset?: number;
  };
}

app.get<ListRunsRequest>('/runs', async (request, reply) => {
  try {
    const { limit = 50, offset = 0 } = request.query;
    
    const runs = await listRuns(limit, offset);
    
    return {
      runs,
      total: runs.length,
      limit,
      offset
    };
  } catch (error) {
    app.log.error(error, 'Failed to list runs');
    return reply.status(500).send({
      error: 'Failed to list runs',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Delete a run
 * DELETE /runs/:id
 * 
 * @param id - Run ID to delete
 * @returns Success status
 */
interface DeleteRunRequest {
  Params: {
    id: string;
  };
}

app.delete<DeleteRunRequest>('/runs/:id', async (request, reply) => {
  try {
    const { id } = request.params;
    
    const success = await deleteRun(id);
    
    if (!success) {
      return reply.status(404).send({
        error: 'Run not found or could not be deleted',
        runId: id
      });
    }
    
    return {
      success: true,
      message: `Run ${id} deleted successfully`
    };
  } catch (error) {
    app.log.error(error, 'Failed to delete run');
    return reply.status(500).send({
      error: 'Failed to delete run',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get run statistics
 * GET /runs/:id/stats
 * 
 * @param id - Run ID to analyze
 * @returns Detailed statistics for the run
 */
interface GetStatsRequest {
  Params: {
    id: string;
  };
}

app.get<GetStatsRequest>('/runs/:id/stats', async (request, reply) => {
  try {
    const { id } = request.params;
    
    const stats = await getRunStatistics(id);
    
    if (!stats) {
      return reply.status(404).send({
        error: 'Run not found',
        runId: id
      });
    }
    
    return stats;
  } catch (error) {
    app.log.error(error, 'Failed to get run statistics');
    return reply.status(500).send({
      error: 'Failed to get statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Trigger a test run with sample options
 * POST /test-run
 * 
 * @returns Test run results
 */
app.post('/test-run', async (request, reply) => {
  try {
    // Sample test options
    const testOptions: RunOptions = {
      kosherOnly: false,
      targetGroupSize: 6,
      minGroupSize: 4,
      maxGroupSize: 8,
      enableDiagnostics: true,
      exportCSV: false
    };
    
    const participants = await fetchParticipants(true);
    
    if (participants.length < 10) {
      return reply.status(400).send({
        error: 'Insufficient participants for test',
        message: `Need at least 10 participants, found ${participants.length}`
      });
    }
    
    const runResult = await runGrouping(participants, testOptions);
    await saveRun(runResult);
    
    return {
      success: true,
      message: 'Test run completed',
      runId: runResult.runId,
      summary: runResult.summary
    };
  } catch (error) {
    app.log.error(error, 'Test run failed');
    return reply.status(500).send({
      error: 'Test run failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate a unique run ID
 */
function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Start the server
 */
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';
    
    await app.listen({ port, host });
    
    console.log(`
🚀 GARF Grouping Engine API Server
📍 Running at: http://${host}:${port}
📊 Health check: http://${host}:${port}/health
📝 API Endpoints:
   - POST /build-groups     - Run grouping algorithm
   - GET  /runs            - List all runs
   - GET  /runs/:id        - Get run details
   - GET  /runs/:id/stats - Get run statistics
   - DELETE /runs/:id      - Delete a run
   - POST /test-run        - Run a test grouping
    `);
  } catch (err) {
    app.log.error(err, 'Failed to start server');
    process.exit(1);
  }
};

// Export app for testing
export { app };

// Start server if running directly
if (require.main === module) {
  start();
}
