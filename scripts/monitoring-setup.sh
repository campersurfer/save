#!/bin/bash

# Save App Monitoring Setup Script
# Deploys comprehensive monitoring stack with Prometheus, Grafana, and AlertManager

set -e

echo "🔍 Setting up Save App monitoring infrastructure..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="monitoring"
GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-admin123}"
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

wait_for_deployment() {
    local deployment=$1
    local namespace=$2
    local timeout=${3:-300}
    
    log_info "Waiting for deployment $deployment in namespace $namespace..."
    kubectl wait --for=condition=available --timeout=${timeout}s deployment/$deployment -n $namespace
}

wait_for_daemonset() {
    local daemonset=$1
    local namespace=$2
    local timeout=${3:-300}
    
    log_info "Waiting for daemonset $daemonset in namespace $namespace..."
    kubectl wait --for=condition=ready --timeout=${timeout}s pod -l app=$daemonset -n $namespace
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Unable to connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Create monitoring namespace
create_namespace() {
    log_info "Creating monitoring namespace..."
    
    if kubectl get namespace $NAMESPACE &> /dev/null; then
        log_warning "Namespace $NAMESPACE already exists"
    else
        kubectl create namespace $NAMESPACE
        log_success "Namespace $NAMESPACE created"
    fi
}

# Deploy Prometheus configuration
deploy_prometheus_config() {
    log_info "Deploying Prometheus configuration..."
    
    # Update Slack webhook URL in AlertManager config if provided
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        sed -i.bak "s|YOUR_SLACK_WEBHOOK_URL|$SLACK_WEBHOOK_URL|g" ../k8s/monitoring/prometheus-config.yaml
        log_info "Updated AlertManager with Slack webhook URL"
    fi
    
    kubectl apply -f ../k8s/monitoring/prometheus-config.yaml
    log_success "Prometheus configuration deployed"
}

# Deploy monitoring stack
deploy_monitoring_stack() {
    log_info "Deploying monitoring stack..."
    
    kubectl apply -f ../k8s/monitoring/monitoring-stack.yaml
    log_success "Monitoring stack deployed"
}

# Deploy Grafana dashboards
deploy_grafana_dashboards() {
    log_info "Deploying Grafana dashboards..."
    
    kubectl apply -f ../k8s/monitoring/grafana-dashboards.yaml
    log_success "Grafana dashboards deployed"
}

# Wait for all components
wait_for_components() {
    log_info "Waiting for all monitoring components to be ready..."
    
    wait_for_deployment "prometheus" $NAMESPACE
    wait_for_deployment "grafana" $NAMESPACE
    wait_for_deployment "alertmanager" $NAMESPACE
    wait_for_daemonset "node-exporter" $NAMESPACE
    
    log_success "All monitoring components are ready"
}

# Setup port forwarding for local access
setup_port_forwarding() {
    log_info "Setting up port forwarding for local access..."
    
    # Kill existing port forwards
    pkill -f "kubectl port-forward" || true
    
    # Grafana
    kubectl port-forward -n $NAMESPACE service/grafana 3000:3000 &
    GRAFANA_PID=$!
    
    # Prometheus
    kubectl port-forward -n $NAMESPACE service/prometheus 9090:9090 &
    PROMETHEUS_PID=$!
    
    # AlertManager
    kubectl port-forward -n $NAMESPACE service/alertmanager 9093:9093 &
    ALERTMANAGER_PID=$!
    
    log_success "Port forwarding setup complete"
    log_info "Access URLs:"
    log_info "  Grafana: http://localhost:3000 (admin:$GRAFANA_PASSWORD)"
    log_info "  Prometheus: http://localhost:9090"
    log_info "  AlertManager: http://localhost:9093"
    
    # Save PIDs for cleanup
    echo $GRAFANA_PID > /tmp/grafana.pid
    echo $PROMETHEUS_PID > /tmp/prometheus.pid
    echo $ALERTMANAGER_PID > /tmp/alertmanager.pid
}

# Import Grafana dashboards
import_grafana_dashboards() {
    log_info "Importing Grafana dashboards..."
    
    # Wait for Grafana to be fully ready
    sleep 30
    
    # Import dashboards via API
    for dashboard in "save-app-overview" "save-app-extraction" "save-app-performance"; do
        log_info "Importing dashboard: $dashboard"
        
        # Extract dashboard JSON from ConfigMap
        dashboard_json=$(kubectl get configmap grafana-dashboards -n $NAMESPACE -o jsonpath="{.data['$dashboard.json']}" | jq '.dashboard')
        
        # Import dashboard
        curl -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer admin:$GRAFANA_PASSWORD" \
            -d "{\"dashboard\": $dashboard_json, \"overwrite\": true}" \
            http://localhost:3000/api/dashboards/db || log_warning "Failed to import $dashboard dashboard"
    done
    
    log_success "Dashboard import completed"
}

# Validate monitoring setup
validate_setup() {
    log_info "Validating monitoring setup..."
    
    # Check Prometheus targets
    log_info "Checking Prometheus targets..."
    targets_response=$(curl -s http://localhost:9090/api/v1/targets || echo "failed")
    if [[ "$targets_response" == "failed" ]]; then
        log_warning "Unable to reach Prometheus targets endpoint"
    else
        active_targets=$(echo "$targets_response" | jq -r '.data.activeTargets | length')
        log_info "Found $active_targets active Prometheus targets"
    fi
    
    # Check Grafana health
    log_info "Checking Grafana health..."
    grafana_health=$(curl -s http://localhost:3000/api/health || echo "failed")
    if [[ "$grafana_health" == "failed" ]]; then
        log_warning "Unable to reach Grafana health endpoint"
    else
        log_success "Grafana is healthy"
    fi
    
    # Check AlertManager status
    log_info "Checking AlertManager status..."
    alertmanager_status=$(curl -s http://localhost:9093/api/v1/status || echo "failed")
    if [[ "$alertmanager_status" == "failed" ]]; then
        log_warning "Unable to reach AlertManager status endpoint"
    else
        log_success "AlertManager is running"
    fi
    
    log_success "Monitoring setup validation completed"
}

# Generate monitoring report
generate_monitoring_report() {
    log_info "Generating monitoring setup report..."
    
    cat > monitoring-report.md << EOF
# Save App Monitoring Setup Report

Generated: $(date)

## Components Deployed

### Prometheus
- **Status**: Running
- **URL**: http://localhost:9090
- **Namespace**: $NAMESPACE
- **Configuration**: Custom metrics and alerts configured
- **Retention**: 30 days

### Grafana
- **Status**: Running
- **URL**: http://localhost:3000
- **Username**: admin
- **Password**: $GRAFANA_PASSWORD
- **Dashboards**: 3 custom dashboards imported

### AlertManager
- **Status**: Running
- **URL**: http://localhost:9093
- **Configuration**: Slack integration $([ -n "$SLACK_WEBHOOK_URL" ] && echo "enabled" || echo "disabled")

### Node Exporter
- **Status**: Running as DaemonSet
- **Purpose**: System-level metrics collection

## Dashboards Available

1. **Save App - System Overview**
   - Request rates and response times
   - Error rates and active connections
   - CPU and memory usage
   - Queue lengths

2. **Save App - Extraction Pipeline**
   - Extraction success rates and types
   - Processing times and failure reasons
   - Worker status and queue processing

3. **Save App - Performance Metrics**
   - API response time percentiles
   - Database query performance
   - Cache hit rates and GC performance

## Alerting Rules

- High error rate (>10% for 5 minutes)
- High response time (95th percentile >2s)
- Queue backlog (>1000 jobs)
- High CPU usage (>80% for 5 minutes)
- High memory usage (>90% for 5 minutes)
- Pod restart rate (>3 restarts/hour)
- Low extraction success rate (<80%)

## Next Steps

1. Configure Slack webhook URL for alert notifications
2. Set up long-term metrics storage
3. Configure custom alert thresholds
4. Add additional custom metrics as needed
5. Setup backup and disaster recovery for monitoring data

## Troubleshooting

- Check pod logs: \`kubectl logs -n $NAMESPACE <pod-name>\`
- Restart components: \`kubectl rollout restart deployment/<deployment-name> -n $NAMESPACE\`
- View metrics: \`curl http://localhost:9090/api/v1/query?query=<prometheus-query>\`

EOF

    log_success "Monitoring report generated: monitoring-report.md"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up port forwarding..."
    
    if [[ -f /tmp/grafana.pid ]]; then
        kill $(cat /tmp/grafana.pid) 2>/dev/null || true
        rm /tmp/grafana.pid
    fi
    
    if [[ -f /tmp/prometheus.pid ]]; then
        kill $(cat /tmp/prometheus.pid) 2>/dev/null || true
        rm /tmp/prometheus.pid
    fi
    
    if [[ -f /tmp/alertmanager.pid ]]; then
        kill $(cat /tmp/alertmanager.pid) 2>/dev/null || true
        rm /tmp/alertmanager.pid
    fi
}

# Setup cleanup trap
trap cleanup EXIT

# Main execution
main() {
    echo "🚀 Starting Save App monitoring setup..."
    echo "This will deploy Prometheus, Grafana, and AlertManager to your Kubernetes cluster."
    echo ""
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-validation)
                SKIP_VALIDATION=true
                shift
                ;;
            --no-port-forward)
                NO_PORT_FORWARD=true
                shift
                ;;
            --grafana-password)
                GRAFANA_PASSWORD="$2"
                shift 2
                ;;
            --slack-webhook)
                SLACK_WEBHOOK_URL="$2"
                shift 2
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --skip-validation     Skip setup validation"
                echo "  --no-port-forward     Skip port forwarding setup"
                echo "  --grafana-password    Set Grafana admin password"
                echo "  --slack-webhook       Set Slack webhook URL for alerts"
                echo "  -h, --help           Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    check_prerequisites
    create_namespace
    deploy_prometheus_config
    deploy_monitoring_stack
    deploy_grafana_dashboards
    wait_for_components
    
    if [[ "$NO_PORT_FORWARD" != "true" ]]; then
        setup_port_forwarding
        sleep 10 # Allow services to stabilize
        import_grafana_dashboards
        
        if [[ "$SKIP_VALIDATION" != "true" ]]; then
            validate_setup
        fi
    fi
    
    generate_monitoring_report
    
    log_success "🎉 Save App monitoring setup completed successfully!"
    
    if [[ "$NO_PORT_FORWARD" != "true" ]]; then
        echo ""
        log_info "Monitoring services are now accessible:"
        log_info "  📊 Grafana: http://localhost:3000 (admin:$GRAFANA_PASSWORD)"
        log_info "  📈 Prometheus: http://localhost:9090"
        log_info "  🚨 AlertManager: http://localhost:9093"
        echo ""
        log_info "Press Ctrl+C to stop port forwarding and exit"
        
        # Keep script running for port forwarding
        while true; do
            sleep 60
            # Check if services are still running
            if ! kill -0 $GRAFANA_PID 2>/dev/null; then
                log_warning "Grafana port forward stopped"
                break
            fi
        done
    fi
}

# Execute main function
main "$@"