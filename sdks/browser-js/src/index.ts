/**
 * Experimeh Browser JavaScript SDK
 *
 * A lightweight, TypeScript-first SDK for feature flag experimentation
 * in browser environments.
 *
 * @packageDocumentation
 */

export { ExperimentClient } from './client';
export { CacheManager } from './cache';

export {
  ExperimentError,
  NetworkError,
  ValidationError,
  CacheError,
  TimeoutError,
} from './errors';

export type {
  ExperimentClientConfig,
  Assignment,
  Experiment,
  Variant,
  MetricEvent,
  ExposureEvent,
  CacheEntry,
  APIResponse,
} from './types';
