# Production Deployment Guide

Complete guide for deploying Ralph Orchestrator TypeScript in production environments with enterprise-grade reliability, security, and scalability.

## Pre-Production Checklist

### Infrastructure Requirements

- [ ] **Compute Resources**
  - Minimum: 2 vCPUs, 4GB RAM per instance
  - Recommended: 4 vCPUs, 8GB RAM per instance
  - Auto-scaling configured (2-10 instances)

- [ ] **Storage**
  - 100GB SSD for application and logs
  - Separate persistent volumes for data
  - Backup storage configured

- [ ] **Network**
  - Load balancer configured
  - SSL/TLS certificates installed
  - Firewall rules configured
  - DDoS protection enabled

- [ ] **High Availability**
  - Multi-AZ deployment
  - Database replication
  - Redis cluster for caching
  - Message queue redundancy

### Security Requirements

- [ ] **Access Control**
  - RBAC configured
  - Service accounts created
  - API keys rotated
  - MFA enforced for admin access

- [ ] **Secrets Management**
  - HashiCorp Vault or AWS Secrets Manager configured
  - All secrets encrypted at rest
  - Secrets rotation policy implemented

- [ ] **Compliance**
  - Data encryption in transit and at rest
  - Audit logging enabled
  - GDPR/CCPA compliance verified
  - Security scanning completed

## Production Architecture

```mermaid
graph TB
    subgraph "Internet"
        U[Users]
        API[API Clients]
    end

    subgraph "Edge Layer"
        CDN[CloudFlare CDN]
        WAF[Web Application Firewall]
    end

    subgraph "Load Balancing"
        ALB[Application Load Balancer]
        NLB[Network Load Balancer]
    end

    subgraph "Application Layer"
        R1[Ralph Instance 1]
        R2[Ralph Instance 2]
        R3[Ralph Instance N]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL Primary)]
        PGR[(PostgreSQL Replica)]
        REDIS[(Redis Cluster)]
        S3[S3 Object Storage]
    end

    subgraph "Monitoring"
        PROM[Prometheus]
        GRAF[Grafana]
        ELK[ELK Stack]
    end

    U --> CDN
    API --> WAF
    CDN --> ALB
    WAF --> NLB
    ALB --> R1
    ALB --> R2
    ALB --> R3
    NLB --> R1
    R1 --> PG
    R2 --> PGR
    R3 --> REDIS
    R1 --> S3
    R1 --> PROM
    PROM --> GRAF
    R1 --> ELK
```

## Deployment Steps

### 1. Infrastructure Setup

#### AWS Production Setup

```bash
# Create VPC and subnets
aws ec2 create-vpc --cidr-block 10.0.0.0/16

# Create EKS cluster
eksctl create cluster \
  --name ralph-production \
  --version 1.28 \
  --region us-west-2 \
  --nodegroup-name workers \
  --node-type m5.xlarge \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 10 \
  --managed

# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier ralph-prod-db \
  --db-instance-class db.t3.large \
  --engine postgres \
  --engine-version 15.4 \
  --master-username ralph \
  --master-user-password $DB_PASSWORD \
  --allocated-storage 100 \
  --backup-retention-period 30 \
  --multi-az

# Create ElastiCache Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id ralph-prod-cache \
  --engine redis \
  --cache-node-type cache.r6g.large \
  --num-cache-nodes 3 \
  --cache-subnet-group-name ralph-cache-subnet
```

#### GCP Production Setup

```bash
# Create GKE cluster
gcloud container clusters create ralph-production \
  --zone us-central1-a \
  --machine-type n2-standard-4 \
  --num-nodes 3 \
  --enable-autoscaling \
  --min-nodes 2 \
  --max-nodes 10 \
  --enable-autorepair \
  --enable-autoupgrade

# Create Cloud SQL instance
gcloud sql instances create ralph-prod-db \
  --database-version=POSTGRES_15 \
  --cpu=4 \
  --memory=16GB \
  --region=us-central1 \
  --availability-type=REGIONAL \
  --backup \
  --backup-start-time=03:00

# Create Memorystore Redis
gcloud redis instances create ralph-prod-cache \
  --size=5 \
  --region=us-central1 \
  --redis-version=redis_6_x \
  --tier=STANDARD_HA
```

### 2. Application Configuration

#### Production Environment Variables

