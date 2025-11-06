# System Architecture

Comprehensive overview of the Experimeh feature flag and experimentation platform architecture.

## Table of Contents

1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow](#data-flow)
4. [Technology Stack](#technology-stack)
5. [Scaling Architecture](#scaling-architecture)
6. [Security & Privacy](#security--privacy)
7. [Deployment Architecture](#deployment-architecture)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Management Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Admin UI    │  │  Analysis    │  │  Monitoring  │         │
│  │  (React)     │  │  Dashboard   │  │  (Grafana)   │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
┌─────────┼──────────────────┼──────────────────┼─────────────────┐
│         │            Control Plane            │                 │
│  ┌──────▼───────────────────────────────────▼───────┐          │
│  │          Configuration Service (REST API)         │          │
│  │  - Experiment CRUD                                │          │
│  │  - Feature flag management                        │          │
│  │  - Targeting rules                                │          │
│  │  - User permissions                               │          │
│  └──────┬─────────────────────────────────┬──────────┘          │
│         │                                 │                     │
│  ┌──────▼─────────┐              ┌───────▼────────┐            │
│  │  PostgreSQL    │              │  Redis Cache   │            │
│  │  (Config DB)   │              │  (Hot Config)  │            │
│  └────────────────┘              └────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
          │                                 │
┌─────────┼─────────────────────────────────┼─────────────────────┐
│         │            Data Plane           │                     │
│  ┌──────▼───────────┐            ┌───────▼────────┐            │
│  │   Assignment     │◄───────────┤  Feature Flag  │            │
│  │   Service        │            │  Evaluation    │            │
│  │  (Node.js)       │            │  (Node.js)     │            │
│  └──────┬───────────┘            └────────┬───────┘            │
│         │                                 │                     │
│         │      ┌───────────────────┐      │                     │
│         └─────►│   Event Tracking  │◄─────┘                     │
│                │   Service         │                            │
│                │   (Node.js)       │                            │
│                └────────┬──────────┘                            │
└─────────────────────────┼─────────────────────────────────────-─┘
                          │
┌─────────────────────────┼─────────────────────────────────────-─┐
│                         │     Event Pipeline                     │
│                  ┌──────▼──────┐                                │
│                  │    Kafka    │                                │
│                  │   (Events)  │                                │
│                  └──────┬──────┘                                │
│                         │                                        │
│           ┌─────────────┴─────────────┐                         │
│           │                           │                         │
│    ┌──────▼─────────┐        ┌───────▼────────┐                │
│    │  Stream        │        │  Raw Event     │                │
│    │  Processor     │        │  Storage       │                │
│    │  (Flink)       │        │  (S3/Parquet)  │                │
│    └──────┬─────────┘        └────────────────┘                │
│           │                                                      │
│    ┌──────▼─────────┐                                           │
│    │  Aggregation   │                                           │
│    │  Storage       │                                           │
│    │  (TimescaleDB) │                                           │
│    └────────────────┘                                           │
└──────────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────┼─────────────────────────────────────-─┐
│                         │     Analysis Layer                     │
│                  ┌──────▼──────┐                                │
│                  │  Analysis   │                                │
│                  │  Engine     │                                │
│                  │  (Python)   │                                │
│                  └─────────────┘                                │
└──────────────────────────────────────────────────────────────────┘
          │
┌─────────▼─────────────────────────────────────────────────────-─┐
│                        Client SDKs                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │JavaScript│  │  Python  │  │   Java   │  │   Swift  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

### Design Principles

1. **Separation of Control and Data Planes**
   - Control plane: Configuration management (low throughput, high consistency)
   - Data plane: Assignment and tracking (high throughput, low latency)

2. **Immutability**
   - Assignments are deterministic and immutable
   - Events are append-only
   - Configurations are versioned

3. **Asynchronous Processing**
   - Event ingestion is asynchronous
   - Analysis is batch/stream processing
   - No blocking operations in critical path

4. **Horizontal Scalability**
   - Stateless services
   - Sharded data storage
   - Load balanced endpoints

5. **Resilience**
   - Circuit breakers for dependencies
   - Graceful degradation
   - Fallback values for feature flags

---

## Component Architecture

### Configuration Service

**Responsibilities**:
- Manage experiment and feature flag definitions
- Handle targeting rules
- Version control for configurations
- Access control and permissions
- Audit logging

**Tech Stack**:
- Framework: Express (Node.js/TypeScript)
- Database: PostgreSQL (JSONB for flexible schemas)
- Cache: Redis
- API: REST

**Key Endpoints**:
```
POST   /api/v1/experiments           Create experiment
GET    /api/v1/experiments/:id       Get experiment config
PUT    /api/v1/experiments/:id       Update experiment
DELETE /api/v1/experiments/:id       Delete experiment
GET    /api/v1/experiments           List experiments

POST   /api/v1/feature-flags         Create feature flag
GET    /api/v1/feature-flags/:key    Get flag config
PUT    /api/v1/feature-flags/:key    Update flag
```

**Database Schema**:
```sql
CREATE TABLE experiments (
  id UUID PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL,  -- draft, running, paused, completed
  design_type VARCHAR(50) NOT NULL,  -- ab, factorial, switchback, etc
  design_config JSONB,
  variants JSONB NOT NULL,
  targeting_rules JSONB,
  traffic_allocation DECIMAL(5,2),
  metrics JSONB,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  version INTEGER DEFAULT 1
);

CREATE INDEX idx_experiments_status ON experiments(status);
CREATE INDEX idx_experiments_key ON experiments(key);

CREATE TABLE feature_flags (
  id UUID PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  default_value JSONB,
  variants JSONB,
  targeting_rules JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50),  -- experiment, feature_flag
  entity_id UUID,
  action VARCHAR(50),  -- create, update, delete
  changes JSONB,
  user_id UUID,
  timestamp TIMESTAMP DEFAULT NOW()
);
```

### Assignment Service

**Responsibilities**:
- Deterministic variant assignment
- Traffic allocation
- Targeting rule evaluation
- Consistent hashing
- Assignment logging

**Tech Stack**:
- Framework: Express (Node.js/TypeScript)
- Cache: Redis (config cache, assignment cache)
- Database: PostgreSQL (assignment logs)

**Assignment Algorithm**:
```typescript
class AssignmentService {
  async getAssignment(
    userId: string,
    experimentId: string,
    context: Record<string, any>
  ): Promise<Assignment> {
    // 1. Get experiment config (cached)
    const experiment = await this.configCache.get(experimentId);

    if (!experiment || experiment.status !== 'running') {
      return { assigned: false, reason: 'experiment_not_running' };
    }

    // 2. Check targeting rules
    const targets = this.evaluateTargeting(experiment.targetingRules, context);
    if (!targets) {
      return { assigned: false, reason: 'targeting_excluded' };
    }

    // 3. Check traffic allocation
    const hash = this.hash(userId, experimentId);
    const bucket = (hash % 10000) / 100;  // 0-100

    if (bucket >= experiment.trafficAllocation) {
      return { assigned: false, reason: 'traffic_excluded' };
    }

    // 4. Determine variant (design-specific)
    const variant = this.assignVariant(userId, experiment);

    // 5. Log assignment (async, non-blocking)
    this.logAssignment({
      experimentId,
      userId,
      variant,
      timestamp: Date.now()
    });

    return {
      assigned: true,
      variant,
      experimentId
    };
  }

  private assignVariant(userId: string, experiment: Experiment): string {
    switch (experiment.designType) {
      case 'ab':
      case 'multivariate':
        return this.assignSimple(userId, experiment);

      case 'factorial':
        return this.assignFactorial(userId, experiment);

      case 'switchback':
        return this.assignSwitchback(Date.now(), experiment);

      case 'within_subjects':
        return this.assignWithinSubjects(userId, experiment);

      default:
        throw new Error(`Unknown design type: ${experiment.designType}`);
    }
  }

  private assignSimple(userId: string, experiment: Experiment): string {
    const hash = this.hash(userId, experiment.id, 'variant');
    const variantIndex = hash % experiment.variants.length;
    return experiment.variants[variantIndex].key;
  }

  private assignFactorial(userId: string, experiment: Experiment): string {
    const factors = experiment.designConfig.factors;
    const levels = factors.map(factor => {
      const hash = this.hash(userId, experiment.id, factor.name);
      const levelIndex = hash % factor.levels.length;
      return factor.levels[levelIndex];
    });

    return levels.join('_');
  }

  private hash(userId: string, ...parts: string[]): number {
    const input = [userId, ...parts].join(':');
    return murmurhash3(input);
  }
}
```

**Caching Strategy**:
```typescript
// Two-level cache: Memory + Redis

class CachedConfigService {
  private memoryCache = new LRU({ max: 1000, ttl: 60000 });  // 1 minute
  private redisCache: Redis;

  async getExperiment(id: string): Promise<Experiment> {
    // Level 1: Memory cache
    let config = this.memoryCache.get(id);
    if (config) return config;

    // Level 2: Redis cache
    const cached = await this.redisCache.get(`experiment:${id}`);
    if (cached) {
      config = JSON.parse(cached);
      this.memoryCache.set(id, config);
      return config;
    }

    // Level 3: Database
    config = await this.db.experiments.findById(id);

    // Populate caches
    await this.redisCache.setex(`experiment:${id}`, 300, JSON.stringify(config));
    this.memoryCache.set(id, config);

    return config;
  }

  async invalidate(id: string) {
    this.memoryCache.delete(id);
    await this.redisCache.del(`experiment:${id}`);
  }
}
```

### Event Tracking Service

**Responsibilities**:
- High-throughput event ingestion
- Event validation
- Batching and buffering
- Publishing to Kafka
- Backpressure handling

**Tech Stack**:
- Framework: Express (Node.js/TypeScript)
- Queue: In-memory batch queue
- Sink: Kafka

**Event Ingestion**:
```typescript
class EventTrackingService {
  private batchQueue: Event[] = [];
  private readonly BATCH_SIZE = 1000;
  private readonly FLUSH_INTERVAL = 1000;  // 1 second

  constructor(private kafka: Kafka) {
    // Flush periodically
    setInterval(() => this.flush(), this.FLUSH_INTERVAL);
  }

  async trackEvent(event: Event): Promise<void> {
    // Validate
    this.validate(event);

    // Add to batch
    this.batchQueue.push({
      ...event,
      ingestedAt: Date.now()
    });

    // Flush if batch full
    if (this.batchQueue.length >= this.BATCH_SIZE) {
      await this.flush();
    }
  }

  async trackBatch(events: Event[]): Promise<void> {
    events.forEach(e => this.validate(e));

    this.batchQueue.push(...events.map(e => ({
      ...e,
      ingestedAt: Date.now()
    })));

    if (this.batchQueue.length >= this.BATCH_SIZE) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, this.BATCH_SIZE);

    try {
      await this.kafka.send({
        topic: 'experiment-events',
        messages: batch.map(event => ({
          key: event.userId,
          value: JSON.stringify(event),
          timestamp: event.timestamp.toString()
        }))
      });

      console.log(`Flushed ${batch.length} events to Kafka`);
    } catch (error) {
      console.error('Failed to flush events:', error);

      // Re-queue (with limit to prevent memory leak)
      if (this.batchQueue.length < 10000) {
        this.batchQueue.unshift(...batch);
      } else {
        console.error('Queue full, dropping events');
      }
    }
  }

  private validate(event: Event): void {
    if (!event.userId) throw new Error('userId required');
    if (!event.experimentId) throw new Error('experimentId required');
    if (!event.timestamp) throw new Error('timestamp required');
    // ... more validations
  }
}
```

### Stream Processing (Apache Flink)

**Responsibilities**:
- Real-time event processing
- Aggregation
- Data enrichment
- Anomaly detection
- Metrics computation

**Processing Pipeline**:
```scala
// Flink job (Scala)
object ExperimentStreamProcessor {
  def main(args: Array[String]): Unit = {
    val env = StreamExecutionEnvironment.getExecutionEnvironment

    // Read from Kafka
    val events = env
      .addSource(new FlinkKafkaConsumer[Event](
        "experiment-events",
        new EventDeserializationSchema(),
        kafkaProps
      ))

    // Window by experiment + variant + minute
    val aggregated = events
      .keyBy(e => (e.experimentId, e.variant))
      .timeWindow(Time.minutes(1))
      .aggregate(new EventAggregator())

    // Write to TimescaleDB
    aggregated.addSink(new TimescaleDBSink())

    // Write raw events to S3
    events
      .addSink(new S3Sink(
        bucketName = "experiment-events",
        format = ParquetFormat
      ))

    env.execute("Experiment Stream Processor")
  }
}

class EventAggregator extends AggregateFunction[Event, EventAggregate, EventAggregate] {
  def createAccumulator(): EventAggregate = EventAggregate.empty

  def add(event: Event, acc: EventAggregate): EventAggregate = {
    acc.copy(
      count = acc.count + 1,
      sum = acc.sum + event.value.getOrElse(0),
      sumSquares = acc.sumSquares + math.pow(event.value.getOrElse(0), 2),
      min = math.min(acc.min, event.value.getOrElse(Double.MaxValue)),
      max = math.max(acc.max, event.value.getOrElse(Double.MinValue))
    )
  }

  def getResult(acc: EventAggregate): EventAggregate = acc

  def merge(a: EventAggregate, b: EventAggregate): EventAggregate = {
    a.copy(
      count = a.count + b.count,
      sum = a.sum + b.sum,
      sumSquares = a.sumSquares + b.sumSquares,
      min = math.min(a.min, b.min),
      max = math.max(a.max, b.max)
    )
  }
}
```

### Analysis Engine

**Responsibilities**:
- Statistical analysis
- Experiment results computation
- Report generation
- Power analysis
- Anomaly detection

**Tech Stack**:
- Language: Python
- Libraries: NumPy, SciPy, pandas
- Framework: FastAPI (for API)

**Analysis Service**:
```python
class AnalysisEngine:
    def analyze_experiment(self, experiment_id: str) -> AnalysisResult:
        # Fetch data
        data = self.fetch_experiment_data(experiment_id)
        experiment = self.get_experiment_config(experiment_id)

        # Select appropriate analysis method
        if experiment.design_type == 'ab':
            result = self.analyze_ab(data, experiment)
        elif experiment.design_type == 'factorial':
            result = self.analyze_factorial(data, experiment)
        elif experiment.design_type == 'switchback':
            result = self.analyze_switchback(data, experiment)
        elif experiment.design_type == 'within_subjects':
            result = self.analyze_within_subjects(data, experiment)

        # Apply corrections
        if experiment.metrics.secondary:
            result = self.apply_multiple_testing_correction(result)

        # Generate visualizations
        result.charts = self.generate_charts(data, result)

        # Store results
        self.store_results(experiment_id, result)

        return result

    def analyze_ab(self, data: pd.DataFrame, experiment: Experiment) -> AnalysisResult:
        control = data[data.variant == 'control']
        treatment = data[data.variant == 'treatment']

        metric_type = experiment.primary_metric.type

        if metric_type == 'proportion':
            result = stats.two_proportion_ztest(
                control['success'].sum(),
                len(control),
                treatment['success'].sum(),
                len(treatment)
            )
        elif metric_type == 'continuous':
            result = stats.welch_ttest(
                control['value'],
                treatment['value']
            )

        # Add Bayesian analysis
        bayesian_result = self.bayesian_analysis(control, treatment, metric_type)

        # Check guardrails
        guardrail_results = self.check_guardrails(data, experiment)

        return AnalysisResult(
            frequentist=result,
            bayesian=bayesian_result,
            guardrails=guardrail_results,
            sample_size=len(data),
            runtime_days=(data.timestamp.max() - data.timestamp.min()).days
        )
```

---

## Data Flow

### Assignment Flow

```
1. Client Request
   │
   ├─► GET /api/v1/assignments?userId=123&experimentIds=exp1,exp2
   │
2. Assignment Service
   │
   ├─► Check Memory Cache
   │   ├─► HIT: Return cached assignment
   │   └─► MISS: Continue
   │
   ├─► Check Redis Cache
   │   ├─► HIT: Return cached assignment, update memory cache
   │   └─► MISS: Continue
   │
   ├─► Compute Assignment
   │   ├─► Get Experiment Config (cached)
   │   ├─► Evaluate Targeting Rules
   │   ├─► Check Traffic Allocation
   │   ├─► Compute Variant (deterministic hash)
   │   └─► Log Assignment (async)
   │
   ├─► Update Caches (async)
   │
   └─► Return Assignment to Client

3. Assignment Log
   │
   ├─► Write to Kafka (async, batched)
   │
   └─► Flink processes and writes to DB
```

### Event Flow

```
1. Client Tracks Event
   │
   ├─► POST /api/v1/events
   │   Body: { userId, experimentId, eventType, value, timestamp }
   │
2. Event Tracking Service
   │
   ├─► Validate Event Schema
   │
   ├─► Add to Batch Queue (in-memory)
   │
   ├─► Return 202 Accepted (immediately)
   │
   └─► [Every 1 second OR when batch full]
       │
       └─► Flush Batch to Kafka

3. Kafka
   │
   ├─► Persist Event
   │
   └─► Fan out to consumers

4. Stream Processing (Flink)
   │
   ├─► Aggregate Events
   │   ├─► Window by (experiment, variant, minute)
   │   ├─► Compute stats (count, sum, mean, etc)
   │   └─► Write to TimescaleDB
   │
   ├─► Archive Raw Events
   │   └─► Write to S3 (Parquet format)
   │
   └─► Real-time Monitoring
       └─► Check for anomalies, alert if needed

5. Storage
   │
   ├─► TimescaleDB (aggregated metrics)
   │   └─► Used by: Dashboard, Analysis Engine
   │
   └─► S3 (raw events)
       └─► Used by: Batch analysis, Backfill, Audit
```

### Analysis Flow

```
1. User Requests Analysis
   │
   ├─► GET /api/v1/experiments/:id/results
   │
2. Analysis Engine
   │
   ├─► Check Cache
   │   ├─► HIT (< 5 min old): Return cached results
   │   └─► MISS: Compute fresh
   │
   ├─► Fetch Aggregated Data (TimescaleDB)
   │   └─► Query: Last N days of metrics by variant
   │
   ├─► Fetch Experiment Config
   │
   ├─► Run Statistical Analysis
   │   ├─► Select test based on design type
   │   ├─► Compute primary metric results
   │   ├─► Compute secondary metrics
   │   ├─► Check guardrails
   │   ├─► Apply corrections
   │   └─► Compute confidence intervals
   │
   ├─► Generate Visualizations
   │   ├─► Time series charts
   │   ├─► Distribution plots
   │   └─► Conversion funnels
   │
   ├─► Cache Results
   │
   └─► Return to User

3. User Views Dashboard
   │
   └─► Real-time updates from TimescaleDB aggregates
```

---

## Technology Stack

### Backend Services

| Component | Technology | Reasoning |
|-----------|-----------|-----------|
| Configuration Service | Node.js/TypeScript + Express | - Type safety<br>- Fast development<br>- Good async support<br>- Large ecosystem |
| Assignment Service | Node.js/TypeScript + Express | - Low latency required<br>- Stateless and scalable<br>- Easy integration with cache |
| Event Tracking | Node.js/TypeScript + Express | - High throughput<br>- Good async I/O<br>- Batching support |
| Stream Processing | Apache Flink (Scala) | - True streaming<br>- Exactly-once semantics<br>- Stateful processing<br>- Windowing support |
| Analysis Engine | Python + FastAPI | - Rich statistical libraries<br>- NumPy/SciPy/pandas<br>- Easy prototyping<br>- Notebook integration |

### Data Storage

| Component | Technology | Reasoning |
|-----------|-----------|-----------|
| Config Database | PostgreSQL | - ACID compliance<br>- JSONB for flexibility<br>- Strong consistency<br>- Rich querying |
| Cache | Redis | - Sub-millisecond latency<br>- In-memory performance<br>- TTL support<br>- Pub/sub for invalidation |
| Event Queue | Apache Kafka | - High throughput<br>- Durability<br>- Replay capability<br>- Multiple consumers |
| Time-Series | TimescaleDB | - PostgreSQL extension<br>- Efficient aggregation<br>- Continuous aggregates<br>- Retention policies |
| Object Storage | AWS S3 / MinIO | - Cost-effective<br>- Durability<br>- Scalability<br>- Parquet integration |

### Frontend

| Component | Technology | Reasoning |
|-----------|-----------|-----------|
| Admin UI | React + TypeScript | - Component-based<br>- Type safety<br>- Rich ecosystem<br>- Good testing support |
| State Management | Zustand | - Simple API<br>- No boilerplate<br>- TypeScript support |
| Charts | Recharts | - React integration<br>- Declarative API<br>- Customizable |
| UI Components | Ant Design | - Comprehensive<br>- Professional look<br>- Good documentation |

### SDKs

| Platform | Language | Framework |
|----------|----------|-----------|
| Web | JavaScript/TypeScript | Standalone library |
| Mobile (iOS) | Swift | SwiftPackage |
| Mobile (Android) | Kotlin | Gradle library |
| Backend (Node) | TypeScript | npm package |
| Backend (Python) | Python | pip package |
| Backend (Java) | Java | Maven artifact |

---

## Scaling Architecture

### Horizontal Scaling

**Stateless Services**:
```
         Load Balancer
              │
    ┌─────────┼─────────┐
    │         │         │
┌───▼───┐ ┌──▼────┐ ┌──▼────┐
│ App 1 │ │ App 2 │ │ App 3 │  (Assignment Service)
└───────┘ └───────┘ └───────┘
    │         │         │
    └─────────┼─────────┘
              │
         Shared Cache
         (Redis Cluster)
```

**Auto-Scaling Configuration**:
```yaml
# Kubernetes HorizontalPodAutoscaler
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: assignment-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: assignment-service
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "1000"
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
      - type: Pods
        value: 5
        periodSeconds: 30
```

### Database Scaling

**Read Replicas**:
```
┌──────────┐
│  Write   │◄──── Writes (Config updates)
│  Master  │
└────┬─────┘
     │ Replication
     ├──────────┬──────────┐
┌────▼───┐  ┌───▼────┐  ┌──▼─────┐
│ Read   │  │ Read   │  │ Read   │
│ Replica│  │ Replica│  │ Replica│
└────────┘  └────────┘  └────────┘
     │          │          │
     └──────────┴──────────┘
              │
        Read Queries
     (Assignment service)
```

**Partitioning (Sharding)**:
```
Events Table (Sharded by experiment_id)

Shard 1: experiment_id hash % 4 == 0
Shard 2: experiment_id hash % 4 == 1
Shard 3: experiment_id hash % 4 == 2
Shard 4: experiment_id hash % 4 == 3

-- PostgreSQL partitioning
CREATE TABLE events (
  id UUID,
  experiment_id UUID,
  user_id VARCHAR(255),
  timestamp TIMESTAMP,
  value DECIMAL,
  ...
) PARTITION BY HASH (experiment_id);

CREATE TABLE events_0 PARTITION OF events
  FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE events_1 PARTITION OF events
  FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE events_2 PARTITION OF events
  FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE events_3 PARTITION OF events
  FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

### Caching Layers

**Multi-Level Caching**:
```
Request
  │
  ├─► L1: In-Memory Cache (Node.js process)
  │   └─► TTL: 60 seconds
  │
  ├─► L2: Redis Cache (shared)
  │   └─► TTL: 5 minutes
  │
  └─► L3: Database (PostgreSQL)
      └─► Source of truth

Cache Hit Rates:
- L1: 80% (60% of total requests)
- L2: 15% (12% of total requests)
- L3: 5% (4% of total requests)
- Miss: 4% of total requests

Average Latency:
- L1 hit: 0.1ms
- L2 hit: 2ms
- L3 hit: 20ms
- Miss: 50ms
```

### CDN Integration

**Edge Caching for Client SDKs**:
```
┌─────────┐
│  User   │
└────┬────┘
     │
┌────▼────────────┐
│  CDN Edge Node  │  (Closest geographic location)
│  - Cache experiment configs
│  - Client-side assignment logic
│  - TTL: 5 minutes
└────┬────────────┘
     │ (Cache miss)
┌────▼────────────┐
│  Origin Server  │
│  - Full API
│  - Config service
└─────────────────┘

Benefits:
- Latency: 10ms (edge) vs 150ms (origin)
- Load reduction: 90% of requests served from edge
- Cost reduction: Lower origin traffic
```

---

## Security & Privacy

### Authentication & Authorization

**JWT-Based Auth**:
```typescript
interface JWTPayload {
  userId: string;
  email: string;
  roles: string[];  // ['admin', 'analyst', 'engineer']
  exp: number;
}

// Middleware
function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET) as JWTPayload;
    req.user = payload;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// Role-based access control
function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.some(role => req.user.roles.includes(role))) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Usage
app.post('/api/v1/experiments',
  authenticateJWT,
  requireRole('admin', 'engineer'),
  createExperiment
);
```

### Data Privacy

**PII Handling**:
```typescript
// Hash user IDs before storage
function hashUserId(userId: string): string {
  return crypto
    .createHash('sha256')
    .update(userId + process.env.HASH_SALT)
    .digest('hex');
}

// Store only hashed IDs
await db.events.insert({
  userIdHash: hashUserId(userId),  // Not storing raw userId
  experimentId,
  value,
  timestamp
});

// For GDPR/CCPA: Support user deletion
async function deleteUserData(userId: string) {
  const hashedId = hashUserId(userId);

  await db.events.deleteMany({ userIdHash: hashedId });
  await db.assignments.deleteMany({ userIdHash: hashedId });
  await db.exposures.deleteMany({ userIdHash: hashedId });
}
```

**Differential Privacy** (for sensitive metrics):
```typescript
// Add noise to protect individual privacy
function addLaplaceNoise(value: number, sensitivity: number, epsilon: number): number {
  const scale = sensitivity / epsilon;
  const u = Math.random() - 0.5;
  const noise = -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u));
  return value + noise;
}

// Example: Report conversion count with privacy guarantee
const trueCount = 1543;
const noisyCount = addLaplaceNoise(trueCount, sensitivity = 1, epsilon = 0.1);
// Returns: ~1540 (protects individual contributions)
```

### Security Best Practices

**API Rate Limiting**:
```typescript
import rateLimit from 'express-rate-limit';

const assignmentLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 1000,  // Max 1000 requests per minute per IP
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/v1/assignments', assignmentLimiter);
```

**Input Validation**:
```typescript
import { z } from 'zod';

const CreateExperimentSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string().min(1).max(255),
  designType: z.enum(['ab', 'multivariate', 'factorial', 'switchback']),
  variants: z.array(z.object({
    key: z.string(),
    allocation: z.number().min(0).max(100)
  })).min(2),
  trafficAllocation: z.number().min(0).max(100)
});

