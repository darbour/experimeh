/**
 * Service detection utilities for integration tests
 * Detects whether PostgreSQL and Redis are available
 */

import { Client } from 'pg';
import { createClient } from 'redis';

interface ServiceStatus {
  postgres: boolean;
  redis: boolean;
}

/**
 * Check if PostgreSQL is available
 */
export async function isPostgresAvailable(): Promise<boolean> {
  const client = new Client({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'experimeh',
    password: process.env.POSTGRES_PASSWORD || 'test_password',
    database: process.env.POSTGRES_DB || 'experimeh_test',
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
    await client.end();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  const client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  });

  try {
    await client.connect();
    await client.ping();
    await client.quit();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check availability of all required services
 */
export async function checkServices(): Promise<ServiceStatus> {
  const [postgres, redis] = await Promise.all([
    isPostgresAvailable(),
    isRedisAvailable(),
  ]);

  return { postgres, redis };
}

/**
 * Wait for services to be ready (used in CI)
 */
export async function waitForServices(
  timeoutMs: number = 30000,
  intervalMs: number = 1000
): Promise<ServiceStatus> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const status = await checkServices();

    if (status.postgres && status.redis) {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  // Return final status even if not all services are ready
  return await checkServices();
}
