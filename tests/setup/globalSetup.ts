/**
 * Jest global setup for integration tests
 * Detects available services (PostgreSQL, Redis) and configures test environment
 */

import { checkServices } from './detect-services';

export default async function globalSetup() {
  console.log('\n🔍 Checking service availability...\n');

  try {
    const services = await checkServices();

    if (services.postgres) {
      console.log('✅ PostgreSQL is available');
      process.env.POSTGRES_AVAILABLE = 'true';
    } else {
      console.log('⚠️  PostgreSQL is NOT available - integration tests will be skipped');
      process.env.POSTGRES_AVAILABLE = 'false';
    }

    if (services.redis) {
      console.log('✅ Redis is available');
      process.env.REDIS_AVAILABLE = 'true';
    } else {
      console.log('⚠️  Redis is NOT available - integration tests will be skipped');
      process.env.REDIS_AVAILABLE = 'false';
    }

    console.log('\n');
  } catch (error) {
    console.error('❌ Error checking services:', error);
    process.env.POSTGRES_AVAILABLE = 'false';
    process.env.REDIS_AVAILABLE = 'false';
  }
}