app.post('/api/v1/experiments', async (req, res) => {
  const parsed = CreateExperimentSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: parsed.error.issues
    });
  }

  // ... create experiment
});
```

---

## Deployment Architecture

### Infrastructure as Code (Terraform)

```hcl
# VPC and Networking
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"

  name = "experimeh-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  enable_vpn_gateway = false
}

# EKS Cluster
module "eks" {
  source = "terraform-aws-modules/eks/aws"

  cluster_name    = "experimeh-cluster"
  cluster_version = "1.28"

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  eks_managed_node_groups = {
    general = {
      min_size     = 3
      max_size     = 10
      desired_size = 5

      instance_types = ["t3.large"]
      capacity_type  = "ON_DEMAND"
    }
  }
}

# RDS PostgreSQL
module "db" {
  source = "terraform-aws-modules/rds/aws"

  identifier = "experimeh-db"

  engine               = "postgres"
  engine_version       = "15.3"
  family               = "postgres15"
  major_engine_version = "15"
  instance_class       = "db.r6g.xlarge"

  allocated_storage     = 100
  max_allocated_storage = 1000

  db_name  = "experimeh"
  username = "admin"
  port     = 5432

  multi_az               = true
  db_subnet_group_name   = module.vpc.database_subnet_group
  vpc_security_group_ids = [module.security_group.security_group_id]