```bash
# .env.production
# API Configuration
RALPH_AGENT=auto
RALPH_MAX_ITERATIONS=1000
RALPH_MAX_RUNTIME=28800  # 8 hours
RALPH_MAX_TOKENS=5000000
RALPH_MAX_COST=500.0

# Database
DATABASE_URL=postgresql://user:pass@db.example.com:5432/ralph_prod
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=40

# Redis Cache
REDIS_URL=redis://redis.example.com:6379/0
REDIS_POOL_SIZE=50
REDIS_TTL=3600

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=8080
LOG_LEVEL=INFO
SENTRY_DSN=https://xxx@sentry.io/xxx

# Security
SECRET_KEY=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)
API_RATE_LIMIT=100/minute
ALLOWED_HOSTS=ralph.example.com
CORS_ORIGINS=https://app.example.com

# AI Service Keys (from secrets manager)
CLAUDE_API_KEY_SECRET=arn:aws:secretsmanager:region:account:secret:claude-key
GEMINI_API_KEY_SECRET=arn:aws:secretsmanager:region:account:secret:gemini-key
```

#### Production Settings

```typescript
// config/production.ts
import type { Config } from '../types';

export const productionConfig: Config = {
  // Application
  debug: false,
  testing: false,
  env: 'production',

  // Security
  sessionCookieSecure: true,
  sessionCookieHttpOnly: true,
  sessionCookieSameSite: 'Strict',
  sessionLifetime: 3600,

  // Database
  database: {
    url: process.env.DATABASE_URL!,
    poolSize: 20,
    maxOverflow: 40,
    connectionTimeout: 10000,
    idleTimeout: 3600000,
  },

  // Caching
  cache: {
    type: 'redis',
    url: process.env.REDIS_URL!,
    defaultTimeout: 3600,
  },

  // Rate Limiting
  rateLimit: {
    strategy: 'fixed-window',
    default: '100/hour',
    storage: process.env.REDIS_URL!,
  },

  // Monitoring
  monitoring: {
    prometheusEnabled: true,
    metricsPort: 8080,
  },

  // Logging
  logging: {
    level: 'info',
    format: 'json',
    outputs: ['console', 'file'],
    filePath: '/var/log/ralph/app.log',
    maxSize: 104857600, // 100MB
    maxFiles: 10,
  },
};
```

### 3. Deployment Configuration

#### Kubernetes Production Manifests

```yaml
# k8s/production/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ralph-orchestrator
  namespace: production
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: ralph-orchestrator
  template:
    metadata:
      labels:
        app: ralph-orchestrator
        version: v1.0.0
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values:
                - ralph-orchestrator
            topologyKey: kubernetes.io/hostname
      containers:
      - name: ralph
        image: ghcr.io/acazau/ralph-orchestrator-ts:v1.0.0
        ports:
        - containerPort: 8080
          name: metrics
        envFrom:
        - secretRef:
            name: ralph-secrets
        - configMapRef:
            name: ralph-config
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
        - name: secrets
          mountPath: /app/secrets
          readOnly: true
      volumes:
      - name: config
        configMap:
          name: ralph-config
      - name: secrets
        secret:
          secretName: ralph-secrets
          defaultMode: 0400
```

### 4. Load Balancing and SSL

#### Ingress Configuration

```yaml
# k8s/production/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ralph-ingress
  namespace: production
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
spec:
  tls:
  - hosts:
    - ralph.example.com
    secretName: ralph-tls
  rules:
  - host: ralph.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: ralph-service
            port:
              number: 80
```

### 5. Database Setup

#### Production Database Initialization

```sql
-- Create production database
CREATE DATABASE ralph_production;
CREATE USER ralph_app WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE ralph_production TO ralph_app;

-- Enable extensions
\c ralph_production
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS ralph;
CREATE SCHEMA IF NOT EXISTS audit;

-- Set search path
ALTER USER ralph_app SET search_path TO ralph, public;

-- Create tables
CREATE TABLE ralph.orchestrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id VARCHAR(255) UNIQUE NOT NULL,
    agent_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    metrics JSONB
);

-- Create indexes
CREATE INDEX idx_orchestrations_status ON ralph.orchestrations(status);
CREATE INDEX idx_orchestrations_created ON ralph.orchestrations(created_at);
CREATE INDEX idx_orchestrations_agent ON ralph.orchestrations(agent_type);

-- Audit table
CREATE TABLE audit.activity_log (
    id BIGSERIAL PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_id VARCHAR(255),
    action VARCHAR(100),
    resource VARCHAR(255),
    details JSONB,
    ip_address INET
);
```

