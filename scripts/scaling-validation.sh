#!/bin/bash

# Scaling Validation Script
# Validates KEDA auto-scaling and load balancer configuration

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Configuration
NAMESPACE="${NAMESPACE:-save-app}"
LOAD_TEST_DURATION="${LOAD_TEST_DURATION:-300}"
CONCURRENCY="${CONCURRENCY:-50}"

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed"
        exit 1
    fi
    
    # Check kubectl connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Check if KEDA is installed
check_keda_installation() {
    log_info "Checking KEDA installation..."
    
    if ! kubectl get deployment keda-operator -n keda &> /dev/null; then
        log_warn "KEDA not found. Installing KEDA..."
        kubectl apply -f k8s/keda/keda-install.yaml
        
        # Wait for KEDA to be ready
        kubectl wait --for=condition=available --timeout=300s deployment/keda-operator -n keda
        kubectl wait --for=condition=available --timeout=300s deployment/keda-metrics-apiserver -n keda
    fi
    
    log_success "KEDA is installed and ready"
}

# Check ScaledObjects
check_scaled_objects() {
    log_info "Checking KEDA ScaledObjects..."
    
    local scaled_objects
    scaled_objects=$(kubectl get scaledobjects -n "$NAMESPACE" --no-headers 2>/dev/null | wc -l)
    
    if [ "$scaled_objects" -eq 0 ]; then
        log_warn "No ScaledObjects found. Applying configurations..."
        kubectl apply -f k8s/keda/worker-scaledobject.yaml
    fi
    
    log_info "ScaledObjects status:"
    kubectl get scaledobjects -n "$NAMESPACE" -o custom-columns="NAME:.metadata.name,READY:.status.conditions[0].status,ACTIVE:.status.conditions[1].status,MIN:.spec.minReplicaCount,MAX:.spec.maxReplicaCount"
    
    log_success "ScaledObjects are configured"
}

# Check HPA status
check_hpa_status() {
    log_info "Checking HPA status..."
    
    if kubectl get hpa -n "$NAMESPACE" &> /dev/null; then
        kubectl get hpa -n "$NAMESPACE"
        
        # Check HPA metrics
        log_info "HPA detailed status:"
        kubectl describe hpa -n "$NAMESPACE"
    else
        log_warn "No HPA found in namespace $NAMESPACE"
    fi
}

# Get baseline metrics
get_baseline_metrics() {
    log_info "Getting baseline metrics..."
    
    local pods_before
    pods_before=$(kubectl get pods -n "$NAMESPACE" -l app=save-app --no-headers | wc -l)
    echo "$pods_before" > /tmp/pods_before.txt
    
    local cpu_before
    cpu_before=$(kubectl top pods -n "$NAMESPACE" -l app=save-app --no-headers 2>/dev/null | awk '{sum+=$2} END {print sum}' || echo "0")
    echo "$cpu_before" > /tmp/cpu_before.txt
    
    log_info "Baseline: $pods_before pods, ${cpu_before}m CPU"
}