  backup_retention_period = 7
  backup_window          = "03:00-06:00"
  maintenance_window     = "Mon:00:00-Mon:03:00"
}

# ElastiCache Redis
module "redis" {
  source = "terraform-aws-modules/elasticache/aws"

  cluster_id               = "experimeh-cache"
  engine                   = "redis"
  node_type                = "cache.r6g.large"
  num_cache_nodes          = 3
  parameter_group_family   = "redis7"

  subnet_ids = module.vpc.private_subnets

  automatic_failover_enabled = true
  multi_az_enabled           = true
}

# MSK (Managed Kafka)
resource "aws_msk_cluster" "experimeh" {
  cluster_name           = "experimeh-kafka"
  kafka_version          = "3.5.1"
  number_of_broker_nodes = 3

  broker_node_group_info {
    instance_type   = "kafka.m5.large"
    client_subnets  = module.vpc.private_subnets
    security_groups = [aws_security_group.kafka.id]

    storage_info {
      ebs_storage_info {
        volume_size = 100
      }
    }
  }
}
```

### Kubernetes Deployment

```yaml
# assignment-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: assignment-service
  namespace: experimeh
spec:
  replicas: 5
  selector:
    matchLabels:
      app: assignment-service
  template:
    metadata:
      labels:
        app: assignment-service
        version: v1.0.0
    spec:
      containers:
      - name: assignment-service
        image: experimeh/assignment-service:v1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: url
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: assignment-service
  namespace: experimeh
