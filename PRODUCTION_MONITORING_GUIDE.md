# Production Monitoring & Observability Guide

**Purpose**: Comprehensive guide for monitoring the experiment platform in production

**Last Updated**: 2025-11-11

---

## Executive Summary

This guide covers:
- Key metrics to monitor
- Alert thresholds and actions
- Logging strategy
- Dashboard setup
- Incident response procedures

---

## 1. System Architecture Monitoring

### 1.1 Service Health Checks

**Services to Monitor**:

| Service | Endpoint | Expected Response | Check Interval |
|---------|----------|-------------------|----------------|
| Backend API | `GET /health` | 200 OK | 30 seconds |
| PostgreSQL | Connection test | Success | 60 seconds |
| Redis | `PING` | PONG | 60 seconds |
| Kafka | Broker connection | Connected | 60 seconds |
| Dashboard | `GET /` | 200 OK | 60 seconds |

**Alert Conditions**:
- 🔴 **Critical**: Service down for >2 minutes
- 🟠 **Warning**: Service response time >1s
- 🟡 **Info**: Service restarted

### 1.2 Infrastructure Metrics

**Database (PostgreSQL)**:
- Connections: Current/Max (Alert if >80% of max)
- Query latency: P50, P95, P99 (Alert if P95 >500ms)
- Disk usage: % used (Alert if >80%)
- Replication lag: milliseconds (Alert if >5s)

**Cache (Redis)**:
- Memory usage: % used (Alert if >80%)
- Cache hit rate: % (Alert if <80%)
- Evicted keys: count/minute (Alert if >1000)
- Connected clients: count (Alert if >80% of maxclients)

**Message Queue (Kafka)**:
- Broker lag: messages (Alert if >100,000)
- Consumer lag: messages (Alert if >10,000)
- Partition count: per topic
- Under-replicated partitions: count (Alert if >0)

---

## 2. Application Metrics

### 2.1 API Performance

**Request Metrics**:
```
# Prometheus format examples
api_requests_total{method="POST", endpoint="/experiments", status="201"}
api_request_duration_seconds{method="POST", endpoint="/experiments"}
api_errors_total{method="POST", endpoint="/experiments", error_type="validation"}
```

**Key Endpoints to Monitor**:

| Endpoint | Metric | Threshold | Action |
|----------|--------|-----------|--------|
| `POST /api/v1/experiments` | P95 latency | <500ms | Investigate if exceeded |
| `GET /api/v1/flags` | P95 latency | <100ms | Investigate if exceeded |
| `GET /api/v1/experiments` | P95 latency | <200ms | Investigate if exceeded |
| `POST /api/v1/flags` | Error rate | <1% | Alert if exceeded |

**Alerts**:
- 🔴 **Critical**: P99 latency >5s for any endpoint
- 🔴 **Critical**: Error rate >5% for 5 minutes
- 🟠 **Warning**: P95 latency exceeds threshold for 5 minutes
- 🟡 **Info**: Unusual spike in traffic (>2x normal)

### 2.2 Experiment Creation Metrics

**Track**:
```typescript
experiment_creation_total{design_type="ab"}
experiment_creation_duration_seconds{design_type="factorial"}
experiment_creation_errors_total{error_type="validation"}
experiment_validation_failures_total{field="experimentKey"}
```

**Business Metrics**:
- Experiments created per day (by design type)
- Average time to create experiment (from wizard start to completion)
- Validation error rate by field
- Abandoned wizard sessions (% of started but not completed)

**Alerts**:
- 🟠 **Warning**: Zero experiments created in 24 hours (production issue?)
- 🟡 **Info**: Unusual spike in factorial experiments (new feature adoption?)
- 🟠 **Warning**: Validation error rate >20% (UX issue?)

### 2.3 Feature Flag Operations

