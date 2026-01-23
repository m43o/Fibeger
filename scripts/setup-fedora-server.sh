#!/bin/bash
# Fedora Server Setup Script for Fibeger Deployment
# Run this script on your Fedora server to set up the deployment environment

set -euo pipefail

echo "=========================================="
echo "Fibeger Deployment Setup for Fedora"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[i]${NC} $1"
}

# Check if running on Fedora
if [ ! -f /etc/fedora-release ]; then
    print_error "This script is designed for Fedora. Detected: $(cat /etc/os-release | grep PRETTY_NAME)"
    exit 1
fi

print_status "Running on Fedora: $(cat /etc/fedora-release)"
echo ""

# Step 1: Install required packages
echo "Step 1: Installing required packages..."
print_info "Installing: podman-compose, git, cloudflared"

if ! command -v podman &> /dev/null; then
    print_warning "Podman not found, installing..."
    sudo dnf install -y podman
fi

if ! command -v podman-compose &> /dev/null; then
    print_info "Installing podman-compose..."
    sudo dnf install -y podman-compose
fi

if ! command -v git &> /dev/null; then
    print_info "Installing git..."
    sudo dnf install -y git
fi

if ! command -v cloudflared &> /dev/null; then
    print_info "Installing cloudflared..."
    sudo dnf install -y cloudflared
fi

print_status "All packages installed"
echo ""

# Step 2: Configure Tailscale
echo "Step 2: Configuring Tailscale..."

if ! command -v tailscale &> /dev/null; then
    print_warning "Tailscale not found, installing..."
    sudo dnf install -y tailscale
    sudo systemctl enable --now tailscaled
fi

if ! sudo tailscale status &> /dev/null; then
    print_warning "Tailscale not connected. Please run: sudo tailscale up"
    echo "After connecting, run this script again."
else
    TAILSCALE_IP=$(tailscale ip -4)
    print_status "Tailscale connected. IP: $TAILSCALE_IP"
    print_warning "Update this IP in .github/workflows/ci-deploy.yml (line 56)"
fi
echo ""

# Step 3: Create deployment directory
echo "Step 3: Setting up deployment directory..."

DEPLOY_DIR="/opt/fibeger"
print_info "Creating directory: $DEPLOY_DIR"

if [ ! -d "$DEPLOY_DIR" ]; then
    sudo mkdir -p "$DEPLOY_DIR"
    sudo chown -R $USER:$USER "$DEPLOY_DIR"
    print_status "Directory created: $DEPLOY_DIR"
else
    print_warning "Directory already exists: $DEPLOY_DIR"
fi

cd "$DEPLOY_DIR"
echo ""

# Step 4: Create .env file
echo "Step 4: Creating environment file..."

ENV_FILE="$DEPLOY_DIR/.env"

if [ -f "$ENV_FILE" ]; then
    print_warning ".env file already exists. Skipping creation."
    print_info "Current .env location: $ENV_FILE"
else
    print_info "Creating .env file..."
    
    # Generate random passwords
    ADMIN_PASSWORD=$(openssl rand -base64 16)
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    
    cat > "$ENV_FILE" << EOF
# Admin credentials (used for DB, MinIO, pgAdmin)
ADMIN_USER=admin
ADMIN_PASSWORD=$ADMIN_PASSWORD

# NextAuth secret (auto-generated)
NEXTAUTH_SECRET=$NEXTAUTH_SECRET

# Image reference (will be updated by CI/CD automatically)
IMAGE_REF=ghcr.io/yourusername/fibeger:latest
EOF
    
    chmod 600 "$ENV_FILE"
    print_status ".env file created with secure permissions"
    print_warning "IMPORTANT: Save these credentials!"
    echo ""
    echo "Admin User: admin"
    echo "Admin Password: $ADMIN_PASSWORD"
    echo "NextAuth Secret: $NEXTAUTH_SECRET"
    echo ""
    print_info "These are saved in: $ENV_FILE"
fi
echo ""

# Step 5: Configure Cloudflare Tunnel
echo "Step 5: Configuring Cloudflare Tunnel..."

