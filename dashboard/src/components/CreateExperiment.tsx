import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import { useCreateExperiment } from '../hooks/useExperiments';
import type { CreateExperimentForm, DesignType, Variant, Metric } from '../types';

export default function CreateExperiment() {
  const navigate = useNavigate();
  const createMutation = useCreateExperiment();

  const [formData, setFormData] = useState<CreateExperimentForm>({
    name: '',
    description: '',
    flag_key: '',
    design_type: 'ab',
    variants: [
      { name: 'control', allocation: 0.5 },
      { name: 'treatment', allocation: 0.5 },
    ],
    metrics: [
      { name: '', type: 'primary', aggregation: 'mean' },
    ],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.flag_key.trim()) {
      newErrors.flag_key = 'Flag key is required';
    }

    if (formData.variants.length < 2) {
      newErrors.variants = 'At least 2 variants are required';
    }

    // Validate variant allocations sum to 1
    const totalAllocation = formData.variants.reduce((sum, v) => sum + v.allocation, 0);
    if (Math.abs(totalAllocation - 1) > 0.01) {
      newErrors.allocation = 'Variant allocations must sum to 100%';
    }

    // Validate at least one metric with name
    const validMetrics = formData.metrics.filter((m) => m.name.trim());
    if (validMetrics.length === 0) {
      newErrors.metrics = 'At least one metric is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const experiment = await createMutation.mutateAsync({
        ...formData,
        metrics: validMetrics,
      });
      navigate(`/experiments/${experiment.id}`);
    } catch (error) {
      console.error('Failed to create experiment:', error);
      setErrors({ submit: 'Failed to create experiment. Please try again.' });
    }
  };

  const addVariant = () => {
    const newAllocation = 1 / (formData.variants.length + 1);
    setFormData({
      ...formData,
      variants: [
        ...formData.variants.map((v) => ({ ...v, allocation: newAllocation })),
        { name: '', allocation: newAllocation },
      ],
    });
  };

  const removeVariant = (index: number) => {
    if (formData.variants.length <= 2) return;
    const newVariants = formData.variants.filter((_, i) => i !== index);
    const newAllocation = 1 / newVariants.length;
    setFormData({
      ...formData,
      variants: newVariants.map((v) => ({ ...v, allocation: newAllocation })),
    });
  };

  const updateVariant = (index: number, field: keyof Variant, value: any) => {
    const newVariants = [...formData.variants];
    newVariants[index] = { ...newVariants[index], [field]: value };
    setFormData({ ...formData, variants: newVariants });
  };

  const addMetric = () => {
    setFormData({
      ...formData,
      metrics: [...formData.metrics, { name: '', type: 'secondary', aggregation: 'mean' }],
    });
  };

  const removeMetric = (index: number) => {
    setFormData({
      ...formData,
      metrics: formData.metrics.filter((_, i) => i !== index),
    });
  };

  const updateMetric = (index: number, field: keyof Metric, value: any) => {
    const newMetrics = [...formData.metrics];
    newMetrics[index] = { ...newMetrics[index], [field]: value };
    setFormData({ ...formData, metrics: newMetrics });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <button
          onClick={() => navigate('/experiments')}
          className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Experiments
        </button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Create New Experiment
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Configure your feature flag experiment
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Basic Information
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Experiment Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="My A/B Test"
            />
            {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Describe the goal of this experiment..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Feature Flag Key *
            </label>
            <input
              type="text"
              value={formData.flag_key}
              onChange={(e) => setFormData({ ...formData, flag_key: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono"
              placeholder="new_checkout_flow"
            />
            {errors.flag_key && <p className="text-sm text-red-600 mt-1">{errors.flag_key}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Design Type
            </label>
            <select
              value={formData.design_type}
              onChange={(e) =>
                setFormData({ ...formData, design_type: e.target.value as DesignType })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="ab">A/B Test</option>
              <option value="factorial">Factorial Design</option>
              <option value="switchback">Switchback Test</option>
              <option value="stepped_wedge">Stepped Wedge</option>
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formData.design_type === 'ab' &&
                'Standard A/B test with control and treatment variants'}
              {formData.design_type === 'factorial' &&
                'Test multiple factors simultaneously'}
              {formData.design_type === 'switchback' &&
                'Time-based switching between variants'}
              {formData.design_type === 'stepped_wedge' &&
                'Gradual rollout across time steps'}
            </p>
          </div>
        </div>

        {/* Variants */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Variants
            </h2>
            <button
              type="button"
              onClick={addVariant}
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add Variant</span>
            </button>
          </div>

          {errors.allocation && (
            <p className="text-sm text-red-600">{errors.allocation}</p>
          )}

          <div className="space-y-3">
            {formData.variants.map((variant, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <input
                  type="text"
                  value={variant.name}
                  onChange={(e) => updateVariant(index, 'name', e.target.value)}
                  placeholder="Variant name"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    value={(variant.allocation * 100).toFixed(0)}
                    onChange={(e) =>
                      updateVariant(
                        index,
                        'allocation',
                        parseFloat(e.target.value) / 100
                      )
                    }
                    min="0"
                    max="100"
                    step="1"
                    className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">%</span>
                </div>
                {formData.variants.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Metrics
            </h2>
            <button
              type="button"
              onClick={addMetric}
              className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add Metric</span>
            </button>
          </div>

          {errors.metrics && <p className="text-sm text-red-600">{errors.metrics}</p>}

          <div className="space-y-3">
            {formData.metrics.map((metric, index) => (
              <div
                key={index}
                className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-3"
              >
                <div className="flex items-start space-x-3">
                  <input
                    type="text"
                    value={metric.name}
                    onChange={(e) => updateMetric(index, 'name', e.target.value)}
                    placeholder="Metric name (e.g., conversion_rate)"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => removeMetric(index)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Type
                    </label>
                    <select
                      value={metric.type}
                      onChange={(e) =>
                        updateMetric(index, 'type', e.target.value as any)
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                      <option value="guardrail">Guardrail</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Aggregation
                    </label>
                    <select
                      value={metric.aggregation}
                      onChange={(e) =>
                        updateMetric(index, 'aggregation', e.target.value as any)
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="mean">Mean</option>
                      <option value="sum">Sum</option>
                      <option value="count">Count</option>
                      <option value="ratio">Ratio</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Direction
                    </label>
                    <select
                      value={metric.direction || ''}
                      onChange={(e) =>
                        updateMetric(
                          index,
                          'direction',
                          e.target.value || undefined
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">None</option>
                      <option value="increase">Increase</option>
                      <option value="decrease">Decrease</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/experiments')}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center space-x-2"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Create Experiment</span>
          </button>
        </div>

        {errors.submit && (
          <p className="text-sm text-red-600 text-center">{errors.submit}</p>
        )}
      </form>
    </div>
  );
}
