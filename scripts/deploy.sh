#!/bin/bash

# Save App Deployment Script
# Usage: ./scripts/deploy.sh [environment] [version]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
ENVIRONMENT="${1:-development}"
VERSION="${2:-latest}"
NAMESPACE="save-app"
REGISTRY="${REGISTRY:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is installed and configured
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check if kustomize is installed
    if ! command -v kustomize &> /dev/null; then
        log_error "kustomize is not installed or not in PATH"
        log_info "Install with: curl -s 'https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh' | bash"
        exit 1
    fi
    
    # Check kubectl connection
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Build Docker image
build_image() {
    log_info "Building Docker image for $ENVIRONMENT..."
    
    IMAGE_TAG="save-app:${VERSION}"
    
    if [[ "$ENVIRONMENT" == "development" ]]; then
        DOCKERFILE="Dockerfile.dev"
    else
        DOCKERFILE="Dockerfile"
    fi
    
    cd "$PROJECT_ROOT"
    
    # Build the image
    docker build -f "$DOCKERFILE" -t "$IMAGE_TAG" .
    
    # Tag for registry if specified
    if [[ -n "$REGISTRY" ]]; then
        REGISTRY_IMAGE="$REGISTRY/$IMAGE_TAG"
        docker tag "$IMAGE_TAG" "$REGISTRY_IMAGE"
        
        log_info "Pushing image to registry..."
        docker push "$REGISTRY_IMAGE"
        
        log_success "Image pushed to registry: $REGISTRY_IMAGE"
    fi
    
    log_success "Docker image built: $IMAGE_TAG"
}

# Deploy to Kubernetes
deploy_k8s() {
    log_info "Deploying to Kubernetes ($ENVIRONMENT)..."
    
    OVERLAY_PATH="$PROJECT_ROOT/k8s/overlays/$ENVIRONMENT"
    
    if [[ ! -d "$OVERLAY_PATH" ]]; then
        log_error "Environment overlay not found: $OVERLAY_PATH"
        exit 1
    fi
    
    # Create namespace if it doesn't exist
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_info "Creating namespace: $NAMESPACE"
        kubectl create namespace "$NAMESPACE"
    fi
    
    # Apply the manifests
    log_info "Applying Kubernetes manifests..."
    cd "$OVERLAY_PATH"
    
    # Set the image tag in kustomization
    kustomize edit set image "save-app=save-app:${VERSION}"
    
    # Apply the configuration
    kustomize build . | kubectl apply -f -
    
    log_success "Kubernetes manifests applied"
    
    # Wait for rollout to complete
    log_info "Waiting for deployment rollout..."
    kubectl rollout status deployment/save-app -n "$NAMESPACE" --timeout=300s
    
    # Check if all pods are ready
    log_info "Checking pod status..."
    kubectl wait --for=condition=ready pod -l app=save-app -n "$NAMESPACE" --timeout=300s
    
    log_success "Deployment completed successfully"
}

# Deploy with Docker Compose (for development)
deploy_compose() {
    log_info "Deploying with Docker Compose..."
    
    cd "$PROJECT_ROOT"
    
    if [[ "$ENVIRONMENT" == "development" ]]; then
        COMPOSE_FILE="docker-compose.dev.yml"
    else
        COMPOSE_FILE="docker-compose.yml"
    fi
    
    # Stop existing containers
    docker-compose -f "$COMPOSE_FILE" down
    
    # Build and start services
    docker-compose -f "$COMPOSE_FILE" up --build -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    if curl -f http://localhost:3001/health &> /dev/null; then
        log_success "Save App is running at http://localhost:3001"
    else
        log_error "Save App health check failed"
        docker-compose -f "$COMPOSE_FILE" logs save-app
        exit 1
    fi
    
    log_success "Docker Compose deployment completed"
}

# Get deployment status
get_status() {
    log_info "Getting deployment status..."
    
    if command -v kubectl &> /dev/null && kubectl cluster-info &> /dev/null; then
        echo
        log_info "Kubernetes Status:"
        kubectl get pods -n "$NAMESPACE" -o wide
        echo
        kubectl get services -n "$NAMESPACE"
        echo
        kubectl get ingress -n "$NAMESPACE"
    fi
    
    if docker ps | grep -q save; then
        echo
        log_info "Docker Compose Status:"
        docker ps --filter name=save --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    fi
}

# Run health checks
health_check() {
    log_info "Running health checks..."
    
    # Check if running in Kubernetes
    if kubectl get deployment save-app -n "$NAMESPACE" &> /dev/null; then
        # Port forward to test the app
        log_info "Port forwarding to test health endpoint..."
        kubectl port-forward service/save-app 8080:3001 -n "$NAMESPACE" &
        PID=$!
        
        sleep 5
        
        if curl -f http://localhost:8080/health &> /dev/null; then
            log_success "Health check passed"
        else
            log_error "Health check failed"
        fi
        
        kill $PID 2>/dev/null || true
    elif curl -f http://localhost:3001/health &> /dev/null; then
        log_success "Health check passed (Docker Compose)"
    else
        log_error "Health check failed"
    fi
}

# Show usage information
show_usage() {
    echo "Usage: $0 [COMMAND] [ENVIRONMENT] [VERSION]"
    echo
    echo "Commands:"
    echo "  deploy     Deploy the application (default)"
    echo "  status     Show deployment status"
    echo "  health     Run health checks"
    echo "  build      Build Docker image only"
    echo "  logs       Show application logs"
    echo
    echo "Environments:"
    echo "  development  Deploy with Docker Compose (default)"
    echo "  production   Deploy to Kubernetes"
    echo
    echo "Examples:"
    echo "  $0 deploy development latest"
    echo "  $0 deploy production v1.0.0"
    echo "  $0 status"
    echo "  $0 health"
}

# Show logs
show_logs() {
    if kubectl get deployment save-app -n "$NAMESPACE" &> /dev/null; then
        kubectl logs -f deployment/save-app -n "$NAMESPACE"
    elif docker ps | grep -q save-app; then
        docker-compose logs -f save-app
    else
        log_error "No running deployment found"
    fi
}

# Main execution
main() {
    COMMAND="${1:-deploy}"
    
    case "$COMMAND" in
        "deploy")
            check_prerequisites
            build_image
            
            if [[ "$ENVIRONMENT" == "development" ]]; then
                deploy_compose
            else
                deploy_k8s
            fi
            ;;
        "status")
            get_status
            ;;
        "health")
            health_check
            ;;
        "build")
            check_prerequisites
            build_image
            ;;
        "logs")
            show_logs
            ;;
        "help"|"-h"|"--help")
            show_usage
            ;;
        *)
            log_error "Unknown command: $COMMAND"
            show_usage
            exit 1
            ;;
    esac
}

# Handle script arguments
if [[ $# -gt 0 ]]; then
    main "$@"
else
    main "deploy" "$ENVIRONMENT" "$VERSION"
fi