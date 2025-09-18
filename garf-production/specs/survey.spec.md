# Survey Integration Specification

## Overview
Dynamic survey system that allows users to submit responses which are automatically converted into participants for the grouping engine. The survey is driven by a schema definition and integrates with the TypeScript + Supabase + Lovable stack.

## Goals
- Allow users to fill out surveys through a dynamic Next.js frontend
- Store survey responses in Supabase with proper relationships
- Convert survey responses into participants for grouping runs
- Provide admin dashboards in Lovable to view and manage survey responses
- Support participant updates (same email = update existing participant)

## Technical Implementation

### Database Schema
```sql
-- Survey responses table
CREATE TABLE survey_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  responses JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_survey_responses_participant_id ON survey_responses(participant_id);
CREATE INDEX idx_survey_responses_created_at ON survey_responses(created_at DESC);

-- Link participants to survey responses
ALTER TABLE participants ADD COLUMN survey_response_id UUID REFERENCES survey_responses(id);
```

### Survey Schema Structure
The survey is defined by a schema with the following field types:
- `text` - Text input
- `email` - Email validation
- `phone` - Phone number
- `number` - Numeric input with min/max
- `single_select` - Radio buttons/dropdown
- `multi_select` - Checkboxes with optional max_select
- `scale` - Slider (1-10 scale)

Each field has:
- `name` - Field identifier
- `label` - Display text (Hebrew/English)
- `type` - Field type
- `required` - Validation requirement
- `role` - Purpose (identifier, hard_constraint, soft_constraint, explain_only)
- `options` - Available choices (for select fields)
- `min`/`max` - Range constraints (for number/scale)

### Repository Layer (`repo.ts`)
- `saveSurveyResponse(responses)` - Creates/updates participant and saves survey response
- `fetchSurveyResponses(limit, offset)` - Retrieves survey responses with participant joins
- Handles participant deduplication by email
- Links survey responses to participants via foreign key

### API Layer (`server.ts`)
- `GET /survey/schema` - Returns survey schema for dynamic form rendering
- `POST /survey` - Accepts survey responses, validates required fields, saves to database
- `GET /survey/responses` - Admin endpoint to view all survey responses

### Frontend (`frontend/src/app/survey/page.tsx`)
- Fetches schema dynamically from API
- Renders form fields based on schema definition
- Validates required fields using Zod
- Submits responses to API endpoint
- Redirects to thank-you page on success

### Lovable Integration (`lovable-config.json`)
- `survey_responses` table configuration
- "Survey Responses" dashboard with searchable, sortable table
- Participant relationship for easy joins
- JSON field display for survey responses

## Data Flow
1. User visits `/survey` page
2. Frontend fetches schema from `GET /survey/schema`
3. Dynamic form is rendered based on schema
4. User fills out form and submits
5. Frontend sends data to `POST /survey`
6. API validates required fields
7. Repository creates/updates participant record
8. Repository saves survey response with participant link
9. Success response returned to frontend
10. User redirected to thank-you page

## Validation Rules
- Required fields: `email`, `full_name`, `age`, `phone`
- Email format validation
- Age range: 18-120
- Phone number format validation
- Multi-select max selection limits

## Integration with Grouping Engine
- Survey responses automatically populate `participants` table
- Participant data includes: name, email, phone, age, kosher status
- Full survey responses stored in `responses` JSONB field
- Grouping engine can access both structured participant data and full survey responses
- Survey response ID linked to participant for traceability

## Admin Features
- View all survey responses in Lovable dashboard
- Search by participant ID
- Sort by creation date
- View full JSON response data
- Link to participant details

## Testing
- Integration tests cover schema endpoint
- Survey submission creates participant and response records
- Required field validation
- Participant updates for existing emails
- Survey responses listing

## Security Considerations
- Input validation on all fields
- SQL injection prevention via parameterized queries
- Email deduplication prevents duplicate participants
- CORS configuration for frontend access
- Rate limiting considerations for production

## Future Enhancements
- Survey versioning support
- Conditional field display based on previous answers
- File upload support for additional data
- Survey analytics and reporting
- Email notifications for survey completion
- Survey response export functionality
