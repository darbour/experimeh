/**
 * Test setup
 */

// Mock @experimeh/browser
jest.mock('@experimeh/browser', () => {
  return {
    ExperimentClient: jest.fn().mockImplementation(() => ({
      getAssignment: jest.fn(),
      getExperiment: jest.fn(),
      trackExposure: jest.fn(),
      trackMetric: jest.fn(),
      clearCache: jest.fn(),
    })),
  };
});
