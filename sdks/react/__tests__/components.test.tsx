import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ExperimentProvider } from '../src/ExperimentProvider';
import { ExperimentGate } from '../src/ExperimentGate';
import { FeatureFlag } from '../src/FeatureFlag';
import { ExperimentClient } from '@experimeh/browser';

const mockClient = ExperimentClient as jest.MockedClass<typeof ExperimentClient>;

describe('React SDK Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ExperimentGate', () => {
    it('should render children when variant matches', async () => {
      const mockAssignment = {
        id: 'assignment-1',
        experimentKey: 'exp-1',
        userId: 'user-123',
        variantKey: 'treatment',
        assignedAt: new Date(),
      };

      const mockInstance = mockClient.mock.results[0]?.value;
      mockInstance.getAssignment.mockResolvedValueOnce(mockAssignment);

      render(
        <ExperimentProvider
          apiUrl="https://api.example.com"
          apiKey="test-key"
          userId="user-123"
        >
          <ExperimentGate experiment="exp-1" variant="treatment">
            <div>Treatment Content</div>
          </ExperimentGate>
        </ExperimentProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Treatment Content')).toBeInTheDocument();
      });
    });

    it('should render fallback when variant does not match', async () => {
      const mockAssignment = {
        id: 'assignment-1',
        experimentKey: 'exp-1',
        userId: 'user-123',
        variantKey: 'control',
        assignedAt: new Date(),
      };

      const mockInstance = mockClient.mock.results[0]?.value;
      mockInstance.getAssignment.mockResolvedValueOnce(mockAssignment);

      render(
        <ExperimentProvider
          apiUrl="https://api.example.com"
          apiKey="test-key"
          userId="user-123"
        >
          <ExperimentGate
            experiment="exp-1"
            variant="treatment"
            fallback={<div>Fallback Content</div>}
          >
            <div>Treatment Content</div>
          </ExperimentGate>
        </ExperimentProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Fallback Content')).toBeInTheDocument();
      });
    });

    it('should support multiple variants', async () => {
      const mockAssignment = {
        id: 'assignment-1',
        experimentKey: 'exp-1',
        userId: 'user-123',
        variantKey: 'variant-b',
        assignedAt: new Date(),
      };

      const mockInstance = mockClient.mock.results[0]?.value;
      mockInstance.getAssignment.mockResolvedValueOnce(mockAssignment);

      render(
        <ExperimentProvider
          apiUrl="https://api.example.com"
          apiKey="test-key"
          userId="user-123"
        >
          <ExperimentGate
            experiment="exp-1"
            variant={['variant-a', 'variant-b', 'variant-c']}
          >
            <div>Multi-Variant Content</div>
          </ExperimentGate>
        </ExperimentProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Multi-Variant Content')).toBeInTheDocument();
      });
    });

    it('should render fallback on error', async () => {
      const mockInstance = mockClient.mock.results[0]?.value;
      mockInstance.getAssignment.mockRejectedValueOnce(new Error('API error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <ExperimentProvider
          apiUrl="https://api.example.com"
          apiKey="test-key"
          userId="user-123"
        >
          <ExperimentGate
            experiment="exp-1"
            variant="treatment"
            fallback={<div>Error Fallback</div>}
          >
            <div>Treatment Content</div>
          </ExperimentGate>
        </ExperimentProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Error Fallback')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('FeatureFlag', () => {
    it('should render children when flag is enabled', async () => {
      const mockAssignment = {
        id: 'assignment-1',
        experimentKey: 'feature-flag',
        userId: 'user-123',
        variantKey: 'enabled',
        assignedAt: new Date(),
      };

      const mockInstance = mockClient.mock.results[0]?.value;
      mockInstance.getAssignment.mockResolvedValueOnce(mockAssignment);

      render(
        <ExperimentProvider
          apiUrl="https://api.example.com"
          apiKey="test-key"
          userId="user-123"
        >
          <FeatureFlag flag="feature-flag">
            <div>New Feature</div>
          </FeatureFlag>
        </ExperimentProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('New Feature')).toBeInTheDocument();
      });
    });

    it('should render fallback when flag is disabled', async () => {
      const mockAssignment = {
        id: 'assignment-1',
        experimentKey: 'feature-flag',
        userId: 'user-123',
        variantKey: 'disabled',
        assignedAt: new Date(),
      };

      const mockInstance = mockClient.mock.results[0]?.value;
      mockInstance.getAssignment.mockResolvedValueOnce(mockAssignment);

      render(
        <ExperimentProvider
          apiUrl="https://api.example.com"
          apiKey="test-key"
          userId="user-123"
        >
          <FeatureFlag
            flag="feature-flag"
            fallback={<div>Old Feature</div>}
          >
            <div>New Feature</div>
          </FeatureFlag>
        </ExperimentProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Old Feature')).toBeInTheDocument();
      });
    });

    it('should support "on" variant key', async () => {
      const mockAssignment = {
        id: 'assignment-1',
        experimentKey: 'feature-flag',
        userId: 'user-123',
        variantKey: 'on',
        assignedAt: new Date(),
      };

      const mockInstance = mockClient.mock.results[0]?.value;
      mockInstance.getAssignment.mockResolvedValueOnce(mockAssignment);

      render(
        <ExperimentProvider
          apiUrl="https://api.example.com"
          apiKey="test-key"
          userId="user-123"
        >
          <FeatureFlag flag="feature-flag">
            <div>Feature Enabled</div>
          </FeatureFlag>
        </ExperimentProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Feature Enabled')).toBeInTheDocument();
      });
    });

    it('should render fallback on error (fail closed)', async () => {
      const mockInstance = mockClient.mock.results[0]?.value;
      mockInstance.getAssignment.mockRejectedValueOnce(new Error('API error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <ExperimentProvider
          apiUrl="https://api.example.com"
          apiKey="test-key"
          userId="user-123"
        >
          <FeatureFlag
            flag="feature-flag"
            fallback={<div>Feature Disabled</div>}
          >
            <div>Feature Enabled</div>
          </FeatureFlag>
        </ExperimentProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Feature Disabled')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });
});
