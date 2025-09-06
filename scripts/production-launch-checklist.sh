#!/bin/bash

# Save App Production Launch Checklist
# Comprehensive validation script for production readiness

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="${NAMESPACE:-save-app}"
DOMAIN="${DOMAIN:-save-app.com}"
ENVIRONMENT="${ENVIRONMENT:-production}"
MIN_REPLICAS="${MIN_REPLICAS:-3}"
MAX_CPU_USAGE="${MAX_CPU_USAGE:-80}"
MAX_MEMORY_USAGE="${MAX_MEMORY_USAGE:-85}"
MIN_SUCCESS_RATE="${MIN_SUCCESS_RATE:-99}"

# Counters
TOTAL_CHECKS=0
PASSED_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Functions
log_header() {
    echo -e "\n${PURPLE}========================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}========================================${NC}"
}

log_section() {
    echo -e "\n${CYAN}--- $1 ---${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓ PASS]${NC} $1"
    ((PASSED_CHECKS++))
}

log_warning() {
    echo -e "${YELLOW}[⚠ WARN]${NC} $1"
    ((WARNING_CHECKS++))
}

log_error() {
    echo -e "${RED}[✗ FAIL]${NC} $1"
    ((FAILED_CHECKS++))
}

log_check() {
    ((TOTAL_CHECKS++))
    echo -e "${BLUE}[CHECK]${NC} $1"
}

# Kubernetes cluster checks
check_cluster_health() {
    log_section "Kubernetes Cluster Health"
    
    log_check "Checking cluster connectivity"
    if kubectl cluster-info &> /dev/null; then
        log_success "Cluster is accessible"
    else
        log_error "Unable to connect to Kubernetes cluster"
        return 1
    fi
    
    log_check "Checking node readiness"
    not_ready_nodes=$(kubectl get nodes --no-headers | grep -v Ready | wc -l)
    total_nodes=$(kubectl get nodes --no-headers | wc -l)
    
    if [[ $not_ready_nodes -eq 0 ]]; then
        log_success "All $total_nodes nodes are ready"
    else
        log_error "$not_ready_nodes out of $total_nodes nodes are not ready"
    fi
    
    log_check "Checking cluster resources"
    # Check if cluster has sufficient resources
    total_cpu=$(kubectl top nodes --no-headers | awk '{sum+=$2} END {print int(sum)}')
    total_memory=$(kubectl top nodes --no-headers | awk '{sum+=$4} END {print int(sum)}')
    
    if [[ $total_cpu -lt $MAX_CPU_USAGE ]]; then
        log_success "Cluster CPU usage is acceptable ($total_cpu%)"
    else
        log_warning "Cluster CPU usage is high ($total_cpu%)"
    fi
    
    if [[ $total_memory -lt $MAX_MEMORY_USAGE ]]; then
        log_success "Cluster memory usage is acceptable ($total_memory%)"
    else
        log_warning "Cluster memory usage is high ($total_memory%)"
    fi
}

# Application deployment checks
check_application_deployment() {
    log_section "Application Deployment"
    
    log_check "Checking namespace existence"
    if kubectl get namespace $NAMESPACE &> /dev/null; then
        log_success "Namespace $NAMESPACE exists"
    else
        log_error "Namespace $NAMESPACE does not exist"
        return 1
    fi
    
    # Check deployments
    deployments=("save-backend" "worker" "nginx")
    for deployment in "${deployments[@]}"; do
        log_check "Checking deployment: $deployment"
        
        if kubectl get deployment $deployment -n $NAMESPACE &> /dev/null; then
            ready_replicas=$(kubectl get deployment $deployment -n $NAMESPACE -o jsonpath='{.status.readyReplicas}')
            desired_replicas=$(kubectl get deployment $deployment -n $NAMESPACE -o jsonpath='{.spec.replicas}')
            
            if [[ "$ready_replicas" == "$desired_replicas" ]] && [[ $ready_replicas -ge $MIN_REPLICAS ]]; then
                log_success "$deployment: $ready_replicas/$desired_replicas replicas ready (minimum $MIN_REPLICAS met)"
            elif [[ "$ready_replicas" == "$desired_replicas" ]]; then
                log_warning "$deployment: $ready_replicas/$desired_replicas replicas ready (below minimum $MIN_REPLICAS)"
            else
                log_error "$deployment: only $ready_replicas/$desired_replicas replicas ready"
            fi
        else
            log_error "Deployment $deployment not found"
        fi
    done
    
    # Check services
    services=("save-backend" "redis" "nginx")
    for service in "${services[@]}"; do
        log_check "Checking service: $service"
        
        if kubectl get service $service -n $NAMESPACE &> /dev/null; then
            endpoints=$(kubectl get endpoints $service -n $NAMESPACE -o jsonpath='{.subsets[0].addresses[*].ip}' | wc -w)
            if [[ $endpoints -gt 0 ]]; then
                log_success "$service: $endpoints endpoints available"
            else
                log_error "$service: no endpoints available"
            fi
        else
            log_error "Service $service not found"
        fi
    done
}

