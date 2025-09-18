import { app } from '../server';
import { supabaseAdmin } from '../supabaseClient';

describe('Survey Integration', () => {
  beforeAll(async () => {
    // Ensure app is ready
  });

  afterAll(async () => {
    try { await app.close(); } catch {}
  });

  test('GET /survey/schema returns survey schema', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/survey/schema'
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as any;
    expect(body.success).toBe(true);
    expect(body.schema).toBeDefined();
    expect(body.schema.fields).toBeInstanceOf(Array);
    expect(body.schema.fields.length).toBeGreaterThan(0);
    
    // Check for required fields
    const fieldNames = body.schema.fields.map((f: any) => f.name);
    expect(fieldNames).toContain('email');
    expect(fieldNames).toContain('full_name');
    expect(fieldNames).toContain('age');
    expect(fieldNames).toContain('phone');
  });

  test('POST /survey creates participant and survey response', async () => {
    const testResponse = {
      email: `test-${Date.now()}@example.com`,
      full_name: 'Test User',
      age: 25,
      phone: '050-1234567',
      gender: 'גבר',
      meeting_area: 'מרכז (דיזנגוף, רוטשילד)',
      meeting_days: ['ראשון', 'שני'],
      kosher: 'לא',
      meeting_language: 'עברית בלבד',
      energy_end_day: 7,
      introversion: 5,
      creativity: 8,
      humor_importance: 9
    };

    const response = await app.inject({
      method: 'POST',
      url: '/survey',
      payload: {
        responses: testResponse
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as any;
    expect(body.success).toBe(true);
    expect(body.participantId).toBeDefined();
    expect(body.responseId).toBeDefined();

    // Verify participant was created
    const { data: participant, error: participantError } = await supabaseAdmin
      .from('participants')
      .select('*')
      .eq('id', body.participantId)
      .single();

    expect(participantError).toBeNull();
    expect(participant).toBeDefined();
    expect(participant.email).toBe(testResponse.email);
    expect(participant.name).toBe(testResponse.full_name);
    expect(participant.age).toBe(testResponse.age);
    expect(participant.kosher).toBe(false);

    // Verify survey response was created
    const { data: surveyResponse, error: responseError } = await supabaseAdmin
      .from('survey_responses')
      .select('*')
      .eq('id', body.responseId)
      .single();

    expect(responseError).toBeNull();
    expect(surveyResponse).toBeDefined();
    expect(surveyResponse.participant_id).toBe(body.participantId);
    expect(surveyResponse.responses).toEqual(testResponse);
  });

  test('POST /survey validates required fields', async () => {
    const incompleteResponse = {
      email: 'test@example.com',
      // missing full_name, age, phone
    };

    const response = await app.inject({
      method: 'POST',
      url: '/survey',
      payload: {
        responses: incompleteResponse
      }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json() as any;
    expect(body.error).toBe('Missing required field');
  });

  test('GET /survey/responses returns survey responses', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/survey/responses'
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as any;
    expect(body.success).toBe(true);
    expect(body.responses).toBeInstanceOf(Array);
  });

  test('POST /survey updates existing participant', async () => {
    const email = `update-test-${Date.now()}@example.com`;
    
    // First submission
    const firstResponse = {
      email,
      full_name: 'First Name',
      age: 25,
      phone: '050-1111111',
      meeting_area: 'מרכז (דיזנגוף, רוטשילד)',
      meeting_days: ['ראשון'],
      kosher: 'לא',
      meeting_language: 'עברית בלבד',
      energy_end_day: 5
    };

    await app.inject({
      method: 'POST',
      url: '/survey',
      payload: { responses: firstResponse }
    });

    // Second submission with same email
    const secondResponse = {
      ...firstResponse,
      full_name: 'Updated Name',
      age: 26,
      phone: '050-2222222'
    };

    const response = await app.inject({
      method: 'POST',
      url: '/survey',
      payload: { responses: secondResponse }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as any;
    expect(body.success).toBe(true);

    // Verify participant was updated
    const { data: participant, error: participantError } = await supabaseAdmin
      .from('participants')
      .select('*')
      .eq('email', email)
      .single();

    expect(participantError).toBeNull();
    expect(participant.name).toBe('Updated Name');
    expect(participant.age).toBe(26);
    expect(participant.phone).toBe('050-2222222');
  });
});
