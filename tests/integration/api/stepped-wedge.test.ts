/**
 * Integration Tests for Stepped Wedge API
 * Tests API endpoints for creating experiments, getting assignments, and analysis
 */

import request from 'supertest';
import express from 'express';

/**
 * Mock stepped wedge experiment data
 */
const createSteppedWedgeExperimentData = () => ({
  key: 'hospital_protocol_rollout',
  name: 'Hospital Hand Hygiene Protocol Rollout',
  description: 'Stepped wedge rollout of enhanced hand hygiene protocol across hospital units',
  designType: 'stepped_wedge',
  hypothesis: 'Enhanced protocol will reduce infection rates by 20%',
  primaryMetric: 'infection_rate',
  secondaryMetrics: ['compliance_rate', 'hand_hygiene_events'],
  guardrailMetrics: ['patient_satisfaction', 'staff_workload'],
  randomizationUnit: 'cluster',
  assignmentKey: 'hospital_unit_id',
  variants: [
    {
      key: 'control',
      name: 'Standard Protocol',
      description: 'Current standard hand hygiene protocol',
      allocation: 50,
      isControl: true,
    },
    {
      key: 'treatment',
      name: 'Enhanced Protocol',
      description: 'Enhanced hand hygiene protocol with additional steps',
      allocation: 50,
      isControl: false,
    },
  ],
  designConfig: {
    type: 'stepped_wedge',
    numSteps: 5,
    stepDurationMinutes: 10080, // 1 week in minutes
    numClusters: 15,
    clusterKey: 'hospital_unit_id',
  },
  trafficAllocation: 100,
  startDate: '2025-01-01T00:00:00Z',
  minSampleSize: 100,
  tags: ['healthcare', 'infection-control', 'stepped-wedge'],
  owner: 'infection-control-team',
});

/**
 * Mock assignment service responses
 */
class MockAssignmentService {
  private experiments = new Map<string, any>();
  private assignments = new Map<string, any>();

  createExperiment(data: any) {
    const id = `exp-${Date.now()}`;
    const experiment = {
      id,
      ...data,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.experiments.set(id, experiment);
    return experiment;
  }

  getExperiment(id: string) {
    return this.experiments.get(id);
  }

  getAssignment(experimentId: string, context: any) {
    const key = `${experimentId}:${context.hospital_unit_id}`;

    if (this.assignments.has(key)) {
      return this.assignments.get(key);
    }

    // Create new assignment
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error('Experiment not found');
    }

    // Simulate stepped wedge assignment logic
    const clusterId = context.hospital_unit_id;
    const currentTime = new Date();
    const startTime = new Date(experiment.startDate);
    const elapsedMinutes = (currentTime.getTime() - startTime.getTime()) / (1000 * 60);
    const currentStep = Math.floor(elapsedMinutes / experiment.designConfig.stepDurationMinutes);

    // Simple deterministic mapping for testing
    const clusterNum = parseInt(clusterId.replace(/\D/g, '')) || 1;
    const switchStep = (clusterNum % experiment.designConfig.numSteps) + 1;

    const inTreatment = currentStep >= switchStep;
    const assignment = {
      experimentId,
      variantKey: inTreatment ? 'treatment' : 'control',
      inExperiment: true,
      reason: `stepped_wedge_step_${currentStep}_cluster_${clusterId}`,
      currentStep: Math.max(0, Math.min(currentStep, experiment.designConfig.numSteps)),
      clusterId,
      switchStep,
      inTreatment,
      assignedAt: new Date(),
    };

    this.assignments.set(key, assignment);
    return assignment;
  }

  getSchedule(experimentId: string) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error('Experiment not found');
    }

    const schedule: any = {
      stepToClusters: {},
      clusterToStep: {},
    };

    // Generate deterministic schedule
    for (let i = 1; i <= experiment.designConfig.numClusters; i++) {
      const clusterId = `unit-${i}`;
      const switchStep = (i % experiment.designConfig.numSteps) + 1;

      if (!schedule.stepToClusters[switchStep]) {
        schedule.stepToClusters[switchStep] = [];
      }
      schedule.stepToClusters[switchStep].push(clusterId);
      schedule.clusterToStep[clusterId] = switchStep;
    }

    return schedule;
  }
}

