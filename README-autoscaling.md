# Auto-scaling & Load Balancing Setup

This document describes the auto-scaling and load balancing infrastructure implemented for the Save App.

## 🏗️ Architecture Overview

### KEDA Auto-scaling
- **Worker Scaling**: Based on Redis queue length, CPU/memory usage, and Prometheus metrics
- **Backend Scaling**: Based on HTTP request rate and response time
- **Batch Processing**: Scheduled scaling with cron triggers

### Load Balancing
- **nginx Load Balancer**: High-performance reverse proxy with health checks
- **SSL/TLS Termination**: Let's Encrypt certificates with automatic renewal
- **CDN Integration**: Cloudflare edge caching and optimization

## 📊 Scaling Triggers

### Worker Pods (`save-workers`)
```yaml
triggers:
  - Redis queue length > 5 items
  - CPU utilization > 70%
  - Memory utilization > 80%
  - Custom metrics from Prometheus
```

**Scaling Configuration:**
- Min replicas: 2
- Max replicas: 20
- Polling interval: 15 seconds
- Cooldown period: 60 seconds

### Backend Pods (`save-app`)
```yaml
triggers:
  - HTTP requests/sec > 100
  - 95th percentile response time > 500ms
```

**Scaling Configuration:**
- Min replicas: 3
- Max replicas: 15
- Polling interval: 10 seconds
- Cooldown period: 30 seconds

### Batch Jobs (`save-batch-processor`)
```yaml
triggers:
  - Cron schedule: 2-6 AM UTC daily
  - Pending batch jobs > 10
```

## 🔧 Configuration Files

### KEDA Installation
- `k8s/keda/keda-install.yaml` - KEDA operator and metrics API server
- `k8s/keda/worker-scaledobject.yaml` - ScaledObject configurations

### Load Balancer
- `k8s/loadbalancer/nginx-configmap.yaml` - Advanced nginx configuration
- `k8s/loadbalancer/nginx-deployment.yaml` - Load balancer deployment with HPA

### SSL/TLS & CDN
- `k8s/loadbalancer/cert-manager.yaml` - Certificate management
- `k8s/loadbalancer/cdn-config.yaml` - CDN and edge caching setup

## 🚀 Deployment Instructions

### 1. Install KEDA
```bash
kubectl apply -f k8s/keda/keda-install.yaml

# Wait for KEDA to be ready
kubectl wait --for=condition=available --timeout=300s deployment/keda-operator -n keda
kubectl wait --for=condition=available --timeout=300s deployment/keda-metrics-apiserver -n keda
```

### 2. Deploy ScaledObjects
```bash
kubectl apply -f k8s/keda/worker-scaledobject.yaml
```

### 3. Deploy Load Balancer
```bash
kubectl apply -f k8s/loadbalancer/nginx-configmap.yaml
kubectl apply -f k8s/loadbalancer/nginx-deployment.yaml
```

### 4. Setup SSL/TLS
```bash
# Install cert-manager first (if not already installed)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.1/cert-manager.yaml

# Apply certificate configuration
kubectl apply -f k8s/loadbalancer/cert-manager.yaml
```

### 5. Configure CDN
```bash
kubectl apply -f k8s/loadbalancer/cdn-config.yaml
```

## 📈 Testing & Validation

### Run Load Test
```bash
# Basic load test
node scripts/load-test.js

# Custom configuration
LOAD_TEST_URL=http://your-domain.com \
CONCURRENCY=100 \
DURATION=600 \
SCENARIOS=api,extraction \
node scripts/load-test.js
```

### Validate Scaling
```bash
# Run comprehensive scaling validation
./scripts/scaling-validation.sh validate

# Monitor scaling behavior
./scripts/scaling-validation.sh monitor
```

### Check KEDA Status
```bash
# List all scaled objects
kubectl get scaledobjects -n save-app

# Check scaling status
kubectl describe scaledobject save-worker-scaler -n save-app

# View KEDA metrics
kubectl logs -n keda deployment/keda-operator
```

## 🔍 Monitoring

### Key Metrics to Monitor
- **Request Rate**: HTTP requests per second
- **Response Time**: p95 latency under 500ms
- **Error Rate**: <1% error rate under load
- **Queue Depth**: Redis queue length
- **Pod Count**: Auto-scaling responsiveness
- **Resource Usage**: CPU/memory utilization

### Prometheus Queries
```promql
# Request rate
sum(rate(http_requests_total[5m]))

# Response time
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

# Queue depth
redis_list_length{list="bull:extraction:waiting"}

# Pod count
kube_deployment_status_replicas{deployment="save-app"}
```

### Grafana Dashboard
Key panels to include:
- Request rate and response time
- Pod count and auto-scaling events  
- Resource utilization (CPU/memory)
- Queue depths and processing rates
- Error rates and health status

## 🎯 Performance Targets

### Load Test Results (Target)
- **Throughput**: >1000 requests/second
- **Latency**: 95th percentile <500ms
- **Error Rate**: <1%
- **Scaling Time**: <2 minutes to scale out

### Resource Efficiency
- **CPU**: <70% average utilization
- **Memory**: <80% average utilization
- **Network**: >80% CDN cache hit rate
- **Storage**: <10GB log retention

## 🔧 Troubleshooting

### Common Issues

#### KEDA Not Scaling
```bash
# Check KEDA operator logs
kubectl logs -n keda deployment/keda-operator

# Check metrics server
kubectl top nodes
kubectl top pods -n save-app

# Verify ScaledObject configuration
kubectl describe scaledobject save-worker-scaler -n save-app
```

#### Load Balancer Issues
```bash
# Check nginx logs
kubectl logs -n save-app deployment/nginx-loadbalancer

# Test health endpoint
kubectl port-forward -n save-app service/nginx-internal 8080:8080
curl http://localhost:8080/health

# Check service endpoints
kubectl get endpoints -n save-app
```

#### SSL Certificate Issues
```bash
# Check certificate status
kubectl get certificates -n save-app

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager

# Manual certificate troubleshooting
kubectl describe certificate save-tls-cert -n save-app
```

### Performance Debugging
```bash
# Load test with detailed metrics
CONCURRENCY=10 DURATION=60 node scripts/load-test.js

# Monitor real-time metrics
watch kubectl get hpa -n save-app
watch kubectl get scaledobjects -n save-app

# Check resource usage
kubectl top pods -n save-app --sort-by=memory
kubectl top nodes --sort-by=cpu
```

## 📚 Additional Resources

- [KEDA Documentation](https://keda.sh/docs/)
- [nginx Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [cert-manager Documentation](https://cert-manager.io/docs/)
- [Prometheus Monitoring](https://prometheus.io/docs/)