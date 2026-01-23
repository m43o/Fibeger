#!/bin/bash
# Script to set up automated monitoring for Fibeger services
# This creates a cron job that periodically checks service health

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

DEPLOY_DIR="/opt/fibeger"
LOG_DIR="/var/log/fibeger"
HEALTH_CHECK_SCRIPT="$DEPLOY_DIR/scripts/verify-after-reboot.sh"

echo "=========================================="
echo "Fibeger Monitoring Setup"
echo "=========================================="
echo ""

# Check if verify script exists
if [ ! -f "$HEALTH_CHECK_SCRIPT" ]; then
    echo -e "${RED}✗${NC} Health check script not found: $HEALTH_CHECK_SCRIPT"
    exit 1
fi

# Create log directory
if [ ! -d "$LOG_DIR" ]; then
    echo "Creating log directory: $LOG_DIR"
    sudo mkdir -p "$LOG_DIR"
    sudo chown $USER:$USER "$LOG_DIR"
    echo -e "${GREEN}✓${NC} Log directory created"
else
    echo -e "${GREEN}✓${NC} Log directory already exists"
fi

# Create monitoring script
MONITOR_SCRIPT="$DEPLOY_DIR/scripts/monitor-health.sh"

cat > "$MONITOR_SCRIPT" << 'EOF'
#!/bin/bash
# Automated health monitoring for Fibeger
# This script runs periodically via cron

DEPLOY_DIR="/opt/fibeger"
LOG_DIR="/var/log/fibeger"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
LOG_FILE="$LOG_DIR/health-check-$TIMESTAMP.log"

# Keep only last 7 days of logs
find "$LOG_DIR" -name "health-check-*.log" -mtime +7 -delete

# Run health check
if bash "$DEPLOY_DIR/scripts/verify-after-reboot.sh" > "$LOG_FILE" 2>&1; then
    # Success - keep log but don't alert
    exit 0
else
    # Failure - log and alert
    echo "Health check failed at $(date)" >> "$LOG_DIR/failures.log"
    
    # Try to restart services automatically
    echo "Attempting automatic recovery..." >> "$LOG_FILE"
    systemctl --user restart fibeger-stack.service >> "$LOG_FILE" 2>&1
    
    # Wait 30 seconds and check again
    sleep 30
    if bash "$DEPLOY_DIR/scripts/verify-after-reboot.sh" >> "$LOG_FILE" 2>&1; then
        echo "Recovery successful" >> "$LOG_FILE"
        echo "Auto-recovery successful at $(date)" >> "$LOG_DIR/recoveries.log"
    else
        echo "Recovery failed" >> "$LOG_FILE"
        # Send alert (if mail is configured)
        if command -v mail &> /dev/null; then
            mail -s "Fibeger Health Check Failed" root < "$LOG_FILE"
        fi
    fi
fi
EOF

chmod +x "$MONITOR_SCRIPT"
echo -e "${GREEN}✓${NC} Monitoring script created: $MONITOR_SCRIPT"
echo ""

# Ask user about monitoring frequency
echo "How often should health checks run?"
echo "1) Every 5 minutes (recommended for production)"
echo "2) Every 15 minutes"
echo "3) Every hour"
echo "4) Custom interval"
echo ""
read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        CRON_SCHEDULE="*/5 * * * *"
        DESCRIPTION="every 5 minutes"
        ;;
    2)
        CRON_SCHEDULE="*/15 * * * *"
        DESCRIPTION="every 15 minutes"
        ;;
    3)
        CRON_SCHEDULE="0 * * * *"
        DESCRIPTION="every hour"
        ;;
    4)
        echo ""
        echo "Enter custom cron schedule (e.g., '*/10 * * * *' for every 10 minutes):"
        read -p "Schedule: " CRON_SCHEDULE
        DESCRIPTION="custom schedule: $CRON_SCHEDULE"
        ;;
    *)
        echo "Invalid choice. Defaulting to every 5 minutes."
        CRON_SCHEDULE="*/5 * * * *"
        DESCRIPTION="every 5 minutes"
        ;;
