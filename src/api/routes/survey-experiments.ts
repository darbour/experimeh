/**
 * Survey Experiments API Routes
 *
 * REST API endpoints for survey experiment analysis with Python plugins.
 *
 * Endpoints:
 * - POST   /api/v1/survey-experiments/upload       - Upload survey data
 * - POST   /api/v1/survey-experiments/analyze      - Run analysis
 * - POST   /api/v1/survey-experiments/quality      - Run quality checks
 * - GET    /api/v1/survey-experiments/:id          - Get analysis results
 * - GET    /api/v1/survey-experiments              - List all analyses
 * - DELETE /api/v1/survey-experiments/:id          - Delete analysis
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../middleware/logger';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: '/tmp/survey-uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept only CSV and JSON files
    if (file.mimetype === 'text/csv' ||
        file.mimetype === 'application/json' ||
        file.originalname.endsWith('.csv') ||
        file.originalname.endsWith('.json')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and JSON files are allowed'));
    }
  },
});

// In-memory storage for analysis results (in production, use database)
interface SurveyAnalysis {
  id: string;
  name: string;
  analysisType: 'paired_comparison' | 'multi_item';
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  config: any;
  results?: any;
  qualityChecks?: any;
  error?: string;
  dataPath?: string;
}

const analyses = new Map<string, SurveyAnalysis>();

/**
 * Execute Python plugin via child process
 */
async function executePythonPlugin(
  pluginPath: string,
  dataPath: string,
  config: any
): Promise<any> {
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', [
      pluginPath,
      '--data', dataPath,
      '--config', JSON.stringify(config)
    ]);

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr}`));
      } else {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse Python output: ${error}`));
        }
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to start Python process: ${error.message}`));
    });
  });
}

/**
 * POST /api/v1/survey-experiments/upload
 * Upload survey data file
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Analysis name is required'
      });
    }

    const analysisId = uuidv4();
    const analysis: SurveyAnalysis = {
      id: analysisId,
      name,
      analysisType: 'paired_comparison', // Default
      status: 'pending',
      createdAt: new Date().toISOString(),
      config: { description },
      dataPath: req.file.path
    };

    analyses.set(analysisId, analysis);

    logger.info('Survey data uploaded', {
      analysisId,
      filename: req.file.originalname,
      size: req.file.size
    });

    res.json({
      success: true,
      analysisId,
      filename: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    logger.error('File upload failed', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/survey-experiments/analyze
 * Run survey analysis
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const {
      analysisId,
      analysisType,
      config
    } = req.body;

    if (!analysisId || !analysisType) {
      return res.status(400).json({
        success: false,
        error: 'analysisId and analysisType are required'
      });
    }

    const analysis = analyses.get(analysisId);
    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found'
      });
    }

    if (!analysis.dataPath) {
      return res.status(400).json({
        success: false,
        error: 'No data file found for this analysis'
      });
    }

    // Update status
    analysis.status = 'running';
    analysis.analysisType = analysisType;
    analysis.config = { ...analysis.config, ...config };

    // Determine which Python script to run
    const pluginMap: Record<string, string> = {
      'paired_comparison': path.join(__dirname, '../../../plugins/survey_experiments/paired_comparison.py'),
      'multi_item': path.join(__dirname, '../../../plugins/survey_experiments/multi_item_survey.py')
    };

    const pluginPath = pluginMap[analysisType];
    if (!pluginPath) {
      analysis.status = 'failed';
      analysis.error = `Unknown analysis type: ${analysisType}`;
      return res.status(400).json({
        success: false,
        error: analysis.error
      });
    }

    // Execute analysis in background
    executePythonPlugin(pluginPath, analysis.dataPath, config)
      .then((results) => {
        analysis.status = 'completed';
        analysis.completedAt = new Date().toISOString();
        analysis.results = results;
        logger.info('Analysis completed', { analysisId });
      })
      .catch((error) => {
        analysis.status = 'failed';
        analysis.error = error.message;
        logger.error('Analysis failed', { analysisId, error });
      });

    res.json({
      success: true,
      analysisId,
      status: 'running',
      message: 'Analysis started'
    });
  } catch (error) {
    logger.error('Analysis request failed', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/survey-experiments/quality
 * Run quality checks on survey data
 */
router.post('/quality', async (req: Request, res: Response) => {
  try {
    const { analysisId, checks } = req.body;

    if (!analysisId) {
      return res.status(400).json({
        success: false,
        error: 'analysisId is required'
      });
    }

    const analysis = analyses.get(analysisId);
    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found'
      });
    }

    if (!analysis.dataPath) {
      return res.status(400).json({
        success: false,
        error: 'No data file found for this analysis'
      });
    }

    // Run quality checks Python script
    const qualityScriptPath = path.join(
      __dirname,
      '../../../plugins/survey_experiments/run_quality_checks.py'
    );

    const results = await executePythonPlugin(
      qualityScriptPath,
      analysis.dataPath,
      { checks: checks || 'all' }
    );

    analysis.qualityChecks = results;

    logger.info('Quality checks completed', { analysisId });

    res.json({
      success: true,
      qualityChecks: results
    });
  } catch (error) {
    logger.error('Quality checks failed', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/survey-experiments/:id
 * Get analysis results
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const analysis = analyses.get(req.params.id);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found'
      });
    }

    // Don't send dataPath to client
    const { dataPath, ...safeAnalysis } = analysis;

    res.json({
      success: true,
      analysis: safeAnalysis
    });
  } catch (error) {
    logger.error('Failed to get analysis', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/survey-experiments
 * List all analyses
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const { status, analysisType, limit = 50 } = req.query;

    let results = Array.from(analyses.values());

    // Filter by status
    if (status) {
      results = results.filter(a => a.status === status);
    }

    // Filter by analysis type
    if (analysisType) {
      results = results.filter(a => a.analysisType === analysisType);
    }

    // Sort by created date (newest first)
    results.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Limit results
    results = results.slice(0, Number(limit));

    // Remove dataPath from results
    const safeResults = results.map(({ dataPath, ...rest }) => rest);

    res.json({
      success: true,
      count: safeResults.length,
      analyses: safeResults
    });
  } catch (error) {
    logger.error('Failed to list analyses', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/v1/survey-experiments/:id
 * Delete analysis and associated data
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const analysis = analyses.get(req.params.id);

    if (!analysis) {
      return res.status(404).json({
        success: false,
        error: 'Analysis not found'
      });
    }

    // Delete uploaded file
    if (analysis.dataPath) {
      try {
        await fs.unlink(analysis.dataPath);
      } catch (error) {
        logger.warn('Failed to delete data file', { error, path: analysis.dataPath });
      }
    }

    // Remove from memory
    analyses.delete(req.params.id);

    logger.info('Analysis deleted', { analysisId: req.params.id });

    res.json({
      success: true,
      message: 'Analysis deleted'
    });
  } catch (error) {
    logger.error('Failed to delete analysis', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