**Track**:
```typescript
feature_flag_created_total
feature_flag_evaluation_total{flag_key="checkout-button"}
feature_flag_evaluation_duration_seconds
feature_flag_cache_hits_total
feature_flag_cache_misses_total
```

**Alerts**:
- 🔴 **Critical**: Cache hit rate <70% (performance degradation)
- 🟠 **Warning**: Flag evaluation P95 >50ms (should be <10ms)
- 🟡 **Info**: New flag created

### 2.4 Validation System

**Track**:
```typescript
validation_errors_total{field="experimentKey", error_type="format"}
validation_errors_total{field="variantCount", design_type="ab"}
validation_duration_seconds{validator="experimentKey"}
```

**Monitor**:
- Most common validation errors (improve UX)
- Fields with high error rates (add better hints)
- Validation performance (should be <10ms)

**Alerts**:
- 🟠 **Warning**: Specific validation error >30% of all errors (UX issue)
- 🟡 **Info**: New validation error type appears

---

## 3. Logging Strategy

### 3.1 Log Levels

**Production Logging**:
- `ERROR`: Critical errors requiring immediate attention
- `WARN`: Potential issues that don't stop execution
- `INFO`: Important business events (experiment created, flag updated)
- `DEBUG`: Detailed diagnostic information (disabled in production)

### 3.2 Structured Logging Format

**Use JSON format**:
```json
{
  "timestamp": "2025-11-11T12:00:00.000Z",
  "level": "INFO",
  "service": "experiment-api",
  "event": "experiment_created",
  "data": {
    "experimentId": "exp-123",
    "designType": "ab",
    "featureFlagId": "flag-456",
    "userId": "user-789"
  },
  "requestId": "req-abc-123",
  "duration": 245
}
```

### 3.3 What to Log

**Critical Events**:
- ✅ Experiment created/updated/deleted
- ✅ Feature flag created/updated/deleted
- ✅ Validation failures (with field and reason)
- ✅ API errors (with stack trace and request context)
- ✅ Database connection failures
- ✅ Cache failures
- ✅ Authentication/authorization failures

**DO NOT Log**:
- ❌ Personally Identifiable Information (PII)
- ❌ API keys or secrets
- ❌ Full request/response bodies (only metadata)
- ❌ User passwords (obviously)

### 3.4 Log Aggregation

**Recommended Tools**:
- **ELK Stack**: Elasticsearch + Logstash + Kibana
- **Grafana Loki**: Lightweight log aggregation
- **Datadog**: Full observability platform
- **CloudWatch Logs**: AWS native solution

**Log Retention**:
- ERROR logs: 90 days
- WARN logs: 30 days
- INFO logs: 14 days
- DEBUG logs: Not logged in production

---

## 4. Dashboard Setup

### 4.1 System Health Dashboard

**Panels**:
1. **Service Status** (top row)
   - API: 🟢/🔴 + uptime %
   - Database: 🟢/🔴 + connection count
   - Cache: 🟢/🔴 + memory usage
   - Queue: 🟢/🔴 + lag

2. **API Performance** (row 2)
   - Requests per second (line graph)
   - P95 latency by endpoint (line graph)
   - Error rate % (line graph)
   - Success rate % (gauge)

3. **Resource Usage** (row 3)
   - CPU usage % (gauge)
   - Memory usage % (gauge)
   - Disk I/O (line graph)
   - Network throughput (line graph)

### 4.2 Business Metrics Dashboard

**Panels**:
1. **Experiment Activity** (top row)
   - Experiments created today (big number)
   - Active experiments (big number)
   - Total experiments (big number)
   - Experiments by design type (pie chart)

2. **Feature Flags** (row 2)
   - Total flags (big number)
   - Flags by status (bar chart)
   - Flags by environment (bar chart)
   - Recent flag changes (table)

3. **User Activity** (row 3)
   - Wizard sessions started (line graph)
   - Wizard completion rate % (gauge)
   - Average time to create experiment (line graph)
   - Validation errors by field (bar chart)