esac

echo ""
echo "Setting up monitoring to run $DESCRIPTION"
echo ""

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "monitor-health.sh"; then
    echo -e "${YELLOW}!${NC} Monitoring cron job already exists"
    read -p "Replace existing job? [y/N]: " replace
    if [[ ! "$replace" =~ ^[Yy]$ ]]; then
        echo "Keeping existing cron job"
        exit 0
    fi
    # Remove old job
    (crontab -l 2>/dev/null | grep -v "monitor-health.sh") | crontab -
fi

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_SCHEDULE $MONITOR_SCRIPT") | crontab -
echo -e "${GREEN}✓${NC} Cron job added"
echo ""

# Create systemd timer as alternative (optional)
echo "Would you like to use systemd timer instead of cron? (More reliable)"
read -p "[y/N]: " use_systemd

if [[ "$use_systemd" =~ ^[Yy]$ ]]; then
    # Remove cron job
    (crontab -l 2>/dev/null | grep -v "monitor-health.sh") | crontab -
    
    # Create systemd timer
    TIMER_FILE="$HOME/.config/systemd/user/fibeger-monitor.timer"
    SERVICE_FILE="$HOME/.config/systemd/user/fibeger-monitor.service"
    
    mkdir -p "$HOME/.config/systemd/user"
    
    # Determine OnUnitActiveSec based on choice
    case $choice in
        1) ON_UNIT_ACTIVE="5min" ;;
        2) ON_UNIT_ACTIVE="15min" ;;
        3) ON_UNIT_ACTIVE="1h" ;;
        *) ON_UNIT_ACTIVE="5min" ;;
    esac
    
    # Create service file
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Fibeger Health Check
After=network.target

[Service]
Type=oneshot
ExecStart=$MONITOR_SCRIPT
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
EOF
    
    # Create timer file
    cat > "$TIMER_FILE" << EOF
[Unit]
Description=Fibeger Health Check Timer
Requires=fibeger-monitor.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=$ON_UNIT_ACTIVE
AccuracySec=1min

[Install]
WantedBy=timers.target
EOF
    
    # Enable and start timer
    systemctl --user daemon-reload
    systemctl --user enable fibeger-monitor.timer
    systemctl --user start fibeger-monitor.timer
    
    echo -e "${GREEN}✓${NC} Systemd timer created and enabled"
    echo ""
    echo "Timer status:"
    systemctl --user status fibeger-monitor.timer --no-pager
fi

# Summary
echo ""
echo "=========================================="
echo "Monitoring Setup Complete"
echo "=========================================="
echo ""
echo -e "${GREEN}✓${NC} Health checks will run: $DESCRIPTION"
echo -e "${GREEN}✓${NC} Logs stored in: $LOG_DIR"
echo -e "${GREEN}✓${NC} Monitoring script: $MONITOR_SCRIPT"
echo ""

if [[ "$use_systemd" =~ ^[Yy]$ ]]; then
    echo "Management commands (systemd timer):"
    echo "  View timer status: systemctl --user status fibeger-monitor.timer"
    echo "  View recent checks: journalctl --user -u fibeger-monitor.service -n 20"
    echo "  Stop monitoring: systemctl --user stop fibeger-monitor.timer"
    echo "  Disable monitoring: systemctl --user disable fibeger-monitor.timer"
else
    echo "Management commands (cron):"
    echo "  View cron jobs: crontab -l"
    echo "  Edit cron jobs: crontab -e"
    echo "  Remove monitoring: crontab -e (delete the line with monitor-health.sh)"
fi

echo ""
echo "View health check logs:"
echo "  ls -lh $LOG_DIR"
echo "  cat $LOG_DIR/health-check-*.log | less"
echo "  cat $LOG_DIR/failures.log"
echo "  cat $LOG_DIR/recoveries.log"
echo ""

echo "Manual health check:"
echo "  bash $MONITOR_SCRIPT"
echo ""

echo -e "${GREEN}✓${NC} Setup complete!"
