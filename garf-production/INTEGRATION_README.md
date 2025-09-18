# GARF Grouping Engine - Supabase + Lovable Integration

## 🚀 Complete Integration Package

This package provides a full integration between the TypeScript grouping engine, Supabase database, and Lovable UI framework.

## 📦 Components

### 1. **Supabase Client** (`supabaseClient.ts`)
- Configured Supabase client with auth
- Type-safe database interfaces
- Support for both anon and service role keys

### 2. **Repository Layer** (`repo.ts`)
- `saveRun()` - Persist complete run results
- `getRun()` - Fetch run with all details
- `listRuns()` - List run summaries
- `fetchParticipants()` - Get participants from database
- `getRunStatistics()` - Detailed analytics
- Full CRUD operations for all entities

### 3. **API Server** (`server.ts`)
- Fastify-based REST API
- Endpoints:
  - `POST /build-groups` - Run grouping algorithm
  - `GET /runs` - List all runs
  - `GET /runs/:id` - Get run details
  - `GET /runs/:id/stats` - Get statistics
  - `DELETE /runs/:id` - Delete a run
  - `POST /test-run` - Run test grouping
  - `GET /health` - Health check

### 4. **Database Schema** (`schema.sql`)
- Complete Supabase schema
- Tables: `participants`, `runs`, `groups`, `group_members`, `unassigned_queue`
- Views for dashboards: `run_statistics`, `group_details`, etc.
- Row Level Security policies
- Functions for complex queries

### 5. **Lovable Configuration** (`lovable-config.json`)
- Auto-generated UI dashboards
- Form actions for running grouping
- Data visualization widgets
- Real-time updates

## 🛠️ Setup Instructions

### 1. Install Dependencies
```bash
cd garf-production
npm install
```

### 2. Configure Environment
```bash
cp .env.template .env
# Edit .env with your Supabase credentials
```

### 3. Setup Database
```bash
# Run migrations in Supabase SQL editor
# Copy contents of schema.sql and execute
```

### 4. Build TypeScript
```bash
npm run build
```

### 5. Start Server
```bash
npm run dev  # Development with hot reload
# or
npm start    # Production
```

## 🎯 Usage

### Running a Grouping

#### Via API:
```bash
curl -X POST http://localhost:3000/build-groups \
  -H "Content-Type: application/json" \
  -d '{
    "options": {
      "kosherOnly": true,
      "targetGroupSize": 6,
      "minGroupSize": 4,
      "enableDiagnostics": true
    }
  }'
```

#### Via Lovable UI:
1. Navigate to your Lovable dashboard
2. Click "Run Grouping" button
3. Configure options in the form
4. Submit to trigger grouping
5. View results in real-time

### Viewing Results

#### API:
```bash
# List all runs
curl http://localhost:3000/runs

# Get specific run
curl http://localhost:3000/runs/{runId}

# Get statistics
curl http://localhost:3000/runs/{runId}/stats
```

#### Lovable Dashboard:
- **Overview**: System statistics and recent runs
- **Runs**: History of all grouping runs
- **Groups**: View all groups with members
- **Participants**: Manage participant data
- **Unassigned**: Track unassigned participants

## 📊 Lovable Features

### Auto-Generated Dashboards
- Tables with search, sort, and filter
- Charts and statistics widgets
- Real-time data updates
- CRUD operations

### Custom Actions
- **Run Grouping**: Form-based grouping configuration
- **Test Run**: Quick test with default settings
- **View Details**: Drill-down into run data
- **Export**: Download results as CSV

### Data Visualization
- Group size distribution
- Score distribution
- Unassigned reasons pie chart
- Time-series of runs

## 🔒 Security

### Row Level Security
- Authenticated users can read all data
- Only admins/service role can write
- Participant data protected

### API Security
- CORS configured for Lovable
- Rate limiting available
- Request validation

## 📈 Performance

### Optimizations
- Indexed database queries
- Cached compatibility matrices
- Batch operations for large datasets
- Async processing for long runs

## 🧪 Testing

### Run Test Suite
```bash
npm test
```

### Test Grouping
```bash
curl -X POST http://localhost:3000/test-run
```

## 🚢 Deployment

### Supabase Edge Functions
1. Deploy schema to Supabase
2. Deploy API as Edge Function
3. Configure environment variables
4. Update Lovable config with production URLs

> Note: Docker and Python services have been removed. Use `npm run dev` for local development and deploy via your preferred Node hosting.

## 📝 API Documentation

### POST /build-groups
**Body:**
```json
{
  "options": {
    "kosherOnly": boolean,
    "targetGroupSize": number,
    "minGroupSize": number,
    "maxGroupSize": number,
    "enableDiagnostics": boolean
  }
}
```

**Response:**
```json
{
  "success": true,
  "runId": "uuid",
  "summary": {
    "totalGroups": 10,
    "groupedParticipants": 60,
    "unassignedParticipants": 5,
    "averageGroupScore": 0.85
  },
  "groups": [...],
  "diagnostics": {...}
}
```

## 🤝 Integration Points

### Supabase → Lovable
- Real-time subscriptions for live updates
- Automatic UI generation from schema
- Built-in auth integration

### API → Supabase
- Direct database access via client
- Transactional operations
- Batch inserts for performance

### Lovable → API
- Form submissions trigger API calls
- Results displayed in dashboards
- WebSocket support for progress

## 📚 Resources

- [Supabase Docs](https://supabase.com/docs)
- [Lovable Documentation](https://lovable.dev/docs)
- [Fastify Guide](https://www.fastify.io/docs/latest/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🐛 Troubleshooting

### Common Issues

1. **Connection Error**: Check Supabase URL and keys
2. **No Participants**: Ensure participants table has data
3. **Grouping Fails**: Check constraints and participant compatibility
4. **UI Not Updating**: Verify Lovable WebSocket connection

### Debug Mode
```bash
LOG_LEVEL=debug npm run dev
```

## 📄 License

MIT License - See LICENSE file for details
