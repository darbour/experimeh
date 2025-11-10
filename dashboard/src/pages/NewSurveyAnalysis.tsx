import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { useUploadSurveyData, useRunAnalysis, useRunQualityChecks } from '../hooks/useSurveyExperiments';

export default function NewSurveyAnalysis() {
  const navigate = useNavigate();
  const uploadData = useUploadSurveyData();
  const runAnalysis = useRunAnalysis();
  const runQualityChecks = useRunQualityChecks();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [analysisId, setAnalysisId] = useState<string>();

  // Step 1: Upload
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: Configure
  const [analysisType, setAnalysisType] = useState<'paired_comparison' | 'multi_item'>('paired_comparison');
  const [config, setConfig] = useState({
    alpha: 0.05,
    // Paired comparison
    subject_column: 'respondent_id',
    condition_column: 'condition',
    metric_column: 'rating',
    control_value: 'control',
    treatment_value: 'treatment',
    order_column: '',
    // Multi-item
    respondent_column: 'respondent_id',
    item_column: 'item_id',
    treatment_column: 'treatment',
    // Quality checks
    rating_columns: ['rating'],
    duration_column: '',
    attention_column: '',
    attention_correct_answer: '',
  });

  const handleUpload = async () => {
    if (!file || !name) {
      alert('Please provide a file and analysis name');
      return;
    }

    try {
      const result = await uploadData.mutateAsync({ file, name, description });
      setAnalysisId(result.analysisId);
      setStep(2);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    }
  };

  const handleConfigure = async () => {
    if (!analysisId) return;

    try {
      // Run analysis
      await runAnalysis.mutateAsync({
        analysisId,
        analysisType,
        config,
      });

      // Run quality checks
      await runQualityChecks.mutateAsync({
        analysisId,
        checks: 'all',
      });

      setStep(3);
    } catch (error) {
      console.error('Analysis failed:', error);
      alert('Analysis failed. Please check your configuration.');
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          New Survey Analysis
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Upload survey data and configure analysis settings
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
                s <= step
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              }`}>
                {s}
              </div>
              {s < 3 && (
                <div className={`flex-1 h-1 mx-2 ${
                  s < step ? 'bg-primary-600' : 'bg-gray-200 dark:bg-gray-700'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-sm">
          <span className={step >= 1 ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>Upload Data</span>
          <span className={step >= 2 ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>Configure</span>
          <span className={step >= 3 ? 'text-gray-900 dark:text-white' : 'text-gray-500'}>Review</span>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        {step === 1 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Survey Data</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Analysis Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Product Feature Survey Q4 2024"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Data File * (CSV or JSON)
              </label>
              <div className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                file
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400'
              }`}>
                <input
                  type="file"
                  id="file-upload"
                  accept=".csv,.json"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  {file ? (
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 mt-1">CSV or JSON (max 50MB)</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => navigate('/survey-experiments')}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || !name || uploadData.isPending}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploadData.isPending ? 'Uploading...' : 'Next'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Configure Analysis</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Analysis Type *
              </label>
              <select
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                <option value="paired_comparison">Paired Comparison (Within-Subjects)</option>
                <option value="multi_item">Multi-Item Survey (Clustered)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {analysisType === 'paired_comparison'
                  ? 'Each respondent rates both conditions (e.g., Product A vs Product B)'
                  : 'Respondents rate multiple items, items randomized to conditions'}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Significance Level (α)
                </label>
                <input
                  type="number"
                  value={config.alpha}
                  onChange={(e) => setConfig({ ...config, alpha: parseFloat(e.target.value) })}
                  step="0.01"
                  min="0.01"
                  max="0.10"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Metric Column *
                </label>
                <input
                  type="text"
                  value={config.metric_column}
                  onChange={(e) => setConfig({ ...config, metric_column: e.target.value })}
                  placeholder="rating"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            {analysisType === 'paired_comparison' ? (
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 dark:text-white">Paired Comparison Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Subject Column *
                    </label>
                    <input
                      type="text"
                      value={config.subject_column}
                      onChange={(e) => setConfig({ ...config, subject_column: e.target.value })}
                      placeholder="respondent_id"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Condition Column *
                    </label>
                    <input
                      type="text"
                      value={config.condition_column}
                      onChange={(e) => setConfig({ ...config, condition_column: e.target.value })}
                      placeholder="condition"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Control Value *
                    </label>
                    <input
                      type="text"
                      value={config.control_value}
                      onChange={(e) => setConfig({ ...config, control_value: e.target.value })}
                      placeholder="control"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Treatment Value *
                    </label>
                    <input
                      type="text"
                      value={config.treatment_value}
                      onChange={(e) => setConfig({ ...config, treatment_value: e.target.value })}
                      placeholder="treatment"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Order Column (optional)
                    </label>
                    <input
                      type="text"
                      value={config.order_column}
                      onChange={(e) => setConfig({ ...config, order_column: e.target.value })}
                      placeholder="order"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                    <p className="text-xs text-gray-500 mt-1">For order effect detection</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 dark:text-white">Multi-Item Settings</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Respondent Column *
                    </label>
                    <input
                      type="text"
                      value={config.respondent_column}
                      onChange={(e) => setConfig({ ...config, respondent_column: e.target.value })}
                      placeholder="respondent_id"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Item Column *
                    </label>
                    <input
                      type="text"
                      value={config.item_column}
                      onChange={(e) => setConfig({ ...config, item_column: e.target.value })}
                      placeholder="item_id"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Treatment Column *
                    </label>
                    <input
                      type="text"
                      value={config.treatment_column}
                      onChange={(e) => setConfig({ ...config, treatment_column: e.target.value })}
                      placeholder="treatment"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </button>
              <button
                onClick={handleConfigure}
                disabled={runAnalysis.isPending || runQualityChecks.isPending}
                className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {runAnalysis.isPending || runQualityChecks.isPending ? 'Running Analysis...' : 'Run Analysis'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Analysis Started!</h2>
            <p className="text-gray-600 dark:text-gray-400">
              Your survey analysis is now running. This may take a few moments.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate('/survey-experiments')}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Back to List
              </button>
              <button
                onClick={() => navigate(`/survey-experiments/${analysisId}`)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                View Results
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
