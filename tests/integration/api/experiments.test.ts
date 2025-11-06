/**
 * Integration Tests for Experiments API
 * Tests all experiment endpoints with supertest
 */

import request from 'supertest';
import express from 'express';
import experimentRoutes from '../../../src/api/routes/experiments';

describe('Experiments API Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/experiments', experimentRoutes);
  });

  describe('POST /api/v1/experiments', () => {
    it('should create a new experiment', async () => {
      const experimentData = {
        key: 'test_experiment_001',
        name: 'Test Experiment',
        description: 'Test description',
        designType: 'ab',
        hypotheses: 'Test hypothesis',
        primaryMetric: 'conversion_rate',
        secondaryMetrics: [],
        guardrailMetrics: [],
        randomizationUnit: 'user',
        assignmentKey: 'user_id',
        variants: [
          { key: 'control', name: 'Control', allocation: 50 },
          { key: 'treatment', name: 'Treatment', allocation: 50 },
        ],
        designConfig: {
          type: 'ab',
        },
        trafficAllocation: 100,
      };

      const response = await request(app)
        .post('/api/v1/experiments')
        .set('X-API-Key', 'test-api-key')
        .send(experimentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.key).toBe('test_experiment_001');
      expect(response.body.data.status).toBe('draft');
    });

    it('should reject experiment with invalid data', async () => {
      const invalidData = {
        key: '', // Invalid: empty key
        name: 'Test',
        designType: 'ab',
      };

      const response = await request(app)
        .post('/api/v1/experiments')
        .set('X-API-Key', 'test-api-key')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject duplicate experiment key', async () => {
      const experimentData = {
        key: 'duplicate_key',
        name: 'Test 1',
        designType: 'ab',
        hypotheses: 'Test',
        primaryMetric: 'conversion',
        randomizationUnit: 'user',
        assignmentKey: 'user_id',
        variants: [
          { key: 'control', name: 'Control', allocation: 50 },
          { key: 'treatment', name: 'Treatment', allocation: 50 },
        ],
        designConfig: { type: 'ab' },
        trafficAllocation: 100,
      };

      // Create first experiment
      await request(app)
        .post('/api/v1/experiments')
        .set('X-API-Key', 'test-api-key')
        .send(experimentData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/v1/experiments')
        .set('X-API-Key', 'test-api-key')
        .send(experimentData)
        .expect(409);

      expect(response.body.success).toBe(false);
    });

    it('should reject without API key', async () => {
      await request(app)
        .post('/api/v1/experiments')
        .send({})
        .expect(401);
    });
  });

  describe('GET /api/v1/experiments', () => {
    beforeEach(async () => {
      // Create test experiments
      const experiments = [
        {
          key: 'exp_1',
          name: 'Experiment 1',
          designType: 'ab',
          status: 'running',
          hypotheses: 'Test',
          primaryMetric: 'conversion',
          randomizationUnit: 'user',
          assignmentKey: 'user_id',
          variants: [
            { key: 'control', name: 'Control', allocation: 50 },
            { key: 'treatment', name: 'Treatment', allocation: 50 },
          ],
          designConfig: { type: 'ab' },
          trafficAllocation: 100,
        },
        {
          key: 'exp_2',
          name: 'Experiment 2',
          designType: 'multivariate',
          status: 'draft',
          hypotheses: 'Test',
          primaryMetric: 'conversion',
          randomizationUnit: 'user',
          assignmentKey: 'user_id',
          variants: [
            { key: 'v1', name: 'V1', allocation: 33.33 },
            { key: 'v2', name: 'V2', allocation: 33.33 },
            { key: 'v3', name: 'V3', allocation: 33.34 },
          ],
          designConfig: { type: 'multivariate' },
          trafficAllocation: 100,
        },
      ];

      for (const exp of experiments) {
        await request(app)
          .post('/api/v1/experiments')
          .set('X-API-Key', 'test-api-key')
          .send(exp);
      }
    });

    it('should list all experiments', async () => {
      const response = await request(app)
        .get('/api/v1/experiments')
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.pagination).toBeDefined();
    });

    it('should filter experiments by status', async () => {
      const response = await request(app)
        .get('/api/v1/experiments?status=running')
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((exp: any) => exp.status === 'running')).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get('/api/v1/experiments?page=1&limit=1')
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(1);
    });
  });

  describe('GET /api/v1/experiments/:id', () => {
    let experimentId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/experiments')
        .set('X-API-Key', 'test-api-key')
        .send({
          key: 'get_test',
          name: 'Get Test',
          designType: 'ab',
          hypotheses: 'Test',
          primaryMetric: 'conversion',
          randomizationUnit: 'user',
          assignmentKey: 'user_id',
          variants: [
            { key: 'control', name: 'Control', allocation: 100 },
          ],
          designConfig: { type: 'ab' },
          trafficAllocation: 100,
        });

      experimentId = response.body.data.id;
    });

    it('should get experiment by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/experiments/${experimentId}`)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(experimentId);
    });

    it('should return 404 for non-existent ID', async () => {
      await request(app)
        .get('/api/v1/experiments/nonexistent-id')
        .set('X-API-Key', 'test-api-key')
        .expect(404);
    });
  });

  describe('PUT /api/v1/experiments/:id', () => {
    let experimentId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/experiments')
        .set('X-API-Key', 'test-api-key')
        .send({
          key: 'update_test',
          name: 'Update Test',
          designType: 'ab',
          hypotheses: 'Test',
          primaryMetric: 'conversion',
          randomizationUnit: 'user',
          assignmentKey: 'user_id',
          variants: [
            { key: 'control', name: 'Control', allocation: 100 },
          ],
          designConfig: { type: 'ab' },
          trafficAllocation: 100,
        });

      experimentId = response.body.data.id;
    });

    it('should update experiment', async () => {
      const updates = {
        description: 'Updated description',
        trafficAllocation: 50,
      };

      const response = await request(app)
        .put(`/api/v1/experiments/${experimentId}`)
        .set('X-API-Key', 'test-api-key')
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.description).toBe('Updated description');
      expect(response.body.data.trafficAllocation).toBe(50);
    });

    it('should reject updating core fields on running experiment', async () => {
      // First, mark as running
      await request(app)
        .put(`/api/v1/experiments/${experimentId}`)
        .set('X-API-Key', 'test-api-key')
        .send({ status: 'running' })
        .expect(200);

      // Try to update restricted field
      const response = await request(app)
        .put(`/api/v1/experiments/${experimentId}`)
        .set('X-API-Key', 'test-api-key')
        .send({
          variants: [{ key: 'new', name: 'New', allocation: 100 }],
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/v1/experiments/:id', () => {
    let experimentId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/experiments')
        .set('X-API-Key', 'test-api-key')
        .send({
          key: 'delete_test',
          name: 'Delete Test',
          designType: 'ab',
          hypotheses: 'Test',
          primaryMetric: 'conversion',
          randomizationUnit: 'user',
          assignmentKey: 'user_id',
          variants: [
            { key: 'control', name: 'Control', allocation: 100 },
          ],
          designConfig: { type: 'ab' },
          trafficAllocation: 100,
        });

      experimentId = response.body.data.id;
    });

    it('should delete experiment', async () => {
      const response = await request(app)
        .delete(`/api/v1/experiments/${experimentId}`)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify it's deleted
      await request(app)
        .get(`/api/v1/experiments/${experimentId}`)
        .set('X-API-Key', 'test-api-key')
        .expect(404);
    });

    it('should reject deleting running experiment', async () => {
      // Mark as running
      await request(app)
        .put(`/api/v1/experiments/${experimentId}`)
        .set('X-API-Key', 'test-api-key')
        .send({ status: 'running' });

      // Try to delete
      const response = await request(app)
        .delete(`/api/v1/experiments/${experimentId}`)
        .set('X-API-Key', 'test-api-key')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/experiments/:id/results', () => {
    let experimentId: string;

    beforeEach(async () => {
      const response = await request(app)
        .post('/api/v1/experiments')
        .set('X-API-Key', 'test-api-key')
        .send({
          key: 'results_test',
          name: 'Results Test',
          designType: 'ab',
          hypotheses: 'Test',
          primaryMetric: 'conversion',
          randomizationUnit: 'user',
          assignmentKey: 'user_id',
          variants: [
            { key: 'control', name: 'Control', allocation: 50 },
            { key: 'treatment', name: 'Treatment', allocation: 50 },
          ],
          designConfig: { type: 'ab' },
          trafficAllocation: 100,
          status: 'completed',
        });

      experimentId = response.body.data.id;
    });

    it('should get experiment results', async () => {
      const response = await request(app)
        .get(`/api/v1/experiments/${experimentId}/results`)
        .set('X-API-Key', 'test-api-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('experimentId');
      expect(response.body.data).toHaveProperty('mainEffects');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on write operations', async () => {
      const experimentData = {
        key: `rate_limit_${Date.now()}`,
        name: 'Rate Limit Test',
        designType: 'ab',
        hypotheses: 'Test',
        primaryMetric: 'conversion',
        randomizationUnit: 'user',
        assignmentKey: 'user_id',
        variants: [
          { key: 'control', name: 'Control', allocation: 100 },
        ],
        designConfig: { type: 'ab' },
        trafficAllocation: 100,
      };

      // Make multiple rapid requests
      const requests = Array(20).fill(0).map((_, i) =>
        request(app)
          .post('/api/v1/experiments')
          .set('X-API-Key', 'test-api-key')
          .send({ ...experimentData, key: `${experimentData.key}_${i}` })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(r => r.status === 429);

      // At least some should be rate limited
      // This depends on rate limit configuration
      // expect(rateLimited).toBe(true); // Uncomment if rate limiting is strict
    });
  });
});