### 6. Monitoring Setup

#### Prometheus Configuration

```yaml
# monitoring/prometheus.yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

alerting:
  alertmanagers:
  - static_configs:
    - targets:
      - alertmanager:9093

rule_files:
  - "alerts.yml"

scrape_configs:
  - job_name: 'ralph-orchestrator'
    kubernetes_sd_configs:
    - role: pod
      namespaces:
        names:
        - production
    relabel_configs:
    - source_labels: [__meta_kubernetes_pod_label_app]
      action: keep
      regex: ralph-orchestrator
    - source_labels: [__meta_kubernetes_pod_name]
      target_label: instance
```

#### Alert Rules

```yaml
# monitoring/alerts.yml
groups:
- name: ralph_alerts
  interval: 30s
  rules:
  - alert: HighErrorRate
    expr: rate(ralph_errors_total[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: High error rate detected
      description: "Error rate is {{ $value }} errors/sec"

  - alert: HighMemoryUsage
    expr: container_memory_usage_bytes{pod=~"ralph-.*"} / container_spec_memory_limit_bytes > 0.9
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: High memory usage
      description: "Memory usage is above 90%"

  - alert: LongRunningTask
    expr: ralph_task_duration_seconds > 14400
    for: 1m
    labels:
      severity: warning
    annotations:
      summary: Task running longer than 4 hours
      description: "Task {{ $labels.task_id }} has been running for {{ $value }} seconds"
```

### 7. Backup and Recovery

#### Automated Backup Script

```bash
#!/bin/bash
# backup.sh

# Configuration
BACKUP_DIR="/backups"
S3_BUCKET="s3://ralph-backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Database backup
pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Application data backup
tar -czf $BACKUP_DIR/data_$DATE.tar.gz /app/data

# Upload to S3
aws s3 cp $BACKUP_DIR/db_$DATE.sql.gz $S3_BUCKET/db/
aws s3 cp $BACKUP_DIR/data_$DATE.tar.gz $S3_BUCKET/data/

# Clean old backups
find $BACKUP_DIR -name "*.gz" -mtime +$RETENTION_DAYS -delete
aws s3 ls $S3_BUCKET/db/ | while read -r line; do
  createDate=$(echo $line | awk '{print $1" "$2}')
  createDate=$(date -d "$createDate" +%s)
  olderThan=$(date -d "$RETENTION_DAYS days ago" +%s)
  if [[ $createDate -lt $olderThan ]]; then
    fileName=$(echo $line | awk '{print $4}')
    aws s3 rm $S3_BUCKET/db/$fileName
  fi
done
```

### 8. Security Hardening

#### Security Policies

```yaml
# k8s/production/security.yaml
apiVersion: policy/v1beta1
kind: PodSecurityPolicy
metadata:
  name: ralph-psp
spec:
  privileged: false
  allowPrivilegeEscalation: false
  requiredDropCapabilities:
    - ALL
  volumes:
    - 'configMap'
    - 'emptyDir'
    - 'projected'
    - 'secret'
    - 'persistentVolumeClaim'
  hostNetwork: false
  hostIPC: false
  hostPID: false
  runAsUser:
    rule: 'MustRunAsNonRoot'
  seLinux:
    rule: 'RunAsAny'
  supplementalGroups:
    rule: 'RunAsAny'
  fsGroup:
    rule: 'RunAsAny'
  readOnlyRootFilesystem: true
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ralph-network-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: ralph-orchestrator
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 5432  # PostgreSQL
    - protocol: TCP
      port: 6379  # Redis
```

## Performance Optimization

### Caching Strategy

```typescript
// cache_config.ts
import { createClient } from 'redis';

interface CacheManager {
  cacheResult(key: string, value: unknown, ttl?: number): Promise<void>;
  getCached<T>(key: string): Promise<T | null>;
}

export class RedisCacheManager implements CacheManager {
  private client: ReturnType<typeof createClient>;
  private memoryCache: Map<string, { value: unknown; expires: number }> = new Map();

  constructor(redisUrl: string) {
    this.client = createClient({ url: redisUrl });
  }

  async cacheResult(key: string, value: unknown, ttl = 3600): Promise<void> {
    // Cache in memory for fast access
    this.memoryCache.set(key, {
      value,
      expires: Date.now() + ttl * 1000,
    });

    // Cache in Redis for persistence
    await this.client.setEx(key, ttl, JSON.stringify(value));
  }

  async getCached<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memCached = this.memoryCache.get(key);
    if (memCached && memCached.expires > Date.now()) {
      return memCached.value as T;
    }

    // Fall back to Redis
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }
}
```