### 4.3 Validation Dashboard

**Panels**:
1. **Validation Errors** (top row)
   - Total errors today (big number)
   - Error rate % (gauge)
   - Top 5 error messages (table)
   - Errors by field (bar chart)

2. **Field-Specific Analysis** (row 2)
   - `experimentKey` errors (line graph + examples)
   - `variantCount` errors (line graph by design type)
   - `primaryMetric` errors (line graph)
   - Other field errors (line graph)

3. **User Impact** (row 3)
   - Sessions with validation errors % (gauge)
   - Average errors per failed session (big number)
   - Time lost to fixing errors (calculated)

---

## 5. Alerting Strategy

### 5.1 Alert Channels

**Severity Levels**:
- 🔴 **Critical**: PagerDuty + Slack #incidents + Email
- 🟠 **Warning**: Slack #alerts + Email (during business hours)
- 🟡 **Info**: Slack #monitoring (no paging)

### 5.2 Alert Rules

**Critical Alerts** (immediate response required):

```yaml
- name: API Down
  condition: http_status != 200 for 2 minutes
  severity: critical
  action: Page on-call engineer

- name: Database Connection Failed
  condition: db_connection_errors > 10 in 1 minute
  severity: critical
  action: Page on-call engineer + DBA

- name: High Error Rate
  condition: error_rate > 5% for 5 minutes
  severity: critical
  action: Page on-call engineer

- name: Disk Space Critical
  condition: disk_usage > 90%
  severity: critical
  action: Page on-call engineer + ops team
```

**Warning Alerts** (investigate during business hours):

```yaml
- name: High Latency
  condition: p95_latency > threshold for 10 minutes
  severity: warning
  action: Notify team channel

- name: Cache Hit Rate Low
  condition: cache_hit_rate < 70% for 10 minutes
  severity: warning
  action: Notify team channel

- name: Validation Error Spike
  condition: validation_errors > 2x baseline for 15 minutes
  severity: warning
  action: Notify team channel + UX team

- name: No Experiments Created
  condition: experiments_created_24h == 0
  severity: warning
  action: Notify team channel
```

### 5.3 Alert Runbooks

**For Each Alert, Document**:
1. **Description**: What does this alert mean?
2. **Impact**: What is affected?
3. **Diagnosis**: How to investigate?
4. **Remediation**: How to fix?
5. **Prevention**: How to prevent in future?

**Example Runbook**:

```markdown
## Alert: API High Latency

**Description**: P95 latency exceeded 500ms for 10+ minutes

**Impact**: Users experience slow response times

**Diagnosis**:
1. Check API dashboard for slow endpoints
2. Check database query performance
3. Check external service dependencies
4. Check CPU/memory usage
5. Review recent deployments

**Remediation**:
1. If database: optimize slow queries or add indexes
2. If external service: implement circuit breaker
3. If CPU/memory: scale horizontally
4. If deployment issue: rollback

**Prevention**:
- Load testing before deployment
- Query performance monitoring
- Proper capacity planning
```

---

## 6. Incident Response

### 6.1 Severity Levels

| Severity | Definition | Example | Response Time |
|----------|-----------|---------|---------------|
| **SEV-1** | Complete outage | API down, can't create experiments | <15 minutes |
| **SEV-2** | Major degradation | 50% error rate, very slow | <1 hour |
| **SEV-3** | Minor issue | Validation errors increased | <4 hours |
| **SEV-4** | Cosmetic | UI misalignment | <1 week |

### 6.2 Incident Process

**When Alert Fires**:

1. **Acknowledge** (2 minutes)
   - Acknowledge alert in PagerDuty
   - Post in #incidents Slack channel
   - Assign incident commander

2. **Assess** (5 minutes)
   - Determine severity
   - Check dashboards
   - Review recent changes
   - Estimate user impact