if [ ! -d "$HOME/.cloudflared" ]; then
    print_warning "Cloudflare not authenticated. Please run:"
    echo "  cloudflared tunnel login"
    echo ""
    print_info "After authentication, create a tunnel:"
    echo "  cloudflared tunnel create fibeger"
    echo ""
    print_info "Then create /etc/cloudflared/config.yml with your tunnel config"
else
    print_status "Cloudflare credentials found at $HOME/.cloudflared"
    
    # Check if tunnel service is installed
    if systemctl is-enabled cloudflared &> /dev/null; then
        print_status "Cloudflared service is installed and enabled"
    else
        print_warning "Cloudflared service not installed. Run:"
        echo "  sudo cloudflared service install"
        echo "  sudo systemctl enable --now cloudflared"
    fi
fi
echo ""

# Step 6: Enable rootless Podman
echo "Step 6: Configuring rootless Podman..."

if ! systemctl --user is-enabled podman.socket &> /dev/null; then
    systemctl --user enable --now podman.socket
    print_status "Podman socket enabled for user"
else
    print_status "Podman socket already enabled"
fi

# Add DOCKER_HOST to .bashrc if not present
if ! grep -q "DOCKER_HOST" "$HOME/.bashrc"; then
    echo "export DOCKER_HOST=unix:///run/user/$(id -u)/podman/podman.sock" >> "$HOME/.bashrc"
    print_status "Added DOCKER_HOST to .bashrc"
else
    print_status "DOCKER_HOST already in .bashrc"
fi
echo ""

# Step 7: Test Tailscale SSH
echo "Step 7: Testing Tailscale SSH..."

if sudo tailscale status &> /dev/null; then
    TAILSCALE_IP=$(tailscale ip -4)
    print_info "Your Tailscale IP: $TAILSCALE_IP"
    print_info "Test SSH from another machine with:"
    echo "  tailscale ssh $USER@$TAILSCALE_IP"
else
    print_warning "Tailscale not connected. Cannot test SSH."
fi
echo ""

# Step 8: Summary
echo "=========================================="
echo "Setup Summary"
echo "=========================================="
echo ""

print_status "Packages installed: podman, podman-compose, git, cloudflared, tailscale"
print_status "Deployment directory: $DEPLOY_DIR"
print_status "Environment file: $ENV_FILE"

echo ""
print_warning "Next Steps:"
echo "1. Copy docker-compose.yml and Caddyfile to $DEPLOY_DIR"
echo "2. Update IMAGE_REF in $ENV_FILE with your actual GitHub Container Registry URL"
echo "3. Configure Cloudflare Tunnel (if not done):"
echo "   - cloudflared tunnel login"
echo "   - cloudflared tunnel create fibeger"
echo "   - Create /etc/cloudflared/config.yml"
echo "   - cloudflared tunnel route dns fibeger fibeger.com"
echo "   - sudo cloudflared service install"
echo "   - sudo systemctl enable --now cloudflared"
echo "4. Configure GitHub Secrets (GHCR_PAT, TAILSCALE_ID, TAILSCALE_SECRET)"
echo "5. Update .github/workflows/ci-deploy.yml with your Tailscale IP: $TAILSCALE_IP"
echo "6. Test manual deployment: cd $DEPLOY_DIR && podman-compose up -d"
echo "7. Configure auto-start on boot: cd $DEPLOY_DIR && bash scripts/ensure-services-on-boot.sh"
echo "8. Test reboot: sudo reboot (then wait 2-3 min and run: bash scripts/verify-after-reboot.sh)"
echo "9. Push to main branch to trigger GitHub Actions deployment"
echo ""

print_info "Documentation:"
echo "  - Full deployment guide: docs/DEPLOYMENT_GUIDE.md"
echo "  - Deployment checklist: docs/DEPLOYMENT_CHECKLIST.md"
echo "  - Auto-start after reboot: docs/AUTO_START_AFTER_REBOOT.md"
echo "  - Quick reference: docs/REBOOT_QUICK_REFERENCE.md"
echo ""

print_status "Setup complete!"
