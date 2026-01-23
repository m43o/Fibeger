#!/bin/bash
# Script to verify all Fibeger services are running correctly after a reboot
# Run this script after server restart to check system health

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

DEPLOY_DIR="/opt/fibeger"
ERRORS=0
WARNINGS=0

print_header() {
    echo ""
    echo -e "${BLUE}=========================================="
    echo "$1"
    echo -e "==========================================${NC}"
    echo ""
}

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

check_warn() {
    echo -e "${YELLOW}!${NC} $1"
    ((WARNINGS++))
}

# Function to wait for service with timeout
wait_for_service() {
    local service=$1
    local max_wait=${2:-30}
    local waited=0
    
    while [ $waited -lt $max_wait ]; do
        if systemctl is-active $service &> /dev/null || systemctl --user is-active $service &> /dev/null; then
            return 0
        fi
        sleep 2
        ((waited+=2))
    done
    return 1
}

print_header "System Information"
echo "Hostname: $(hostname)"
echo "Uptime: $(uptime -p)"
echo "Date: $(date)"
echo "User: $USER"

print_header "1. Checking Tailscale"
if systemctl is-active tailscaled &> /dev/null; then
    check_pass "Tailscaled service is running"
    
    if sudo tailscale status &> /dev/null; then
        TAILSCALE_IP=$(tailscale ip -4 2>/dev/null || echo "unknown")
        check_pass "Tailscale is connected (IP: $TAILSCALE_IP)"
    else
        check_fail "Tailscale service running but not connected"
        echo "  Fix: sudo tailscale up"
    fi
else
    check_fail "Tailscaled service is not running"
    echo "  Fix: sudo systemctl start tailscaled"
fi

print_header "2. Checking Cloudflared"
if systemctl is-active cloudflared &> /dev/null; then
    check_pass "Cloudflared service is running"
    
    # Check if tunnel is connected by looking at recent logs
    if sudo journalctl -u cloudflared -n 50 --no-pager | grep -q "Registered tunnel connection"; then
        check_pass "Cloudflare tunnel is connected"
    else
        check_warn "Cloudflared running but tunnel connection not confirmed"
        echo "  Check: sudo journalctl -u cloudflared -n 50"
    fi
else
    check_fail "Cloudflared service is not running"
    echo "  Fix: sudo systemctl start cloudflared"
fi

print_header "3. Checking User Lingering"
if loginctl show-user $USER | grep -q "Linger=yes"; then
    check_pass "User lingering is enabled"
else
    check_fail "User lingering is NOT enabled"
    echo "  Fix: sudo loginctl enable-linger $USER"
    echo "  (Critical for containers to run when user is not logged in)"
fi

print_header "4. Checking Podman Socket"
if systemctl --user is-active podman.socket &> /dev/null; then
    check_pass "Podman socket is running"
else
    check_warn "Podman socket is not running"
    echo "  Fix: systemctl --user start podman.socket"
fi

print_header "5. Checking Fibeger Stack Service"
if systemctl --user is-enabled fibeger-stack.service &> /dev/null; then
    check_pass "Fibeger stack service is enabled"
    
    if systemctl --user is-active fibeger-stack.service &> /dev/null; then
        check_pass "Fibeger stack service is active"
    else
        check_fail "Fibeger stack service is enabled but not active"
        echo "  Check: systemctl --user status fibeger-stack.service"
        echo "  Fix: systemctl --user start fibeger-stack.service"
    fi
else
    check_warn "Fibeger stack service not found"
    echo "  Run: scripts/ensure-services-on-boot.sh to set up"
fi