spec:
  selector:
    app: assignment-service
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer

---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: experimeh-ingress
  namespace: experimeh
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - api.experimeh.com
    secretName: experimeh-tls
  rules:
  - host: api.experimeh.com
    http:
      paths:
      - path: /api/v1/assignments
        pathType: Prefix
        backend:
          service:
            name: assignment-service
            port:
              number: 80
      - path: /api/v1/experiments
        pathType: Prefix
        backend:
          service:
            name: config-service
            port:
              number: 80
```

### Monitoring & Observability

**Prometheus Metrics**:
```typescript
import { Counter, Histogram, Gauge } from 'prom-client';

// Assignment metrics
const assignmentCounter = new Counter({
  name: 'assignments_total',
  help: 'Total number of assignments',
  labelNames: ['experiment_id', 'variant']
});

const assignmentDuration = new Histogram({
  name: 'assignment_duration_seconds',
  help: 'Assignment latency in seconds',
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
});

const activeExperiments = new Gauge({
  name: 'active_experiments',
  help: 'Number of currently active experiments'
});

// Instrument code
async function getAssignment(userId, experimentId) {
  const timer = assignmentDuration.startTimer();

  try {
    const assignment = await computeAssignment(userId, experimentId);

    assignmentCounter.inc({
      experiment_id: experimentId,
      variant: assignment.variant
    });

    return assignment;
  } finally {
    timer();
  }
}
```

**Grafana Dashboards**:
```yaml
# Example dashboard config
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboards
data:
  experimeh-dashboard.json: |
    {
      "dashboard": {
        "title": "Experimeh Platform",
        "panels": [
          {
            "title": "Assignment Latency (p95)",
            "targets": [
              {
                "expr": "histogram_quantile(0.95, assignment_duration_seconds_bucket)"
              }
            ]
          },
          {
            "title": "Assignments per Second",
            "targets": [
              {
                "expr": "rate(assignments_total[1m])"
              }
            ]
          },
          {
            "title": "Active Experiments",
            "targets": [
              {
                "expr": "active_experiments"
              }
            ]
          }
        ]
      }
    }