3. **Mitigate** (15-60 minutes)
   - Apply immediate fix or rollback
   - Communicate status updates
   - Verify fix resolves issue

4. **Resolve** (when confirmed stable)
   - Monitor for 15 minutes post-fix
   - Mark incident resolved
   - Schedule postmortem (SEV-1, SEV-2)

5. **Postmortem** (within 3 days)
   - Document timeline
   - Identify root cause
   - List action items to prevent recurrence
   - Share learnings with team

### 6.3 Communication Templates

**Initial Alert**:
```
🚨 INCIDENT: API High Error Rate (SEV-2)
Status: Investigating
Impact: Experiment creation failing for ~50% of users
Started: 2025-11-11 14:23 UTC
IC: @engineer-name
Updates: Every 15 minutes
```

**Update**:
```
📊 UPDATE: API High Error Rate
Status: Mitigating
Root Cause: Database connection pool exhausted
Fix: Increased pool size, restarting API servers
ETA: 14:45 UTC
Next Update: 14:40 UTC
```

**Resolution**:
```
✅ RESOLVED: API High Error Rate
Status: Resolved
Duration: 22 minutes
Fix: Database connection pool increased from 20 to 50
Impact: ~1,200 failed experiment creations (retried successfully)
Postmortem: https://link-to-doc
```

---

## 7. Performance Benchmarks

### 7.1 Latency Targets

| Operation | P50 | P95 | P99 |
|-----------|-----|-----|-----|
| Feature flag evaluation | <5ms | <10ms | <50ms |
| Get experiments list | <50ms | <100ms | <200ms |
| Create experiment | <100ms | <300ms | <1s |
| Validate experiment key | <1ms | <5ms | <10ms |
| Generate factorial combinations | <1ms | <5ms | <10ms |

### 7.2 Throughput Targets

- API requests: 1,000 req/sec sustained
- Experiment creations: 100/minute
- Flag evaluations: 10,000/sec
- Event ingestion: 50,000/sec

### 7.3 Availability Target

- **SLA**: 99.9% uptime (43 minutes downtime/month)
- **Error Budget**: 0.1% of requests can fail
- **Recovery Time Objective (RTO)**: <15 minutes
- **Recovery Point Objective (RPO)**: <5 minutes data loss

---

## 8. Monitoring Tools Setup

### 8.1 Prometheus Configuration

**Scrape Config** (`prometheus.yml`):
```yaml
scrape_configs:
  - job_name: 'experiment-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'

  - job_name: 'experiment-dashboard'
    scrape_interval: 30s
    static_configs:
      - targets: ['localhost:5173']
    metrics_path: '/metrics'
```

**Recording Rules**:
```yaml
groups:
  - name: experiment_api
    interval: 30s
    rules:
      - record: api:requests:rate5m
        expr: rate(api_requests_total[5m])

      - record: api:errors:rate5m
        expr: rate(api_errors_total[5m])

      - record: api:error_rate:ratio
        expr: api:errors:rate5m / api:requests:rate5m
```

### 8.2 Grafana Dashboards

**Import Community Dashboards**:
- Node Exporter Full: #1860
- PostgreSQL Database: #9628
- Redis: #11835
- Kafka Overview: #7589

**Custom Dashboard JSON**: See `grafana-dashboards/` directory

### 8.3 Application Instrumentation

**Add to Backend** (`src/monitoring/metrics.ts`):
```typescript
import prometheus from 'prom-client';

// Define metrics
export const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5]
});

export const experimentCreations = new prometheus.Counter({
  name: 'experiment_creations_total',
  help: 'Total number of experiments created',
  labelNames: ['design_type']
});

export const validationErrors = new prometheus.Counter({
  name: 'validation_errors_total',
  help: 'Total number of validation errors',
  labelNames: ['field', 'error_type']
});

// Middleware
export function metricsMiddleware(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.labels(req.method, req.route?.path || req.path, res.statusCode).observe(duration);
  });
  next();
}
```

