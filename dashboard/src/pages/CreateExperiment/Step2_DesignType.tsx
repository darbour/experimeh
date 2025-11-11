/**
 * Step 2: Design Type Selection
 *
 * THIS IS THE KEY UX IMPROVEMENT that addresses user feedback:
 * "when I choose a different experiment type nothing changes"
 *
 * Each design type now has:
 * - Visual diagram showing what it does
 * - Clear description of when to use it
 * - Stats about complexity and sample size
 * - Visual feedback when selected
 */

import { WizardState, ExperimentDesignType } from './index';
import { Beaker, Grid3x3, Clock, TrendingUp, Info } from 'lucide-react';
import DesignTypeCard from './components/DesignTypeCard';
import ABTestDiagram from './components/ABTestDiagram';
import FactorialDiagram from './components/FactorialDiagram';
import SwitchbackDiagram from './components/SwitchbackDiagram';
import SteppedWedgeDiagram from './components/SteppedWedgeDiagram';

interface Props {
  wizardState: WizardState;
  setWizardState: (state: WizardState) => void;
}

export default function Step2_DesignType({ wizardState, setWizardState }: Props) {
  const handleSelectDesign = (designType: ExperimentDesignType) => {
    setWizardState({
      ...wizardState,
      designType,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Select Experiment Design
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Choose the statistical design that best fits your experimental question.
          Each design has different tradeoffs and use cases.
        </p>
      </div>

      {/* Design Type Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* A/B Test */}
        <DesignTypeCard
          type="ab"
          selected={wizardState.designType === 'ab'}
          onClick={() => handleSelectDesign('ab')}
          icon={<Beaker className="w-6 h-6" />}
          title="A/B Test"
          description="Standard randomized controlled trial with two or more variants"
          diagram={<ABTestDiagram />}
          stats={{
            sampleMultiplier: '1.0x (baseline)',
            power: 'Standard',
            complexity: 'Simple',
            runtime: '1-2 weeks typical',
          }}
          bestFor={[
            'Single feature changes (e.g., button color, copy)',
            'Need a clear winner quickly',
            'Independent users (no network effects)',
          ]}
          statisticalMethods={[
            'Two-sample t-test',
            'Welch\'s correction for unequal variances',
            'Cohen\'s d effect size',
          ]}
        />

        {/* Factorial Design */}
        <DesignTypeCard
          type="factorial"
          selected={wizardState.designType === 'factorial'}
          onClick={() => handleSelectDesign('factorial')}
          icon={<Grid3x3 className="w-6 h-6" />}
          title="Factorial Design"
          description="Test multiple factors simultaneously to detect interactions"
          diagram={<FactorialDiagram />}
          stats={{
            sampleMultiplier: '2-4x (more cells)',
            power: 'Reduced per cell',
            complexity: 'Complex',
            runtime: '2-4 weeks typical',
          }}
          bestFor={[
            'Multiple factors that might interact (e.g., price + messaging)',
            'Want to optimize combinations',
            'Willing to wait longer for results',
          ]}
          statisticalMethods={[
            'ANOVA for main effects',
            'Interaction effect testing',
            'Bonferroni correction for multiple comparisons',
            'Partial eta-squared effect sizes',
          ]}
        />

        {/* Switchback Design */}
        <DesignTypeCard
          type="switchback"
          selected={wizardState.designType === 'switchback'}
          onClick={() => handleSelectDesign('switchback')}
          icon={<Clock className="w-6 h-6" />}
          title="Switchback (Temporal)"
          description="All users experience both variants over alternating time periods"
          diagram={<SwitchbackDiagram />}
          stats={{
            sampleMultiplier: '1.5-2x (temporal correlation)',
            power: 'Reduced by autocorrelation',
            complexity: 'Moderate',
            runtime: '2-3 weeks typical',
          }}
          bestFor={[
            'Marketplace experiments (two-sided networks)',
            'Supply/demand effects matter',
            'Need to control for time-of-day effects',
          ]}
          statisticalMethods={[
            'Difference-in-differences estimation',
            'Cluster-robust standard errors',
            'Temporal autocorrelation adjustment',
            'Washout period analysis',
          ]}
        />

        {/* Stepped Wedge Design */}
        <DesignTypeCard
          type="stepped_wedge"
          selected={wizardState.designType === 'stepped_wedge'}
          onClick={() => handleSelectDesign('stepped_wedge')}
          icon={<TrendingUp className="w-6 h-6" />}
          title="Stepped Wedge"
          description="Gradual rollout where clusters transition from control to treatment"
          diagram={<SteppedWedgeDiagram />}
          stats={{
            sampleMultiplier: '1.2-1.8x (cluster effects)',
            power: 'Depends on ICC',
            complexity: 'Complex',
            runtime: '4-8 weeks typical',
          }}
          bestFor={[
            'Cannot deny treatment to control group long-term',
            'Clustered randomization (e.g., by region)',
            'Logistical constraints on rollout speed',
          ]}
          statisticalMethods={[
            'Mixed-effects models',
            'Intracluster correlation (ICC) estimation',
            'Time trend adjustment',
            'Hussey-Hughes sample size formula',
          ]}
        />
      </div>

      {/* Design Explainer */}
      {wizardState.designType && (
        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-primary-600 dark:text-primary-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-primary-900 dark:text-primary-100">
              <p className="font-semibold mb-2">
                You selected: {getDesignName(wizardState.designType)}
              </p>
              <p className="mb-3">{getDesignExplanation(wizardState.designType)}</p>
              <p className="font-medium text-xs uppercase tracking-wide mb-1">
                What happens next:
              </p>
              <ul className="list-disc list-inside space-y-1">
                {getNextSteps(wizardState.designType).map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getDesignName(type: ExperimentDesignType): string {
  const names = {
    ab: 'A/B Test',
    factorial: 'Factorial Design',
    switchback: 'Switchback Design',
    stepped_wedge: 'Stepped Wedge Design',
  };
  return names[type];
}

function getDesignExplanation(type: ExperimentDesignType): string {
  const explanations = {
    ab: 'In an A/B test, users are randomly assigned to one variant and stay in that variant for the duration of the experiment. This is the simplest and most common experimental design.',
    factorial: 'In a factorial design, you test multiple factors at once to understand both their individual effects and how they interact. For example, testing price AND messaging together.',
    switchback: 'In a switchback design, ALL users experience both variants by switching between them at regular time intervals. This controls for marketplace effects and time-varying confounders.',
    stepped_wedge: 'In a stepped wedge design, clusters (e.g., cities, teams) transition from control to treatment in a staggered fashion over time. Everyone eventually gets the treatment.',
  };
  return explanations[type];
}

function getNextSteps(type: ExperimentDesignType): string[] {
  const steps = {
    ab: [
      'Configure variant allocations (e.g., 50/50 split)',
      'Set targeting rules (optional)',
      'Calculate required sample size',
    ],
    factorial: [
      'Define factors and their levels',
      'System generates all combinations automatically',
      'Configure allocation across combinations',
      'Calculate sample size (larger than A/B)',
    ],
    switchback: [
      'Set time period length (e.g., 30 minutes)',
      'Set washout period to avoid contamination',
      'Define switching schedule',
      'Calculate sample size accounting for autocorrelation',
    ],
    stepped_wedge: [
      'Define clusters (e.g., regions, teams)',
      'Set step length (time per rollout phase)',
      'Configure rollout schedule',
      'Calculate sample size accounting for ICC',
    ],
  };
  return steps[type];
}
