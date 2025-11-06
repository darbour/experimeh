/**
 * Kafka implementation of IEventQueue
 * Provides reliable event streaming for exposures and metrics
 */

import { Kafka, Producer, Consumer, Admin, Partitioners, ProducerRecord, EachMessagePayload } from 'kafkajs';
import { IEventQueue } from '../types/interfaces';
import { Logger } from '../utils/logger';
import { ConfigurationError } from '../utils/errors';

export interface KafkaAdapterConfig {
  brokers?: string[];
  clientId?: string;
  connectionTimeout?: number;
  requestTimeout?: number;
  retry?: {
    maxRetryTime?: number;
    initialRetryTime?: number;
    retries?: number;
  };
  ssl?: boolean;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
}

export interface KafkaTopics {
  exposures: string;
  metrics: string;
  assignments: string;
}

/**
 * Kafka event queue adapter implementation
 */
export class KafkaAdapter implements IEventQueue {
  private kafka: Kafka;
  private producer: Producer | null = null;
  private consumers: Map<string, Consumer> = new Map();
  private admin: Admin | null = null;
  private logger: Logger;
  private topics: KafkaTopics;
  private connected: boolean = false;

  constructor(config?: KafkaAdapterConfig, topics?: Partial<KafkaTopics>, logger?: Logger) {
    this.logger = logger || new Logger(undefined, 'KafkaAdapter');

    // Default topics
    this.topics = {
      exposures: topics?.exposures || process.env.KAFKA_TOPIC_EXPOSURES || 'experimeh.exposures',
      metrics: topics?.metrics || process.env.KAFKA_TOPIC_METRICS || 'experimeh.metrics',
      assignments: topics?.assignments || process.env.KAFKA_TOPIC_ASSIGNMENTS || 'experimeh.assignments',
    };

    // Parse brokers from config or environment
    const brokers =
      config?.brokers ||
      (process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092']);

    this.kafka = new Kafka({
      clientId: config?.clientId || process.env.KAFKA_CLIENT_ID || 'experimeh',
      brokers,
      connectionTimeout: config?.connectionTimeout || 10000,
      requestTimeout: config?.requestTimeout || 30000,
      retry: {
        maxRetryTime: config?.retry?.maxRetryTime || 30000,
        initialRetryTime: config?.retry?.initialRetryTime || 300,
        retries: config?.retry?.retries || 8,
      },
      ssl: config?.ssl || process.env.KAFKA_SSL === 'true',
      sasl: config?.sasl || this.parseSaslConfig(),
      logLevel: this.getLogLevel(),
    });
  }

  /**
   * Initialize Kafka producer and create topics
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      // Create producer with idempotent writes
      this.producer = this.kafka.producer({
        idempotent: true,
        maxInFlightRequests: 5,
        transactionalId: undefined,
        createPartitioner: Partitioners.DefaultPartitioner,
      });

      await this.producer.connect();
      this.logger.info('Kafka producer connected successfully');

      // Create admin client to manage topics
      this.admin = this.kafka.admin();
      await this.admin.connect();
      this.logger.info('Kafka admin client connected');

      // Ensure topics exist
      await this.ensureTopicsExist();

      this.connected = true;
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to connect to Kafka', { error: err.message });
      throw new ConfigurationError('Failed to connect to Kafka', { error: err.message });
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect(): Promise<void> {
    try {
      // Disconnect producer
      if (this.producer) {
        await this.producer.disconnect();
        this.logger.info('Kafka producer disconnected');
        this.producer = null;
      }

      // Disconnect all consumers
      for (const [topic, consumer] of this.consumers.entries()) {
        await consumer.disconnect();
        this.logger.info('Kafka consumer disconnected', { topic });
      }
      this.consumers.clear();

      // Disconnect admin
      if (this.admin) {
        await this.admin.disconnect();
        this.logger.info('Kafka admin client disconnected');
        this.admin = null;
      }

      this.connected = false;
    } catch (error) {
      const err = error as Error;
      this.logger.error('Error disconnecting from Kafka', { error: err.message });
      throw error;
    }
  }

  /**
   * Publish multiple messages to a topic
   */
  async publish(topic: string, messages: any[]): Promise<void> {
    if (!this.producer) {
      throw new ConfigurationError('Kafka producer not connected');
    }

    try {
      const kafkaMessages = messages.map((message) => ({
        value: JSON.stringify(message),
        timestamp: Date.now().toString(),
      }));

      const record: ProducerRecord = {
        topic,
        messages: kafkaMessages,
        compression: 1, // GZIP compression
      };

      await this.producer.send(record);

      this.logger.debug('Messages published to Kafka', { topic, count: messages.length });
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to publish messages to Kafka', {
        error: err.message,
        topic,
        count: messages.length,
      });
      throw new ConfigurationError('Failed to publish messages', { error: err.message, topic });
    }
  }

  /**
   * Publish single message to a topic
   */
  async publishSingle(topic: string, message: any): Promise<void> {
    await this.publish(topic, [message]);
  }

  /**
   * Subscribe to a topic and process messages
   */
  async subscribe(topic: string, handler: (message: any) => Promise<void>): Promise<void> {
    try {
      // Check if already subscribed to this topic
      if (this.consumers.has(topic)) {
        this.logger.warn('Already subscribed to topic', { topic });
        return;
      }

      // Create consumer with unique group ID
      const consumer = this.kafka.consumer({
        groupId: `${process.env.KAFKA_CONSUMER_GROUP || 'experimeh-consumers'}-${topic}`,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        maxBytesPerPartition: 1048576, // 1MB
        maxWaitTimeInMs: 5000,
      });

      await consumer.connect();
      this.logger.info('Kafka consumer connected', { topic });

      // Subscribe to topic
      await consumer.subscribe({ topic, fromBeginning: false });

      // Start consuming messages
      await consumer.run({
        eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
          try {
            if (!message.value) {
              this.logger.warn('Received empty message', { topic, partition });
              return;
            }

            const payload = JSON.parse(message.value.toString());
            await handler(payload);

            this.logger.debug('Message processed', { topic, partition, offset: message.offset });
          } catch (error) {
            const err = error as Error;
            this.logger.error('Error processing message', {
              error: err.message,
              topic,
              partition,
              offset: message.offset,
            });
            // Don't throw - let consumer continue processing
          }
        },
      });

      // Store consumer reference
      this.consumers.set(topic, consumer);

      this.logger.info('Subscribed to Kafka topic', { topic });
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to subscribe to Kafka topic', { error: err.message, topic });
      throw new ConfigurationError('Failed to subscribe to topic', { error: err.message, topic });
    }
  }

  // ==================== CONVENIENCE METHODS ====================

  /**
   * Publish exposure event
   */
  async publishExposure(exposure: any): Promise<void> {
    await this.publishSingle(this.topics.exposures, {
      ...exposure,
      eventType: 'exposure',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Publish metric event
   */
  async publishMetric(metric: any): Promise<void> {
    await this.publishSingle(this.topics.metrics, {
      ...metric,
      eventType: 'metric',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Publish assignment event
   */
  async publishAssignment(assignment: any): Promise<void> {
    await this.publishSingle(this.topics.assignments, {
      ...assignment,
      eventType: 'assignment',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Batch publish exposure events
   */
  async publishExposureBatch(exposures: any[]): Promise<void> {
    const events = exposures.map((exposure) => ({
      ...exposure,
      eventType: 'exposure',
      timestamp: new Date().toISOString(),
    }));
    await this.publish(this.topics.exposures, events);
  }

  /**
   * Batch publish metric events
   */
  async publishMetricBatch(metrics: any[]): Promise<void> {
    const events = metrics.map((metric) => ({
      ...metric,
      eventType: 'metric',
      timestamp: new Date().toISOString(),
    }));
    await this.publish(this.topics.metrics, events);
  }

  // ==================== ADMIN OPERATIONS ====================

  /**
   * Ensure required topics exist
   */
  private async ensureTopicsExist(): Promise<void> {
    if (!this.admin) {
      throw new ConfigurationError('Kafka admin client not connected');
    }

    try {
      const existingTopics = await this.admin.listTopics();
      const requiredTopics = Object.values(this.topics);

      const topicsToCreate = requiredTopics.filter((topic) => !existingTopics.includes(topic));

      if (topicsToCreate.length > 0) {
        await this.admin.createTopics({
          topics: topicsToCreate.map((topic) => ({
            topic,
            numPartitions: parseInt(process.env.KAFKA_TOPIC_PARTITIONS || '3', 10),
            replicationFactor: parseInt(process.env.KAFKA_TOPIC_REPLICATION || '1', 10),
            configEntries: [
              { name: 'retention.ms', value: '604800000' }, // 7 days
              { name: 'compression.type', value: 'gzip' },
            ],
          })),
          waitForLeaders: true,
        });

        this.logger.info('Kafka topics created', { topics: topicsToCreate });
      } else {
        this.logger.info('All Kafka topics already exist');
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to ensure Kafka topics exist', { error: err.message });
      throw new ConfigurationError('Failed to create Kafka topics', { error: err.message });
    }
  }

  /**
   * Get topic metadata
   */
  async getTopicMetadata(topic: string): Promise<any> {
    if (!this.admin) {
      throw new ConfigurationError('Kafka admin client not connected');
    }

    try {
      const metadata = await this.admin.fetchTopicMetadata({ topics: [topic] });
      return metadata.topics[0];
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to fetch topic metadata', { error: err.message, topic });
      throw new ConfigurationError('Failed to fetch topic metadata', { error: err.message, topic });
    }
  }

  /**
   * Delete topic (use with caution!)
   */
  async deleteTopic(topic: string): Promise<void> {
    if (!this.admin) {
      throw new ConfigurationError('Kafka admin client not connected');
    }

    try {
      await this.admin.deleteTopics({ topics: [topic] });
      this.logger.warn('Kafka topic deleted', { topic });
    } catch (error) {
      const err = error as Error;
      this.logger.error('Failed to delete topic', { error: err.message, topic });
      throw new ConfigurationError('Failed to delete topic', { error: err.message, topic });
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Parse SASL configuration from environment
   */
  private parseSaslConfig(): any {
    if (!process.env.KAFKA_SASL_ENABLED || process.env.KAFKA_SASL_ENABLED !== 'true') {
      return undefined;
    }

    return {
      mechanism: (process.env.KAFKA_SASL_MECHANISM || 'plain') as any,
      username: process.env.KAFKA_SASL_USERNAME || '',
      password: process.env.KAFKA_SASL_PASSWORD || '',
    };
  }

  /**
   * Get Kafka log level based on application log level
   */
  private getLogLevel(): number {
    const level = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    const logLevels: Record<string, number> = {
      debug: 5,
      info: 4,
      warn: 3,
      error: 2,
    };
    return logLevels[level] || 4;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.admin) {
        return false;
      }
      await this.admin.listTopics();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get producer metrics
   */
  getProducerMetrics(): any {
    // KafkaJS doesn't expose metrics directly, but we can add custom tracking
    return {
      connected: this.connected,
      subscribedTopics: Array.from(this.consumers.keys()),
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Initiating Kafka graceful shutdown');

    try {
      // Flush any pending messages
      if (this.producer) {
        // KafkaJS producer doesn't have explicit flush, but disconnect waits for pending sends
        await this.producer.disconnect();
      }

      await this.disconnect();
      this.logger.info('Kafka graceful shutdown completed');
    } catch (error) {
      const err = error as Error;
      this.logger.error('Error during Kafka shutdown', { error: err.message });
      throw error;
    }
  }
}