# Run load test
run_load_test() {
    log_info "Running load test for ${LOAD_TEST_DURATION} seconds with concurrency $CONCURRENCY..."
    
    # Get service URL
    local service_url
    if kubectl get service nginx-loadbalancer -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' &> /dev/null; then
        local lb_ip
        lb_ip=$(kubectl get service nginx-loadbalancer -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
        service_url="http://$lb_ip"
    else
        # Port forward if no external IP
        log_warn "No external LoadBalancer IP found. Using port-forward..."
        kubectl port-forward service/nginx-loadbalancer 8080:80 -n "$NAMESPACE" &
        local port_forward_pid=$!
        sleep 5
        service_url="http://localhost:8080"
    fi
    
    log_info "Testing endpoint: $service_url"
    
    # Run the load test
    LOAD_TEST_URL="$service_url" \
    CONCURRENCY="$CONCURRENCY" \
    DURATION="$LOAD_TEST_DURATION" \
    node scripts/load-test.js &
    
    local load_test_pid=$!
    
    # Monitor scaling during load test
    monitor_scaling_during_test &
    local monitor_pid=$!
    
    # Wait for load test to complete
    wait $load_test_pid
    kill $monitor_pid 2>/dev/null || true
    
    # Clean up port forward if used
    if [ -n "${port_forward_pid:-}" ]; then
        kill $port_forward_pid 2>/dev/null || true
    fi
    
    log_success "Load test completed"
}

# Monitor scaling during test
monitor_scaling_during_test() {
    log_info "Monitoring scaling behavior..."
    
    local monitor_file="/tmp/scaling_monitor.txt"
    echo "Timestamp,Pods,CPU,Memory,QueueLength" > "$monitor_file"
    
    while true; do
        local timestamp
        timestamp=$(date '+%Y-%m-%d %H:%M:%S')
        
        local pods
        pods=$(kubectl get pods -n "$NAMESPACE" -l app=save-app --no-headers 2>/dev/null | wc -l || echo "0")
        
        local cpu
        cpu=$(kubectl top pods -n "$NAMESPACE" -l app=save-app --no-headers 2>/dev/null | awk '{sum+=$2} END {print sum}' || echo "0")
        
        local memory
        memory=$(kubectl top pods -n "$NAMESPACE" -l app=save-app --no-headers 2>/dev/null | awk '{sum+=$3} END {print sum}' || echo "0")
        
        # Try to get queue length from Redis (simplified)
        local queue_length="N/A"
        
        echo "$timestamp,$pods,$cpu,$memory,$queue_length" >> "$monitor_file"
        
        log_info "Current: $pods pods, ${cpu}m CPU, ${memory}Mi memory"
        
        sleep 30
    done
}

# Analyze scaling behavior
analyze_scaling_behavior() {
    log_info "Analyzing scaling behavior..."
    
    local pods_after
    pods_after=$(kubectl get pods -n "$NAMESPACE" -l app=save-app --no-headers | wc -l)
    
    local pods_before
    pods_before=$(cat /tmp/pods_before.txt)
    
    local cpu_after
    cpu_after=$(kubectl top pods -n "$NAMESPACE" -l app=save-app --no-headers 2>/dev/null | awk '{sum+=$2} END {print sum}' || echo "0")
    
    local cpu_before
    cpu_before=$(cat /tmp/cpu_before.txt)
    
    echo
    log_info "Scaling Analysis:"
    echo "=================="
    echo "Pods before load: $pods_before"
    echo "Pods after load:  $pods_after"
    echo "Pod increase:     $((pods_after - pods_before))"
    echo "CPU before load:  ${cpu_before}m"
    echo "CPU after load:   ${cpu_after}m"
    echo "CPU increase:     $((cpu_after - cpu_before))m"
    
    if [ "$pods_after" -gt "$pods_before" ]; then
        log_success "✅ Auto-scaling triggered successfully"
    else
        log_warn "⚠️  No pod scaling detected"
    fi
    
    # Check if scaling was appropriate
    if [ "$pods_after" -gt $((pods_before * 3)) ]; then
        log_warn "⚠️  Scaling might be too aggressive"
    fi
    
    if [ -f "/tmp/scaling_monitor.txt" ]; then
        log_info "Detailed scaling timeline saved to /tmp/scaling_monitor.txt"
        echo "Sample scaling data:"
        tail -5 /tmp/scaling_monitor.txt
    fi
}

# Test load balancer health
test_load_balancer() {
    log_info "Testing load balancer health..."
    
    # Get service endpoints
    local service_url
    if kubectl get service nginx-loadbalancer -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}' &> /dev/null; then
        local lb_ip
        lb_ip=$(kubectl get service nginx-loadbalancer -n "$NAMESPACE" -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
        service_url="http://$lb_ip"
    else
        kubectl port-forward service/nginx-loadbalancer 8081:80 -n "$NAMESPACE" &
        local port_forward_pid=$!
        sleep 5
        service_url="http://localhost:8081"
    fi
    
    # Test health endpoint
    if curl -f "$service_url/health" -m 10 &> /dev/null; then
        log_success "✅ Load balancer health check passed"
    else
        log_error "❌ Load balancer health check failed"
    fi
    
    # Test rate limiting
    log_info "Testing rate limiting..."
    local rate_limit_failed=0
    for i in {1..100}; do
        if ! curl -f "$service_url/api/health" -m 5 &> /dev/null; then
            rate_limit_failed=$((rate_limit_failed + 1))
        fi
        sleep 0.1
    done
    
    if [ "$rate_limit_failed" -gt 10 ]; then
        log_success "✅ Rate limiting is working (${rate_limit_failed}/100 requests blocked)"
    else
        log_warn "⚠️  Rate limiting might not be effective"
    fi
    
    # Clean up port forward if used
    if [ -n "${port_forward_pid:-}" ]; then
        kill $port_forward_pid 2>/dev/null || true
    fi
}

# Generate scaling report
generate_report() {
    log_info "Generating scaling validation report..."
    
    local report_file="scaling-validation-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$report_file" << EOF
# Scaling Validation Report

**Date:** $(date)
**Namespace:** $NAMESPACE
**Load Test Duration:** ${LOAD_TEST_DURATION}s
**Concurrency:** $CONCURRENCY

## KEDA Configuration

\`\`\`
$(kubectl get scaledobjects -n "$NAMESPACE" -o yaml)
\`\`\`

## HPA Status

\`\`\`
$(kubectl get hpa -n "$NAMESPACE" 2>/dev/null || echo "No HPA found")
\`\`\`

## Pod Metrics

\`\`\`
$(kubectl top pods -n "$NAMESPACE" -l app=save-app 2>/dev/null || echo "Metrics not available")
\`\`\`

## Scaling Timeline

EOF
    
    if [ -f "/tmp/scaling_monitor.txt" ]; then
        echo "\`\`\`" >> "$report_file"
        cat /tmp/scaling_monitor.txt >> "$report_file"
        echo "\`\`\`" >> "$report_file"
    fi
    
    log_success "Report saved to $report_file"
}

# Cleanup
cleanup() {
    log_info "Cleaning up temporary files..."
    rm -f /tmp/pods_before.txt /tmp/cpu_before.txt /tmp/scaling_monitor.txt
}

# Main execution
main() {
    echo "🔄 Starting Scaling Validation"
    echo "==============================="
    
    check_prerequisites
    check_keda_installation
    check_scaled_objects
    check_hpa_status
    get_baseline_metrics
    test_load_balancer
    run_load_test
    analyze_scaling_behavior
    generate_report
    cleanup
    
    log_success "🎉 Scaling validation completed!"
}

# Handle script arguments
case "${1:-validate}" in
    "validate")
        main
        ;;
    "monitor")
        monitor_scaling_during_test
        ;;
    "report")
        generate_report
        ;;
    "cleanup")
        cleanup
        ;;
    *)
        echo "Usage: $0 [validate|monitor|report|cleanup]"
        exit 1
        ;;
esac