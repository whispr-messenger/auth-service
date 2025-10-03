#!/bin/bash

# Production deployment script for Auth Service
# Usage: ./deploy.sh [environment]

set -e

# Configuration
ENVIRONMENT=${1:-production}
DOCKER_COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        error ".env file not found. Please create it from .env.example"
    fi
    
    # Check if SSL certificates exist
    if [ ! -f "./ssl/cert.pem" ] || [ ! -f "./ssl/key.pem" ]; then
        warn "SSL certificates not found. HTTPS will not work properly."
    fi
    
    success "Prerequisites check completed"
}

# Create necessary directories
setup_directories() {
    log "Setting up directories..."
    
    mkdir -p logs
    mkdir -p backups
    mkdir -p ssl
    
    success "Directories created"
}

# Backup database
backup_database() {
    log "Creating database backup..."
    
    if docker-compose -f "$DOCKER_COMPOSE_FILE" ps postgres | grep -q "Up"; then
        BACKUP_FILE="$BACKUP_DIR/db_backup_$(date +%Y%m%d_%H%M%S).sql"
        docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres pg_dump -U auth_user auth_service > "$BACKUP_FILE"
        success "Database backup created: $BACKUP_FILE"
    else
        warn "Database container not running, skipping backup"
    fi
}

# Build and deploy
deploy() {
    log "Starting deployment..."
    
    # Pull latest images
    log "Pulling latest images..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" pull
    
    # Build application
    log "Building application..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" build --no-cache auth-service
    
    # Stop existing containers
    log "Stopping existing containers..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    
    # Start new containers
    log "Starting new containers..."
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 30
    
    # Check health
    check_health
    
    success "Deployment completed successfully"
}

# Health check
check_health() {
    log "Performing health checks..."
    
    # Check if containers are running
    if ! docker-compose -f "$DOCKER_COMPOSE_FILE" ps | grep -q "Up"; then
        error "Some containers are not running"
    fi
    
    # Check application health endpoint
    for i in {1..10}; do
        if curl -f http://localhost:3000/health &> /dev/null; then
            success "Application health check passed"
            return 0
        fi
        log "Health check attempt $i/10 failed, retrying in 5 seconds..."
        sleep 5
    done
    
    error "Application health check failed after 10 attempts"
}

# Rollback function
rollback() {
    log "Rolling back deployment..."
    
    # Stop current containers
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    
    # Restore from backup if available
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/db_backup_*.sql 2>/dev/null | head -n1)
    if [ -n "$LATEST_BACKUP" ]; then
        log "Restoring database from backup: $LATEST_BACKUP"
        docker-compose -f "$DOCKER_COMPOSE_FILE" up -d postgres
        sleep 10
        docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T postgres psql -U auth_user -d auth_service < "$LATEST_BACKUP"
    fi
    
    warn "Rollback completed. Please check the application manually."
}

# Cleanup old backups and images
cleanup() {
    log "Cleaning up old backups and images..."
    
    # Keep only last 5 backups
    ls -t "$BACKUP_DIR"/db_backup_*.sql 2>/dev/null | tail -n +6 | xargs -r rm
    
    # Remove unused Docker images
    docker image prune -f
    
    success "Cleanup completed"
}

# Main deployment process
main() {
    log "Starting deployment process for environment: $ENVIRONMENT"
    
    # Trap to handle rollback on failure
    trap 'error "Deployment failed. Run ./deploy.sh rollback to rollback."' ERR
    
    check_prerequisites
    setup_directories
    backup_database
    deploy
    cleanup
    
    success "Deployment process completed successfully!"
    log "Application is available at: https://localhost"
    log "Health check: https://localhost/health"
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback
        ;;
    "health")
        check_health
        ;;
    "backup")
        backup_database
        ;;
    "cleanup")
        cleanup
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|health|backup|cleanup}"
        echo "  deploy   - Deploy the application (default)"
        echo "  rollback - Rollback to previous version"
        echo "  health   - Check application health"
        echo "  backup   - Create database backup"
        echo "  cleanup  - Clean up old backups and images"
        exit 1
        ;;
esac