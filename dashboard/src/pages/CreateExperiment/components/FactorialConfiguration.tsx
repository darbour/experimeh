/**
 * Factorial Design Configuration Component
 *
 * Allows users to define factors and their levels.
 * Automatically generates all factor combinations.
 */

import { useState } from 'react';
import { Plus, Trash2, Grid3x3 } from 'lucide-react';

interface Factor {
  name: string;
  levels: string[];
}

interface Props {
  config: {
    factors: Factor[];
  };
  setConfig: (config: { factors: Factor[] }) => void;
  flag: any;
}

export default function FactorialConfiguration({ config, setConfig, flag }: Props) {
  const addFactor = () => {
    setConfig({
      factors: [
        ...config.factors,
        { name: '', levels: ['', ''] },
      ],
    });
  };

  const removeFactor = (index: number) => {
    setConfig({
      factors: config.factors.filter((_, i) => i !== index),
    });
  };

  const updateFactor = (index: number, updated: Factor) => {
    const newFactors = [...config.factors];
    newFactors[index] = updated;
    setConfig({ factors: newFactors });
  };

  const addLevel = (factorIndex: number) => {
    const factor = config.factors[factorIndex];
    updateFactor(factorIndex, {
      ...factor,
      levels: [...factor.levels, ''],
    });
  };

  const removeLevel = (factorIndex: number, levelIndex: number) => {
    const factor = config.factors[factorIndex];
    updateFactor(factorIndex, {
      ...factor,
      levels: factor.levels.filter((_, i) => i !== levelIndex),
    });
  };

  const updateLevel = (factorIndex: number, levelIndex: number, value: string) => {
    const factor = config.factors[factorIndex];
    const newLevels = [...factor.levels];
    newLevels[levelIndex] = value;
    updateFactor(factorIndex, { ...factor, levels: newLevels });
  };

  const generateCombinations = () => {
    if (config.factors.length === 0 || config.factors.some((f) => f.levels.some((l) => !l))) {
      return [];
    }

    const combinations: string[][] = [[]];
    for (const factor of config.factors) {
      const newCombinations: string[][] = [];
      for (const combination of combinations) {
        for (const level of factor.levels) {
          newCombinations.push([...combination, level]);
        }
      }
      combinations.length = 0;
      combinations.push(...newCombinations);
    }
    return combinations;
  };

  const combinations = generateCombinations();
  const totalCells = combinations.length;
  const allocationPerCell = totalCells > 0 ? (100 / totalCells).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      {/* Factor Editor */}
      <div className="space-y-4">
        {config.factors.map((factor, factorIndex) => (
          <div
            key={factorIndex}
            className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-lg p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 mr-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Factor {factorIndex + 1} Name
                </label>
                <input
                  type="text"
                  value={factor.name}
                  onChange={(e) =>
                    updateFactor(factorIndex, { ...factor, name: e.target.value })
                  }
                  placeholder="e.g., button_color"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              <button
                onClick={() => removeFactor(factorIndex)}
                className="mt-6 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Levels
              </label>
              {factor.levels.map((level, levelIndex) => (
                <div key={levelIndex} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={level}
                    onChange={(e) => updateLevel(factorIndex, levelIndex, e.target.value)}
                    placeholder={`Level ${levelIndex + 1}`}
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  {factor.levels.length > 2 && (
                    <button
                      onClick={() => removeLevel(factorIndex, levelIndex)}
                      className="p-1.5 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => addLevel(factorIndex)}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                + Add Level
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={addFactor}
          className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Factor
        </button>
      </div>

      {/* Generated Combinations Matrix */}
      {totalCells > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Grid3x3 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-900 dark:text-green-100 mb-2">
                Generated {totalCells} Combinations
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-3">
                {combinations.slice(0, 12).map((combo, i) => (
                  <div
                    key={i}
                    className="px-2 py-1 bg-white dark:bg-gray-800 border border-green-300 dark:border-green-700 rounded text-xs"
                  >
                    {combo.join(' × ')}
                  </div>
                ))}
                {combinations.length > 12 && (
                  <div className="px-2 py-1 text-xs text-green-700 dark:text-green-300">
                    +{combinations.length - 12} more...
                  </div>
                )}
              </div>
              <p className="text-sm text-green-800 dark:text-green-200">
                Each combination will receive <strong>{allocationPerCell}%</strong> of traffic
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