```

---

## Summary

### Key Architectural Decisions

1. **Separation of Concerns**
   - Control plane (configuration) separate from data plane (assignment)
   - Stateless services for easy scaling
   - Async event processing for performance

2. **High Availability**
   - Multi-AZ deployments
   - Auto-scaling based on load
   - Circuit breakers and fallbacks
   - Read replicas for database

3. **Performance**
   - Multi-level caching (memory, Redis, CDN)
   - Client-side assignment computation
   - Batched event processing
   - Pre-aggregated metrics

4. **Scalability**
   - Horizontal scaling for all services
   - Database sharding for large datasets
   - Kafka for event streaming
   - Time-series optimization

5. **Security & Privacy**
   - JWT authentication
   - Role-based access control
   - PII hashing
   - Rate limiting
   - Input validation

### Technology Highlights

| Layer | Technology | Key Benefit |
|-------|-----------|-------------|
| API | Node.js/TypeScript | Type safety, async performance |
| Streaming | Apache Flink | Exactly-once, stateful processing |
| Analysis | Python | Rich statistical libraries |
| Cache | Redis | Sub-ms latency |
| Database | PostgreSQL | ACID, JSONB flexibility |
| Queue | Kafka | High throughput, durability |
| Orchestration | Kubernetes | Auto-scaling, self-healing |

---

## Additional Resources

- [Best Practices](./BEST_PRACTICES.md)
- [Statistical Guide](./STATISTICAL_GUIDE.md)
- [Design Patterns](./DESIGN_PATTERNS.md)
- [Troubleshooting](./TROUBLESHOOTING.md)
- [Contributing](./CONTRIBUTING.md)