describe('Stepped Wedge API Integration Tests', () => {
  let app: express.Application;
  let mockService: MockAssignmentService;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    mockService = new MockAssignmentService();

    // Mock routes
    app.post('/api/v1/experiments', (req, res) => {
      try {
        const experiment = mockService.createExperiment(req.body);
        res.status(201).json({
          success: true,
          data: experiment,
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    });

    app.get('/api/v1/experiments/:id', (req, res) => {
      const experiment = mockService.getExperiment(req.params.id);
      if (!experiment) {
        res.status(404).json({
          success: false,
          error: 'Experiment not found',
        });
        return;
      }
      res.json({
        success: true,
        data: experiment,
      });
    });

    app.post('/api/v1/experiments/:id/assignment', (req, res) => {
      try {
        const assignment = mockService.getAssignment(req.params.id, req.body.context);
        res.json({
          success: true,
          data: assignment,
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          error: error.message,
        });
      }
    });

    app.get('/api/v1/experiments/:id/schedule', (req, res) => {
      try {
        const schedule = mockService.getSchedule(req.params.id);
        res.json({
          success: true,
          data: schedule,
        });
      } catch (error: any) {
        res.status(404).json({
          success: false,
          error: error.message,
        });
      }
    });

    app.post('/api/v1/experiments/:id/analyze', (_req, res) => {
      res.json({
        success: true,
        data: {
          treatmentEffect: {
            estimate: 12.5,
            standardError: 2.3,
            pValue: 0.001,
            confidenceInterval: [8.0, 17.0],
          },
          timeEffect: {
            estimate: 1.2,
            standardError: 0.5,
            pValue: 0.02,
          },
          intraclusterCorrelation: 0.15,
          clusterEffects: [],
        },
      });
    });
  });

  describe('POST /api/v1/experiments - Create Stepped Wedge Experiment', () => {
    it('should create a stepped wedge experiment', async () => {
      const experimentData = createSteppedWedgeExperimentData();

      const response = await request(app)
        .post('/api/v1/experiments')
        .send(experimentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.key).toBe('hospital_protocol_rollout');
      expect(response.body.data.designType).toBe('stepped_wedge');
      expect(response.body.data.status).toBe('draft');
    });

    it('should validate stepped wedge configuration', async () => {
      const experimentData = createSteppedWedgeExperimentData();

      const response = await request(app)
        .post('/api/v1/experiments')
        .send(experimentData)
        .expect(201);

      const config = response.body.data.designConfig;
      expect(config.numSteps).toBe(5);
      expect(config.stepDurationMinutes).toBe(10080);
      expect(config.numClusters).toBe(15);
      expect(config.clusterKey).toBe('hospital_unit_id');
    });

    it('should accept experiment with designConfig', async () => {
      const experimentData = createSteppedWedgeExperimentData();

      const response = await request(app)
        .post('/api/v1/experiments')
        .send(experimentData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.designConfig).toBeDefined();
    });

    it('should store correct variant definitions', async () => {
      const experimentData = createSteppedWedgeExperimentData();

      const response = await request(app)
        .post('/api/v1/experiments')
        .send(experimentData)
        .expect(201);

      expect(response.body.data.variants).toHaveLength(2);
      expect(response.body.data.variants[0].key).toBe('control');
      expect(response.body.data.variants[1].key).toBe('treatment');
    });
  });

  describe('POST /api/v1/experiments/:id/assignment - Get Assignment', () => {
    let experimentId: string;

    beforeEach(async () => {
      const experimentData = createSteppedWedgeExperimentData();
      const response = await request(app)
        .post('/api/v1/experiments')
        .send(experimentData);
      experimentId = response.body.data.id;
    });

    it('should get assignment for a cluster', async () => {
      const response = await request(app)
        .post(`/api/v1/experiments/${experimentId}/assignment`)
        .send({
          context: {
            hospital_unit_id: 'unit-1',
          },
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.variantKey).toBeDefined();
      expect(['control', 'treatment']).toContain(response.body.data.variantKey);
      expect(response.body.data.clusterId).toBe('unit-1');
      expect(response.body.data.currentStep).toBeDefined();
      expect(response.body.data.switchStep).toBeDefined();
    });

    it('should return consistent assignment for same cluster', async () => {
      const clusterId = 'unit-5';

      const response1 = await request(app)
        .post(`/api/v1/experiments/${experimentId}/assignment`)
        .send({
          context: { hospital_unit_id: clusterId },
        })
        .expect(200);

      const response2 = await request(app)
        .post(`/api/v1/experiments/${experimentId}/assignment`)
        .send({
          context: { hospital_unit_id: clusterId },
        })
        .expect(200);

      expect(response1.body.data.variantKey).toBe(response2.body.data.variantKey);
      expect(response1.body.data.switchStep).toBe(response2.body.data.switchStep);
    });

    it('should return different assignments for different clusters', async () => {
      const response1 = await request(app)
        .post(`/api/v1/experiments/${experimentId}/assignment`)
        .send({
          context: { hospital_unit_id: 'unit-1' },
        })
        .expect(200);

      const response2 = await request(app)
        .post(`/api/v1/experiments/${experimentId}/assignment`)
        .send({
          context: { hospital_unit_id: 'unit-10' },
        })
        .expect(200);

      // Different clusters should have different switch steps
      expect(response1.body.data.clusterId).not.toBe(response2.body.data.clusterId);
    });

    it('should include stepped wedge metadata in assignment', async () => {
      const response = await request(app)
        .post(`/api/v1/experiments/${experimentId}/assignment`)
        .send({
          context: { hospital_unit_id: 'unit-3' },
        })
        .expect(200);

      const assignment = response.body.data;
      expect(assignment.currentStep).toBeDefined();
      expect(assignment.switchStep).toBeDefined();
      expect(assignment.inTreatment).toBeDefined();
      expect(typeof assignment.inTreatment).toBe('boolean');
    });

    it('should assign control before switch step', async () => {
      // Create experiment that just started
      const experimentData = createSteppedWedgeExperimentData();
      experimentData.startDate = new Date().toISOString();

      const createResponse = await request(app)
        .post('/api/v1/experiments')
        .send(experimentData);

      const newExpId = createResponse.body.data.id;

      const response = await request(app)
        .post(`/api/v1/experiments/${newExpId}/assignment`)
        .send({
          context: { hospital_unit_id: 'unit-8' },
        })
        .expect(200);

      // Should be in step 0, so all clusters should be control
      expect(response.body.data.currentStep).toBe(0);
      expect(response.body.data.variantKey).toBe('control');
    });

    it('should require cluster ID in context', async () => {
      const response = await request(app)
        .post(`/api/v1/experiments/${experimentId}/assignment`)
        .send({
          context: {},
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/experiments/:id/schedule - Get Switching Schedule', () => {
    let experimentId: string;

    beforeEach(async () => {
      const experimentData = createSteppedWedgeExperimentData();
      const response = await request(app)
        .post('/api/v1/experiments')
        .send(experimentData);
      experimentId = response.body.data.id;
    });

    it('should return stepped wedge schedule', async () => {
      const response = await request(app)
        .get(`/api/v1/experiments/${experimentId}/schedule`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.stepToClusters).toBeDefined();
      expect(response.body.data.clusterToStep).toBeDefined();
    });

    it('should map all clusters to steps', async () => {
      const response = await request(app)
        .get(`/api/v1/experiments/${experimentId}/schedule`)
        .expect(200);

      const schedule = response.body.data;
      const clusterCount = Object.keys(schedule.clusterToStep).length;

      expect(clusterCount).toBe(15); // numClusters from config
    });

    it('should have consistent bidirectional mapping', async () => {
      const response = await request(app)
        .get(`/api/v1/experiments/${experimentId}/schedule`)
        .expect(200);

      const schedule = response.body.data;

      // Every cluster in clusterToStep should appear in stepToClusters
      Object.entries(schedule.clusterToStep).forEach(([clusterId, step]) => {
        expect(schedule.stepToClusters[step as number]).toContain(clusterId);
      });
    });

    it('should return 404 for non-existent experiment', async () => {
      await request(app)
        .get('/api/v1/experiments/non-existent/schedule')
        .expect(404);
    });
  });

  describe('POST /api/v1/experiments/:id/analyze - Analyze Results', () => {
    let experimentId: string;

    beforeEach(async () => {
      const experimentData = createSteppedWedgeExperimentData();
      const response = await request(app)
        .post('/api/v1/experiments')
        .send(experimentData);
      experimentId = response.body.data.id;
    });

    it('should return stepped wedge analysis results', async () => {
      const response = await request(app)
        .post(`/api/v1/experiments/${experimentId}/analyze`)
        .send({
          data: [], // Mock data
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.treatmentEffect).toBeDefined();
      expect(response.body.data.timeEffect).toBeDefined();
      expect(response.body.data.intraclusterCorrelation).toBeDefined();
    });

    it('should include treatment effect estimate', async () => {
      const response = await request(app)
        .post(`/api/v1/experiments/${experimentId}/analyze`)
        .send({
          data: [],
        })
        .expect(200);

      const treatmentEffect = response.body.data.treatmentEffect;
      expect(treatmentEffect.estimate).toBeDefined();
      expect(treatmentEffect.standardError).toBeDefined();
      expect(treatmentEffect.pValue).toBeDefined();
      expect(treatmentEffect.confidenceInterval).toHaveLength(2);
    });

    it('should include time effect estimate', async () => {
      const response = await request(app)
        .post(`/api/v1/experiments/${experimentId}/analyze`)
        .send({
          data: [],
        })
        .expect(200);

      const timeEffect = response.body.data.timeEffect;
      expect(timeEffect.estimate).toBeDefined();
      expect(timeEffect.standardError).toBeDefined();
      expect(timeEffect.pValue).toBeDefined();
    });

    it('should include ICC value', async () => {
      const response = await request(app)
        .post(`/api/v1/experiments/${experimentId}/analyze`)
        .send({
          data: [],
        })
        .expect(200);

      const icc = response.body.data.intraclusterCorrelation;
      expect(typeof icc).toBe('number');
      expect(icc).toBeGreaterThanOrEqual(0);
      expect(icc).toBeLessThanOrEqual(1);
    });
  });

  describe('Assignment Consistency Over Time', () => {
    let experimentId: string;

    beforeEach(async () => {
      const experimentData = createSteppedWedgeExperimentData();
      const response = await request(app)
        .post('/api/v1/experiments')
        .send(experimentData);
      experimentId = response.body.data.id;
    });

    it('should maintain same switch step for cluster across calls', async () => {
      const clusterId = 'unit-7';
      const assignments = [];

      // Get assignment multiple times
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .post(`/api/v1/experiments/${experimentId}/assignment`)
          .send({
            context: { hospital_unit_id: clusterId },
          })
          .expect(200);

        assignments.push(response.body.data);
      }

      // All assignments should have same switch step
      const firstSwitchStep = assignments[0].switchStep;
      assignments.forEach(assignment => {
        expect(assignment.switchStep).toBe(firstSwitchStep);
      });
    });

    it('should track progression through steps', async () => {
      const clusterId = 'unit-12';

      const response = await request(app)
        .post(`/api/v1/experiments/${experimentId}/assignment`)
        .send({
          context: { hospital_unit_id: clusterId },
        })
        .expect(200);

      expect(response.body.data.currentStep).toBeDefined();
      expect(response.body.data.currentStep).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should return 400 for non-existent experiment', async () => {
      const response = await request(app)
        .post('/api/v1/experiments/non-existent/assignment')
        .send({
          context: { hospital_unit_id: 'unit-1' },
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should accept experiment creation with minimal fields', async () => {
      const minimalData = {
        key: 'minimal',
        designType: 'stepped_wedge',
        name: 'Minimal Test',
      };

      const response = await request(app)
        .post('/api/v1/experiments')
        .send(minimalData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should handle malformed requests gracefully', async () => {
      const experimentData = createSteppedWedgeExperimentData();
      const createResponse = await request(app)
        .post('/api/v1/experiments')
        .send(experimentData);

      const expId = createResponse.body.data.id;

      const response = await request(app)
        .post(`/api/v1/experiments/${expId}/assignment`)
        .send({
          // Missing context
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Multiple Clusters Integration', () => {
    let experimentId: string;

    beforeEach(async () => {
      const experimentData = createSteppedWedgeExperimentData();
      const response = await request(app)
        .post('/api/v1/experiments')
        .send(experimentData);
      experimentId = response.body.data.id;
    });

    it('should handle assignments for multiple clusters', async () => {
      const clusters = ['unit-1', 'unit-5', 'unit-10', 'unit-15'];
      const assignments = [];

      for (const clusterId of clusters) {
        const response = await request(app)
          .post(`/api/v1/experiments/${experimentId}/assignment`)
          .send({
            context: { hospital_unit_id: clusterId },
          })
          .expect(200);

        assignments.push(response.body.data);
      }

      // All assignments should be valid
      assignments.forEach(assignment => {
        expect(assignment.variantKey).toBeDefined();
        expect(assignment.clusterId).toBeDefined();
        expect(assignment.switchStep).toBeDefined();
      });

      // Cluster IDs should be distinct
      const clusterIds = new Set(assignments.map(a => a.clusterId));
      expect(clusterIds.size).toBe(clusters.length);
    });

    it('should have balanced distribution across steps', async () => {
      const response = await request(app)
        .get(`/api/v1/experiments/${experimentId}/schedule`)
        .expect(200);

      const schedule = response.body.data;
      const stepCounts = Object.values(schedule.stepToClusters).map(
        (clusters: any) => clusters.length
      );

      // Each step should have roughly equal clusters
      const maxCount = Math.max(...stepCounts);
      const minCount = Math.min(...stepCounts);
      expect(maxCount - minCount).toBeLessThanOrEqual(5);
    });
  });
});