# Security checks
check_security() {
    log_section "Security Configuration"
    
    log_check "Checking SSL/TLS certificate"
    if command -v openssl &> /dev/null; then
        cert_info=$(echo | timeout 5 openssl s_client -connect $DOMAIN:443 -servername $DOMAIN 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)
        
        if [[ -n "$cert_info" ]]; then
            expiry_date=$(echo "$cert_info" | grep "notAfter" | cut -d= -f2)
            expiry_timestamp=$(date -d "$expiry_date" +%s 2>/dev/null || date -j -f "%b %d %T %Y %Z" "$expiry_date" +%s 2>/dev/null)
            current_timestamp=$(date +%s)
            days_until_expiry=$(( (expiry_timestamp - current_timestamp) / 86400 ))
            
            if [[ $days_until_expiry -gt 30 ]]; then
                log_success "SSL certificate valid for $days_until_expiry days"
            elif [[ $days_until_expiry -gt 7 ]]; then
                log_warning "SSL certificate expires in $days_until_expiry days"
            else
                log_error "SSL certificate expires in $days_until_expiry days - renewal required"
            fi
        else
            log_error "Unable to verify SSL certificate for $DOMAIN"
        fi
    else
        log_warning "OpenSSL not available - skipping SSL certificate check"
    fi
    
    log_check "Checking security headers"
    if command -v curl &> /dev/null; then
        headers=$(curl -I -s --max-time 10 https://$DOMAIN 2>/dev/null || echo "failed")
        
        if [[ "$headers" != "failed" ]]; then
            security_headers=("X-Frame-Options" "X-Content-Type-Options" "X-XSS-Protection" "Strict-Transport-Security")
            for header in "${security_headers[@]}"; do
                if echo "$headers" | grep -i "$header" &> /dev/null; then
                    log_success "$header header present"
                else
                    log_warning "$header header missing"
                fi
            done
        else
            log_error "Unable to check security headers for $DOMAIN"
        fi
    else
        log_warning "curl not available - skipping security headers check"
    fi
    
    log_check "Checking RBAC configuration"
    if kubectl auth can-i "*" "*" --as=system:anonymous &> /dev/null; then
        log_error "Anonymous user has excessive permissions"
    else
        log_success "RBAC properly restricts anonymous access"
    fi
    
    log_check "Checking pod security policies"
    privileged_pods=$(kubectl get pods -n $NAMESPACE -o jsonpath='{range .items[*]}{.metadata.name}{" "}{.spec.securityContext.privileged}{"\n"}{end}' | grep -c "true" || echo "0")
    
    if [[ $privileged_pods -eq 0 ]]; then
        log_success "No privileged pods found"
    else
        log_warning "$privileged_pods privileged pods found"
    fi
}

# Performance checks
check_performance() {
    log_section "Performance Validation"
    
    log_check "Running health check"
    if command -v curl &> /dev/null; then
        health_response=$(curl -s --max-time 10 https://$DOMAIN/api/health 2>/dev/null || echo "failed")
        
        if [[ "$health_response" != "failed" ]]; then
            health_status=$(echo "$health_response" | jq -r '.status' 2>/dev/null || echo "unknown")
            if [[ "$health_status" == "healthy" ]]; then
                log_success "Application health check passed"
            else
                log_error "Application health check failed: $health_status"
            fi
        else
            log_error "Unable to reach health endpoint"
        fi
    else
        log_warning "curl not available - skipping health check"
    fi
    
    log_check "Checking response times"
    if command -v curl &> /dev/null; then
        response_time=$(curl -w "%{time_total}" -s -o /dev/null --max-time 30 https://$DOMAIN 2>/dev/null || echo "999")
        response_time_ms=$(echo "$response_time * 1000" | bc -l 2>/dev/null | cut -d. -f1)
        
        if [[ $response_time_ms -lt 2000 ]]; then
            log_success "Response time acceptable (${response_time_ms}ms)"
        elif [[ $response_time_ms -lt 5000 ]]; then
            log_warning "Response time high (${response_time_ms}ms)"
        else
            log_error "Response time too high (${response_time_ms}ms)"
        fi
    fi
    
    log_check "Checking resource usage"
    # Check pod resource usage
    high_cpu_pods=$(kubectl top pods -n $NAMESPACE --no-headers 2>/dev/null | awk -v max=$MAX_CPU_USAGE '$2 > max {count++} END {print count+0}')
    high_memory_pods=$(kubectl top pods -n $NAMESPACE --no-headers 2>/dev/null | awk -v max=$MAX_MEMORY_USAGE '$3 > max {count++} END {print count+0}')
    
    if [[ $high_cpu_pods -eq 0 ]]; then
        log_success "All pods have acceptable CPU usage"
    else
        log_warning "$high_cpu_pods pods have high CPU usage (>$MAX_CPU_USAGE%)"
    fi
    
    if [[ $high_memory_pods -eq 0 ]]; then
        log_success "All pods have acceptable memory usage"
    else
        log_warning "$high_memory_pods pods have high memory usage (>$MAX_MEMORY_USAGE%)"
    fi
}

# Monitoring checks
check_monitoring() {
    log_section "Monitoring & Observability"
    
    log_check "Checking Prometheus deployment"
    if kubectl get deployment prometheus -n monitoring &> /dev/null; then
        prometheus_ready=$(kubectl get deployment prometheus -n monitoring -o jsonpath='{.status.readyReplicas}')
        if [[ "$prometheus_ready" -gt 0 ]]; then
            log_success "Prometheus is running ($prometheus_ready replicas)"
        else
            log_error "Prometheus deployment not ready"
        fi
    else
        log_error "Prometheus not deployed"
    fi
    
    log_check "Checking Grafana deployment"
    if kubectl get deployment grafana -n monitoring &> /dev/null; then
        grafana_ready=$(kubectl get deployment grafana -n monitoring -o jsonpath='{.status.readyReplicas}')
        if [[ "$grafana_ready" -gt 0 ]]; then
            log_success "Grafana is running ($grafana_ready replicas)"
        else
            log_error "Grafana deployment not ready"
        fi
    else
        log_error "Grafana not deployed"
    fi
    
    log_check "Checking AlertManager deployment"
    if kubectl get deployment alertmanager -n monitoring &> /dev/null; then
        alertmanager_ready=$(kubectl get deployment alertmanager -n monitoring -o jsonpath='{.status.readyReplicas}')
        if [[ "$alertmanager_ready" -gt 0 ]]; then
            log_success "AlertManager is running ($alertmanager_ready replicas)"
        else
            log_error "AlertManager deployment not ready"
        fi
    else
        log_error "AlertManager not deployed"
    fi
    
    log_check "Checking metrics endpoint"
    # Port forward to check metrics
    kubectl port-forward -n $NAMESPACE service/save-backend 8080:3001 &
    PF_PID=$!
    sleep 2
    
    metrics_response=$(curl -s --max-time 5 http://localhost:8080/metrics 2>/dev/null || echo "failed")
    kill $PF_PID 2>/dev/null || true
    
    if [[ "$metrics_response" != "failed" ]] && echo "$metrics_response" | grep -q "http_requests_total"; then
        log_success "Metrics endpoint is working"
    else
        log_error "Metrics endpoint not responding properly"
    fi
}

# Backup and disaster recovery checks
check_backup_dr() {
    log_section "Backup & Disaster Recovery"
    
    log_check "Checking database backup configuration"
    # Check for backup CronJobs
    backup_jobs=$(kubectl get cronjobs -n $NAMESPACE --no-headers 2>/dev/null | grep -c backup || echo "0")
    
    if [[ $backup_jobs -gt 0 ]]; then
        log_success "$backup_jobs backup jobs configured"
    else
        log_warning "No backup jobs found"
    fi
    
    log_check "Checking persistent volume backups"
    # Check for volume snapshot classes
    snapshot_classes=$(kubectl get volumesnapshotclasses --no-headers 2>/dev/null | wc -l)
    
    if [[ $snapshot_classes -gt 0 ]]; then
        log_success "Volume snapshot classes available"
    else
        log_warning "No volume snapshot classes found"
    fi
    
    log_check "Checking disaster recovery procedures"
    if [[ -f "../docs/disaster-recovery.md" ]]; then
        log_success "Disaster recovery documentation exists"
    else
        log_warning "Disaster recovery documentation not found"
    fi
}

# Compliance checks
check_compliance() {
    log_section "Compliance & Documentation"
    
    log_check "Checking environment configuration"
    if kubectl get configmap app-config -n $NAMESPACE &> /dev/null; then
        env_var=$(kubectl get configmap app-config -n $NAMESPACE -o jsonpath='{.data.NODE_ENV}')
        if [[ "$env_var" == "production" ]]; then
            log_success "Environment correctly set to production"
        else
            log_warning "Environment not set to production: $env_var"
        fi
    else
        log_warning "Application configuration not found"
    fi
    
    log_check "Checking secrets management"
    secrets_count=$(kubectl get secrets -n $NAMESPACE --no-headers | wc -l)
    
    if [[ $secrets_count -gt 0 ]]; then
        log_success "$secrets_count secrets configured"
        
        # Check for common secrets
        required_secrets=("db-credentials" "api-keys" "ssl-certs")
        for secret in "${required_secrets[@]}"; do
            if kubectl get secret $secret -n $NAMESPACE &> /dev/null; then
                log_success "Required secret '$secret' exists"
            else
                log_warning "Required secret '$secret' not found"
            fi
        done
    else
        log_error "No secrets found"
    fi
    
    log_check "Checking documentation completeness"
    required_docs=("README.md" "DEPLOYMENT.md" "API.md")
    for doc in "${required_docs[@]}"; do
        if [[ -f "../$doc" ]]; then
            log_success "Documentation file '$doc' exists"
        else
            log_warning "Documentation file '$doc' missing"
        fi
    done
}

# Load testing validation
run_load_testing() {
    log_section "Load Testing Validation"
    
    log_check "Running basic load test"
    if command -v npm &> /dev/null && [[ -f "../tests/performance/k6-load-test.js" ]]; then
        log_info "Running 60-second load test..."
        
        # Run abbreviated load test
        k6_output=$(k6 run --duration 60s --vus 10 ../tests/performance/k6-load-test.js 2>/dev/null || echo "failed")
        
        if [[ "$k6_output" != "failed" ]]; then
            # Parse k6 results
            error_rate=$(echo "$k6_output" | grep "http_req_failed" | awk '{print $3}' | sed 's/%//' || echo "0")
            avg_response_time=$(echo "$k6_output" | grep "http_req_duration.*avg" | awk '{print $3}' | sed 's/ms//' || echo "0")
            
            if (( $(echo "$error_rate < 1" | bc -l) )); then
                log_success "Load test passed - error rate: ${error_rate}%"
            else
                log_error "Load test failed - error rate too high: ${error_rate}%"
            fi
            
            if (( $(echo "$avg_response_time < 1000" | bc -l) )); then
                log_success "Load test passed - avg response time: ${avg_response_time}ms"
            else
                log_warning "Load test - high response time: ${avg_response_time}ms"
            fi
        else
            log_error "Load test execution failed"
        fi
    else
        log_warning "Load testing tools not available - skipping"
    fi
}

# Generate final report
generate_final_report() {
    log_header "PRODUCTION READINESS REPORT"
    
    # Calculate success rate
    success_rate=$(( (PASSED_CHECKS * 100) / TOTAL_CHECKS ))
    
    echo -e "📊 ${BLUE}Summary Statistics:${NC}"
    echo -e "   Total Checks: $TOTAL_CHECKS"
    echo -e "   Passed: ${GREEN}$PASSED_CHECKS${NC}"
    echo -e "   Warnings: ${YELLOW}$WARNING_CHECKS${NC}"
    echo -e "   Failed: ${RED}$FAILED_CHECKS${NC}"
    echo -e "   Success Rate: $success_rate%"
    echo ""
    
    # Determine overall status
    if [[ $FAILED_CHECKS -eq 0 ]] && [[ $success_rate -ge $MIN_SUCCESS_RATE ]]; then
        echo -e "🎉 ${GREEN}PRODUCTION READY${NC}"
        echo -e "   The application meets all requirements for production deployment."
        OVERALL_STATUS="READY"
    elif [[ $FAILED_CHECKS -lt 3 ]] && [[ $WARNING_CHECKS -lt 10 ]]; then
        echo -e "⚠️  ${YELLOW}PRODUCTION READY WITH WARNINGS${NC}"
        echo -e "   The application can be deployed but should address warnings."
        OVERALL_STATUS="READY_WITH_WARNINGS"
    else
        echo -e "❌ ${RED}NOT PRODUCTION READY${NC}"
        echo -e "   Critical issues must be resolved before production deployment."
        OVERALL_STATUS="NOT_READY"
    fi
    
    echo ""
    echo -e "📋 ${BLUE}Next Steps:${NC}"
    
    if [[ $FAILED_CHECKS -gt 0 ]]; then
        echo -e "   1. ${RED}Address all failed checks immediately${NC}"
    fi
    
    if [[ $WARNING_CHECKS -gt 0 ]]; then
        echo -e "   2. ${YELLOW}Review and resolve warnings${NC}"
    fi
    
    echo -e "   3. ${BLUE}Schedule production deployment${NC}"
    echo -e "   4. ${BLUE}Setup production monitoring alerts${NC}"
    echo -e "   5. ${BLUE}Prepare rollback procedures${NC}"
    echo ""
    
    # Write detailed report to file
    cat > production-readiness-report.json << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "$ENVIRONMENT",
  "domain": "$DOMAIN",
  "namespace": "$NAMESPACE",
  "overall_status": "$OVERALL_STATUS",
  "summary": {
    "total_checks": $TOTAL_CHECKS,
    "passed_checks": $PASSED_CHECKS,
    "warning_checks": $WARNING_CHECKS,
    "failed_checks": $FAILED_CHECKS,
    "success_rate": $success_rate
  },
  "ready_for_production": $(if [[ "$OVERALL_STATUS" == "READY" ]]; then echo "true"; else echo "false"; fi),
  "recommendations": [
    $(if [[ $FAILED_CHECKS -gt 0 ]]; then echo "\"Address critical failures\""; fi)
    $(if [[ $WARNING_CHECKS -gt 0 ]]; then echo "$(if [[ $FAILED_CHECKS -gt 0 ]]; then echo ","; fi)\"Resolve warnings\""; fi)
    $(echo ",\"Monitor production metrics\"")
  ]
}
EOF
    
    log_info "Detailed report saved to: production-readiness-report.json"
}

# Main execution
main() {
    log_header "SAVE APP PRODUCTION LAUNCH CHECKLIST"
    echo -e "🚀 ${BLUE}Validating production readiness for Save App${NC}"
    echo -e "📍 Environment: $ENVIRONMENT"
    echo -e "🌐 Domain: $DOMAIN"
    echo -e "📦 Namespace: $NAMESPACE"
    echo ""
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --skip-load-test)
                SKIP_LOAD_TEST=true
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --domain DOMAIN       Set domain for checks (default: save-app.com)"
                echo "  --namespace NS        Set Kubernetes namespace (default: save-app)"
                echo "  --environment ENV     Set environment (default: production)"
                echo "  --skip-load-test      Skip load testing validation"
                echo "  -h, --help           Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run all checks
    check_cluster_health
    check_application_deployment
    check_security
    check_performance
    check_monitoring
    check_backup_dr
    check_compliance
    
    if [[ "$SKIP_LOAD_TEST" != "true" ]]; then
        run_load_testing
    fi
    
    generate_final_report
    
    # Exit with appropriate code
    if [[ "$OVERALL_STATUS" == "READY" ]]; then
        exit 0
    elif [[ "$OVERALL_STATUS" == "READY_WITH_WARNINGS" ]]; then
        exit 1
    else
        exit 2
    fi
}

# Execute main function
main "$@"