### Database Optimization

```sql
-- Optimize queries
CREATE INDEX CONCURRENTLY idx_orchestrations_composite
ON ralph.orchestrations(agent_type, status, created_at);

-- Partition large tables
CREATE TABLE ralph.orchestrations_2024 PARTITION OF ralph.orchestrations
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Vacuum and analyze
VACUUM ANALYZE ralph.orchestrations;
```

## Disaster Recovery

### Recovery Plan

1. **RTO (Recovery Time Objective)**: 4 hours
2. **RPO (Recovery Point Objective)**: 1 hour

### Failover Procedure

```bash
#!/bin/bash
# failover.sh

# Check primary health
if ! curl -f https://ralph.example.com/health; then
  echo "Primary unhealthy, initiating failover"

  # Update DNS to point to standby
  aws route53 change-resource-record-sets \
    --hosted-zone-id Z123456 \
    --change-batch file://failover-dns.json

  # Promote standby database
  aws rds promote-read-replica \
    --db-instance-identifier ralph-standby-db

  # Scale up standby region
  kubectl scale deployment ralph-orchestrator \
    --replicas=5 \
    --context=standby-cluster

  # Notify team
  aws sns publish \
    --topic-arn arn:aws:sns:region:account:alerts \
    --message "Failover initiated to standby region"
fi
```

## Maintenance

### Rolling Updates

```bash
# Zero-downtime deployment
kubectl set image deployment/ralph-orchestrator \
  ralph=ghcr.io/acazau/ralph-orchestrator-ts:v1.0.1 \
  --record

# Monitor rollout
kubectl rollout status deployment/ralph-orchestrator

# Rollback if needed
kubectl rollout undo deployment/ralph-orchestrator
```

### Health Checks

```typescript
// health.ts
import { Hono } from 'hono';
import os from 'os';

const app = new Hono();

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  checks: Record<string, boolean>;
  system?: {
    cpuUsage: number;
    memoryUsage: number;
    uptime: number;
  };
}

app.get('/health', async (c) => {
  const checks = {
    database: await checkDatabase(),
    redis: await checkRedis(),
    disk: checkDiskSpace(),
    memory: checkMemory(),
  };

  const status = Object.values(checks).every(Boolean) ? 'healthy' : 'unhealthy';

  const result: HealthCheckResult = {
    status,
    checks,
    system: {
      cpuUsage: os.loadavg()[0],
      memoryUsage: 1 - os.freemem() / os.totalmem(),
      uptime: os.uptime(),
    },
  };

  return c.json(result, status === 'healthy' ? 200 : 503);
});

async function checkDatabase(): Promise<boolean> {
  try {
    // Database health check implementation
    return true;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    // Redis health check implementation
    return true;
  } catch {
    return false;
  }
}

function checkDiskSpace(): boolean {
  // Check disk usage is below 90%
  return true;
}

function checkMemory(): boolean {
  const usage = 1 - os.freemem() / os.totalmem();
  return usage < 0.9;
}

export default app;
```

## Production Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Security scan completed
- [ ] Performance testing done
- [ ] Documentation updated
- [ ] Runbook created
- [ ] Rollback plan ready

### Deployment
- [ ] Database migrations run
- [ ] Secrets configured
- [ ] Monitoring enabled
- [ ] Alerts configured
- [ ] Health checks passing
- [ ] Load balancer configured

### Post-Deployment
- [ ] Smoke tests passed
- [ ] Performance metrics normal
- [ ] Error rates acceptable
- [ ] User acceptance testing
- [ ] Documentation published
- [ ] Team notified

## Support and Maintenance

### SLA Targets
- **Uptime**: 99.9% (43.8 minutes downtime/month)
- **Response Time**: < 500ms p95
- **Error Rate**: < 0.1%
- **Recovery Time**: < 4 hours

### On-Call Procedures
1. Alert received via PagerDuty
2. Check runbook for known issues
3. Assess severity and impact
4. Implement fix or workaround
5. Document incident
6. Post-mortem if needed

## Next Steps

- [Monitoring Guide](../advanced/monitoring.md) - Set up comprehensive monitoring
- [Security Best Practices](../advanced/security.md) - Security hardening
- [Troubleshooting Guide](../troubleshooting.md) - Common issues and solutions
