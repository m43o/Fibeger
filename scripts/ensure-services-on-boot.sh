#!/bin/bash
# Script to ensure all Fibeger services start on boot
# Run this once after initial setup to configure auto-start

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=========================================="
echo "Configuring Fibeger Services for Auto-Start"
echo "=========================================="
echo ""

# 1. Enable Tailscale
echo "1. Checking Tailscale..."
if systemctl is-enabled tailscaled &> /dev/null; then
    echo -e "${GREEN}✓${NC} Tailscaled is enabled"
else
    echo -e "${YELLOW}!${NC} Enabling Tailscaled..."
    sudo systemctl enable tailscaled
    echo -e "${GREEN}✓${NC} Tailscaled enabled"
fi

if sudo tailscale status &> /dev/null; then
    echo -e "${GREEN}✓${NC} Tailscale is connected"
else
    echo -e "${RED}✗${NC} Tailscale not connected. Run: sudo tailscale up"
fi
echo ""

# 2. Enable Cloudflared
echo "2. Checking Cloudflared..."
if systemctl is-enabled cloudflared &> /dev/null; then
    echo -e "${GREEN}✓${NC} Cloudflared is enabled"
else
    echo -e "${YELLOW}!${NC} Cloudflared not enabled. Run:"
    echo "  sudo cloudflared service install"
    echo "  sudo systemctl enable --now cloudflared"
fi

if systemctl is-active cloudflared &> /dev/null; then
    echo -e "${GREEN}✓${NC} Cloudflared is running"
else
    echo -e "${YELLOW}!${NC} Cloudflared not running"
fi
echo ""

# 3. Enable user lingering (critical for rootless Podman)
echo "3. Checking user lingering..."
if loginctl show-user $USER | grep -q "Linger=yes"; then
    echo -e "${GREEN}✓${NC} User lingering is enabled"
else
    echo -e "${YELLOW}!${NC} Enabling user lingering..."
    sudo loginctl enable-linger $USER
    echo -e "${GREEN}✓${NC} User lingering enabled"
    echo -e "${YELLOW}!${NC} This allows your containers to run even when you're not logged in"
fi
echo ""

# 4. Enable Podman socket
echo "4. Checking Podman socket..."
if systemctl --user is-enabled podman.socket &> /dev/null; then
    echo -e "${GREEN}✓${NC} Podman socket is enabled"
else
    echo -e "${YELLOW}!${NC} Enabling Podman socket..."
    systemctl --user enable podman.socket
    echo -e "${GREEN}✓${NC} Podman socket enabled"
fi

if systemctl --user is-active podman.socket &> /dev/null; then
    echo -e "${GREEN}✓${NC} Podman socket is running"
else
    echo -e "${YELLOW}!${NC} Starting Podman socket..."
    systemctl --user start podman.socket
fi
echo ""

# 5. Check if containers should be managed by systemd
echo "5. Podman container auto-start options:"
echo ""
echo "Option A (Recommended): Generate systemd services for containers"
echo "  cd /opt/fibeger"
echo "  podman-compose up -d"
echo "  cd ~/.config/systemd/user/"
echo "  podman generate systemd --new --files --name fibeger_app_1"
echo "  systemctl --user enable container-fibeger_app_1.service"
echo ""
echo "Option B (Simpler): Use a systemd service to run podman-compose"
echo "  See below for service file generation"
echo ""

# Generate a systemd service file for podman-compose
DEPLOY_DIR="/opt/fibeger"
SERVICE_FILE="$HOME/.config/systemd/user/fibeger-stack.service"

echo "6. Generating systemd service for Fibeger stack..."
mkdir -p "$HOME/.config/systemd/user"

cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Fibeger Application Stack
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$DEPLOY_DIR
ExecStart=/usr/bin/podman-compose up -d
ExecStop=/usr/bin/podman-compose down
TimeoutStartSec=300

[Install]
WantedBy=default.target
EOF

echo -e "${GREEN}✓${NC} Service file created: $SERVICE_FILE"
echo ""

# Enable the service
echo "7. Enabling Fibeger stack service..."
systemctl --user daemon-reload
systemctl --user enable fibeger-stack.service
echo -e "${GREEN}✓${NC} Fibeger stack service enabled"
echo ""

# Summary
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""
echo -e "${GREEN}✓${NC} Tailscaled: $(systemctl is-enabled tailscaled 2>/dev/null || echo 'not enabled')"
echo -e "${GREEN}✓${NC} Cloudflared: $(systemctl is-enabled cloudflared 2>/dev/null || echo 'not enabled')"
echo -e "${GREEN}✓${NC} User lingering: $(loginctl show-user $USER | grep Linger | cut -d= -f2)"
echo -e "${GREEN}✓${NC} Podman socket: $(systemctl --user is-enabled podman.socket 2>/dev/null || echo 'not enabled')"
echo -e "${GREEN}✓${NC} Fibeger stack: $(systemctl --user is-enabled fibeger-stack.service 2>/dev/null || echo 'not enabled')"
echo ""

echo "=========================================="
echo "Testing Auto-Start"
echo "=========================================="
echo ""
echo "To test if everything will start on boot:"
echo "1. Stop all services:"
echo "   cd $DEPLOY_DIR && podman-compose down"
echo "   sudo systemctl stop cloudflared"
echo ""
echo "2. Reboot the server:"
echo "   sudo reboot"
echo ""
echo "3. After reboot, wait 2-3 minutes and check:"
echo "   sudo systemctl status tailscaled"
echo "   sudo systemctl status cloudflared"
echo "   systemctl --user status fibeger-stack.service"
echo "   cd $DEPLOY_DIR && podman-compose ps"
echo ""

echo "=========================================="
echo "Manual Service Management"
echo "=========================================="
echo ""
echo "Start services manually:"
echo "  systemctl --user start fibeger-stack.service"
echo ""
echo "Stop services manually:"
echo "  systemctl --user stop fibeger-stack.service"
echo ""
echo "View service logs:"
echo "  journalctl --user -u fibeger-stack.service -f"
echo ""
echo "Restart after changes:"
echo "  systemctl --user restart fibeger-stack.service"
echo ""

echo -e "${GREEN}✓${NC} Configuration complete!"
