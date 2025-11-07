/**
 * Plugin API Routes
 *
 * REST API endpoints for plugin discovery, validation, and execution.
 *
 * Endpoints:
 * - GET    /api/plugins              - List all available plugins
 * - GET    /api/plugins/:name        - Get plugin details
 * - POST   /api/plugins/:name/validate - Validate plugin for experiment
 * - POST   /api/plugins/:name/execute  - Execute plugin analysis
 * - GET    /api/plugins/:name/metrics  - Get plugin execution metrics
 */

import express from 'express';
import { PluginManager } from '../../plugins';
import { ILogger } from '../../types/interfaces';

export function createPluginRoutes(
  pluginManager: PluginManager,
  logger: ILogger
): express.Router {
  const router = express.Router();

  /**
   * GET /api/plugins
   * List all available plugins
   */
  router.get('/', (req, res) => {
    try {
      const plugins = pluginManager.listPlugins();
      res.json({
        success: true,
        count: plugins.length,
        plugins
      });
    } catch (error) {
      logger.error('Failed to list plugins', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/plugins/:name
   * Get plugin details
   */
  router.get('/:name', (req, res) => {
    try {
      const plugin = pluginManager.getPlugin(req.params.name);

      if (!plugin) {
        return res.status(404).json({
          success: false,
          error: `Plugin not found: ${req.params.name}`
        });
      }

      res.json({
        success: true,
        plugin
      });
    } catch (error) {
      logger.error('Failed to get plugin', { error, name: req.params.name });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/plugins/:name/validate
   * Validate plugin for experiment
   *
   * Body: {
   *   designType: string,
   *   metrics: string[]
   * }
   */
  router.post('/:name/validate', (req, res) => {
    try {
      const { designType, metrics } = req.body;

      if (!designType || !metrics) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: designType, metrics'
        });
      }

      const validation = pluginManager.validatePluginForExperiment(
        req.params.name,
        designType,
        metrics
      );

      res.json({
        success: validation.valid,
        validation
      });
    } catch (error) {
      logger.error('Plugin validation failed', {
        error,
        name: req.params.name
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /api/plugins/:name/execute
   * Execute plugin analysis
   *
   * Body: {
   *   data: any[],
   *   config: AnalysisConfig
   * }
   */
  router.post('/:name/execute', async (req, res) => {
    try {
      const { data, config } = req.body;

      if (!data || !config) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: data, config'
        });
      }

      const result = await pluginManager.executePlugin({
        pluginName: req.params.name,
        data,
        config
      });

      res.json({
        success: true,
        result
      });
    } catch (error) {
      logger.error('Plugin execution failed', {
        error,
        name: req.params.name
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/plugins/:name/metrics
   * Get plugin execution metrics
   */
  router.get('/:name/metrics', (req, res) => {
    try {
      const metrics = pluginManager.getExecutionMetrics(req.params.name);
      const avgExecutionTime = pluginManager.getAverageExecutionTime(req.params.name);
      const successRate = pluginManager.getSuccessRate(req.params.name);

      res.json({
        success: true,
        metrics: {
          executions: metrics.length,
          avgExecutionTime,
          successRate,
          recentExecutions: metrics.slice(-10) // Last 10
        }
      });
    } catch (error) {
      logger.error('Failed to get plugin metrics', {
        error,
        name: req.params.name
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/plugins/design/:designType
   * Get plugins by design type
   */
  router.get('/design/:designType', (req, res) => {
    try {
      const plugins = pluginManager.getPluginsByDesignType(req.params.designType);

      res.json({
        success: true,
        designType: req.params.designType,
        count: plugins.length,
        plugins
      });
    } catch (error) {
      logger.error('Failed to get plugins by design type', {
        error,
        designType: req.params.designType
      });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}