**Expose Metrics Endpoint**:
```typescript
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(await prometheus.register.metrics());
});
```

---

## 9. Cost Monitoring

### 9.1 Infrastructure Costs

**Track Monthly**:
- Database: $/month (storage + compute)
- Cache: $/month
- Message queue: $/month
- Hosting: $/month
- Monitoring tools: $/month

**Alerts**:
- 🟠 **Warning**: Cost increased >20% month-over-month
- 🟡 **Info**: Cost projection exceeds budget

### 9.2 Cost Optimization

**Regular Reviews**:
- Unused experiments (archive after N days inactive)
- Database storage growth (compress old data)
- Cache memory usage (adjust based on hit rate)
- Log retention costs (adjust retention periods)

---

## 10. Security Monitoring

### 10.1 Security Events to Monitor

**Track**:
- Failed authentication attempts (>5 in 5 minutes)
- Unusual API access patterns (new IPs, unusual times)
- Privilege escalation attempts
- SQL injection attempts (caught by WAF)
- Rate limit violations
- Suspicious validation payloads

**Alerts**:
- 🔴 **Critical**: Active security breach detected
- 🟠 **Warning**: Unusual access pattern
- 🟡 **Info**: Multiple failed auth attempts (same user)

### 10.2 Audit Logging

**Log All**:
- User authentication/logout
- Experiment CRUD operations (who, what, when)
- Feature flag changes (who, what, when)
- Permission changes
- Configuration changes

**Retention**: 1 year (compliance requirement)

---

## 11. Regular Maintenance

### 11.1 Daily Checks

- [ ] Review error logs for new error types
- [ ] Check alert history (any fires?)
- [ ] Verify all services healthy
- [ ] Check disk space trending

### 11.2 Weekly Reviews

- [ ] Review performance trends
- [ ] Check cost trends
- [ ] Review validation error patterns
- [ ] Update documentation if needed

### 11.3 Monthly Reviews

- [ ] Review SLA compliance
- [ ] Analyze incident trends
- [ ] Review capacity planning
- [ ] Update alert thresholds if needed
- [ ] Archive inactive experiments

### 11.4 Quarterly Reviews

- [ ] Load testing
- [ ] Disaster recovery drill
- [ ] Security audit
- [ ] Cost optimization review
- [ ] Tool evaluation (are there better options?)

---

## 12. Contact Information

**On-Call Rotation**:
- View current on-call: https://pagerduty.com/schedules
- Escalation policy: https://pagerduty.com/escalation-policies

**Team Contacts**:
- Engineering Lead: eng-lead@company.com
- DevOps: devops@company.com
- DBA: dba@company.com
- Security: security@company.com

**Vendor Support**:
- Database: [Support link]
- Hosting: [Support link]
- Monitoring: [Support link]

---

## Appendix A: Metric Definitions

| Metric | Definition | Calculation |
|--------|-----------|-------------|
| Uptime % | Percentage of time service is available | (total_time - downtime) / total_time * 100 |
| Error Rate | Percentage of requests that fail | errors / total_requests * 100 |
| P95 Latency | 95th percentile response time | Sort all requests, take value at 95% |
| Throughput | Requests processed per second | total_requests / time_period |
| Cache Hit Rate | Percentage of cache requests that hit | cache_hits / (cache_hits + cache_misses) * 100 |

---

## Appendix B: Dashboard Screenshots

_(To be added after dashboards are created)_

---

## Appendix C: Alert History Template

| Date | Alert | Severity | Duration | Root Cause | Resolution |
|------|-------|----------|----------|------------|------------|
| 2025-11-11 | API High Latency | Warning | 15 min | Slow query | Added index |

---

**Document Version**: 1.0
**Last Reviewed**: 2025-11-11
**Next Review**: 2025-12-11
**Owner**: Engineering Team