print_header "6. Checking Podman Containers"
if [ -d "$DEPLOY_DIR" ]; then
    cd "$DEPLOY_DIR"
    
    # Give containers time to start if they just came up
    echo "Waiting for containers to start (max 60s)..."
    sleep 5
    
    # Check each expected container
    CONTAINERS=("db" "minio" "app" "caddy" "pgadmin")
    RUNNING=0
    
    for container in "${CONTAINERS[@]}"; do
        if podman-compose ps | grep -q "${container}.*Up"; then
            check_pass "Container '$container' is running"
            ((RUNNING++))
        else
            check_fail "Container '$container' is not running"
            echo "  Check: podman-compose logs $container"
        fi
    done
    
    echo ""
    echo "Summary: $RUNNING/${#CONTAINERS[@]} containers running"
    
    if [ $RUNNING -eq ${#CONTAINERS[@]} ]; then
        check_pass "All containers are running"
    fi
else
    check_fail "Deployment directory not found: $DEPLOY_DIR"
fi

print_header "7. Checking Container Health"
if [ -d "$DEPLOY_DIR" ]; then
    cd "$DEPLOY_DIR"
    
    # Check database health
    if podman-compose ps | grep -q "db.*Up.*healthy"; then
        check_pass "Database is healthy"
    elif podman-compose ps | grep -q "db.*Up"; then
        check_warn "Database is running but health status unknown"
    else
        check_fail "Database health check failed"
    fi
    
    # Check MinIO health
    if podman-compose ps | grep -q "minio.*Up.*healthy"; then
        check_pass "MinIO is healthy"
    elif podman-compose ps | grep -q "minio.*Up"; then
        check_warn "MinIO is running but health status unknown"
    else
        check_fail "MinIO health check failed"
    fi
fi

print_header "8. Checking Network Connectivity"

# Check if Caddy is responding locally
if command -v curl &> /dev/null; then
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080 | grep -q "200\|301\|302"; then
        check_pass "Caddy is responding on localhost:8080"
    else
        check_fail "Caddy is not responding on localhost:8080"
        echo "  Check: podman-compose logs caddy"
    fi
else
    check_warn "curl not installed, skipping local connectivity test"
fi

print_header "9. Checking External Access"

# Try to reach the public domain (if configured)
if [ -f "$DEPLOY_DIR/.env" ] && grep -q "NEXTAUTH_URL" "$DEPLOY_DIR/.env"; then
    DOMAIN=$(grep "NEXTAUTH_URL" "$DEPLOY_DIR/.env" | cut -d= -f2 | cut -d/ -f3)
    
    if command -v curl &> /dev/null && [ -n "$DOMAIN" ]; then
        echo "Testing public access to $DOMAIN..."
        if curl -s -o /dev/null -w "%{http_code}" -m 10 "https://$DOMAIN" | grep -q "200\|301\|302"; then
            check_pass "Public domain $DOMAIN is accessible"
        else
            check_warn "Could not reach public domain $DOMAIN"
            echo "  This might be normal if Cloudflare Tunnel is still connecting"
            echo "  Wait 1-2 minutes and try: curl -I https://$DOMAIN"
        fi
    fi
fi

print_header "10. Recent Container Logs (Last 10 lines)"
if [ -d "$DEPLOY_DIR" ]; then
    cd "$DEPLOY_DIR"
    
    for container in db app caddy; do
        echo ""
        echo "=== $container ==="
        podman-compose logs --tail=10 $container 2>/dev/null || echo "Could not fetch logs for $container"
    done
fi

# Final Summary
print_header "Verification Summary"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! System is healthy.${NC}"
    echo ""
    echo "Your Fibeger deployment is running correctly."
    echo ""
    echo "Access your app at:"
    if [ -f "$DEPLOY_DIR/.env" ]; then
        DOMAIN=$(grep "NEXTAUTH_URL" "$DEPLOY_DIR/.env" | cut -d= -f2 || echo "https://your-domain.com")
        echo "  $DOMAIN"
    fi
    exit 0
elif [ $ERRORS -eq 0 ] && [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠ Verification completed with $WARNINGS warning(s).${NC}"
    echo ""
    echo "Most services are running, but some checks need attention."
    echo "Review the warnings above."
    exit 0
else
    echo -e "${RED}✗ Verification failed with $ERRORS error(s) and $WARNINGS warning(s).${NC}"
    echo ""
    echo "Critical issues detected. Please address the errors above."
    echo ""
    echo "Common fixes:"
    echo "1. Start services: systemctl --user start fibeger-stack.service"
    echo "2. Check logs: journalctl --user -u fibeger-stack.service -n 50"
    echo "3. Manual container start: cd $DEPLOY_DIR && podman-compose up -d"
    echo "4. View container logs: cd $DEPLOY_DIR && podman-compose logs -f"
    exit 1
fi
