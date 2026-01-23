# Auto-Start After Reboot Guide

This guide ensures your Fibeger deployment automatically starts after a Fedora server reboot.

## Overview

After a server reboot, the following components need to start automatically:

1. **Tailscale** - For SSH access from GitHub Actions
2. **Cloudflared** - For public HTTPS access via Cloudflare Tunnel
3. **Podman Containers** - Database, MinIO, App, Caddy, pgAdmin

## Quick Start

### One-Time Setup

Run this script once to configure all services to start on boot:

```bash
cd /opt/fibeger
bash scripts/ensure-services-on-boot.sh
```

This script will:
- ✓ Enable Tailscale to start on boot
- ✓ Enable Cloudflared to start on boot
- ✓ Enable user lingering (critical for rootless Podman)
- ✓ Create and enable systemd service for Fibeger containers
- ✓ Configure Podman socket

### After Every Reboot

Verify everything started correctly:

```bash
bash /opt/fibeger/scripts/verify-after-reboot.sh
```

This will check:
- All system services (Tailscale, Cloudflared)
- All containers (db, minio, app, caddy, pgadmin)
- Network connectivity
- Health checks

---

## Understanding the Components

### 1. Tailscale (System Service)

**Status:** Managed by systemd (system-level)

**Check:**
```bash
sudo systemctl status tailscaled
tailscale status
```

**Enable on boot:**
```bash
sudo systemctl enable tailscaled
```

**What it does:** Allows GitHub Actions to SSH into your server for deployments

---

### 2. Cloudflared (System Service)

**Status:** Managed by systemd (system-level)

**Check:**
```bash
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -n 50
```

**Enable on boot:**
```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
```

**What it does:** Exposes your app to the public internet via HTTPS tunnel

---

### 3. User Lingering (Critical Setting)

**Status:** User-level setting

**Check:**
```bash
loginctl show-user $USER | grep Linger
```

**Enable:**
```bash
sudo loginctl enable-linger $USER
```

**Why it matters:** Without this, your Podman containers will stop when you log out or on reboot. Lingering keeps user services running even when not logged in.

---

### 4. Podman Containers (User Service)

**Status:** Managed by systemd user service

**Check:**
```bash
systemctl --user status fibeger-stack.service
cd /opt/fibeger && podman-compose ps
```

**Enable on boot:**
```bash
systemctl --user enable fibeger-stack.service
```

**Manual control:**
```bash
# Start
systemctl --user start fibeger-stack.service

# Stop
systemctl --user stop fibeger-stack.service

# Restart
systemctl --user restart fibeger-stack.service

# View logs
journalctl --user -u fibeger-stack.service -f
```

**What it does:** Starts all Docker containers using podman-compose

---

## The Boot Sequence

When your Fedora server reboots, here's what happens:

```
1. System starts
   ↓
2. Tailscaled service starts (system-level)
   ↓
3. Cloudflared service starts (system-level)
   ↓
4. User lingering activates user services
   ↓
5. Podman socket starts (user-level)
   ↓
6. Fibeger-stack service starts (user-level)
   ↓
7. Podman-compose brings up all containers:
   - db (PostgreSQL)
   - minio (Object storage)
   - pgadmin (Database admin)
   - app (Next.js application)
   - caddy (Reverse proxy)
   ↓
8. Health checks run
   ↓
9. Cloudflare Tunnel connects to Caddy
   ↓
10. Your app is live! 🎉
```

**Expected boot time:** 2-3 minutes for all services to be fully operational

---

## Testing Auto-Start

### Test Plan

1. **Prepare for test:**
   ```bash
   # Ensure everything is configured
   cd /opt/fibeger
   bash scripts/ensure-services-on-boot.sh
   
   # Verify current state
   bash scripts/verify-after-reboot.sh
   ```

2. **Initiate reboot:**
   ```bash
   sudo reboot
   ```

3. **Wait 2-3 minutes** after reboot

4. **Verify services started:**
   ```bash
   cd /opt/fibeger
   bash scripts/verify-after-reboot.sh
   ```

5. **Check web access:**
   ```bash
   # From your local machine
   curl -I https://your-domain.com
   
   # Should return HTTP 200 or 301/302
   ```

---

## Troubleshooting

### Container didn't start

**Check the user service:**
```bash
systemctl --user status fibeger-stack.service
journalctl --user -u fibeger-stack.service -n 50
```

**Manually start:**
```bash
cd /opt/fibeger
podman-compose up -d
```

**Check container logs:**
```bash
cd /opt/fibeger
podman-compose logs -f
```

---

### Tailscale not connected

**Check status:**
```bash
sudo systemctl status tailscaled
tailscale status
```

**Reconnect:**
```bash
sudo tailscale up
```

---

### Cloudflared not connected

**Check status:**
```bash
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -n 50
```

**Look for errors like:**
- "dial tcp: connection refused" → Caddy isn't running
- "authentication failed" → Credentials issue

**Restart:**
```bash
sudo systemctl restart cloudflared
```

---

### Containers running but website not accessible

**Check local Caddy:**
```bash
curl -H "Host: your-domain.com" http://127.0.0.1:8080
```

If this works but public domain doesn't:
- Check Cloudflared: `sudo systemctl status cloudflared`
- Check DNS: `nslookup your-domain.com`
- Wait 1-2 minutes for tunnel to stabilize

If local Caddy doesn't work:
- Check Caddy logs: `podman-compose logs caddy`
- Check app logs: `podman-compose logs app`

---

### User lingering not enabled

**Symptom:** Containers stop when you log out or after reboot

**Fix:**
```bash
sudo loginctl enable-linger $USER
```

**Verify:**
```bash
loginctl show-user $USER | grep Linger
# Should show: Linger=yes
```

---

## Advanced: Alternative Container Management

Instead of the fibeger-stack.service, you can generate individual systemd services for each container:

```bash
cd /opt/fibeger

# Start containers first
podman-compose up -d

# Generate systemd service files
mkdir -p ~/.config/systemd/user
cd ~/.config/systemd/user

# For each container
podman generate systemd --new --files --name fibeger_app_1
podman generate systemd --new --files --name fibeger_db_1
podman generate systemd --new --files --name fibeger_minio_1
podman generate systemd --new --files --name fibeger_caddy_1
podman generate systemd --new --files --name fibeger_pgadmin_1

# Enable all services
systemctl --user enable container-fibeger_app_1.service
systemctl --user enable container-fibeger_db_1.service
systemctl --user enable container-fibeger_minio_1.service
systemctl --user enable container-fibeger_caddy_1.service
systemctl --user enable container-fibeger_pgadmin_1.service

# Reload and start
systemctl --user daemon-reload
systemctl --user start container-fibeger_app_1.service
```

**Pros:**
- Finer control over individual containers
- Can start/stop containers independently
- Better integration with systemd logging

**Cons:**
- More complex setup
- Need to manage dependencies between containers
- Harder to update when docker-compose.yml changes

---

## Monitoring After Reboot

### Quick Health Check

```bash
# Run the verification script
bash /opt/fibeger/scripts/verify-after-reboot.sh
```

### Manual Checks

```bash
# 1. System services
sudo systemctl status tailscaled
sudo systemctl status cloudflared

# 2. User services
systemctl --user status fibeger-stack.service

# 3. Containers
cd /opt/fibeger
podman-compose ps

# 4. Logs
podman-compose logs --tail=50

# 5. Network
curl -H "Host: your-domain.com" http://127.0.0.1:8080
curl -I https://your-domain.com

# 6. Tailscale
tailscale status
```

---

## Scheduled Health Checks

Set up a cron job to monitor services:

```bash
# Create monitoring script
cat > /opt/fibeger/scripts/health-check.sh << 'EOF'
#!/bin/bash
cd /opt/fibeger
if ! bash scripts/verify-after-reboot.sh > /tmp/fibeger-health.log 2>&1; then
    echo "Health check failed at $(date)" | mail -s "Fibeger Health Alert" admin@yourdomain.com
fi
EOF

chmod +x /opt/fibeger/scripts/health-check.sh

# Add to crontab (runs every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/fibeger/scripts/health-check.sh") | crontab -
```

---

## Checklist: Reboot Readiness

Use this checklist to ensure your system is ready for reboots:

### System Services
- [ ] Tailscaled enabled: `systemctl is-enabled tailscaled`
- [ ] Cloudflared enabled: `systemctl is-enabled cloudflared`
- [ ] Tailscale connected: `tailscale status`

### User Configuration
- [ ] User lingering enabled: `loginctl show-user $USER | grep Linger=yes`
- [ ] Podman socket enabled: `systemctl --user is-enabled podman.socket`
- [ ] Fibeger stack service exists: `systemctl --user status fibeger-stack.service`
- [ ] Fibeger stack enabled: `systemctl --user is-enabled fibeger-stack.service`

### Container Configuration
- [ ] All containers have `restart: unless-stopped` in docker-compose.yml
- [ ] Environment file exists: `/opt/fibeger/.env`
- [ ] Caddyfile exists: `/opt/fibeger/Caddyfile`

### Test Reboot
- [ ] Manual test reboot completed successfully
- [ ] Verification script passes after reboot
- [ ] Website accessible after reboot
- [ ] Can deploy via GitHub Actions after reboot

---

## Summary Commands

### Initial Setup (Run Once)
```bash
cd /opt/fibeger
bash scripts/ensure-services-on-boot.sh
```

### After Every Reboot (Verification)
```bash
bash /opt/fibeger/scripts/verify-after-reboot.sh
```

### Manual Service Management
```bash
# Start all services
systemctl --user start fibeger-stack.service

# Stop all services
systemctl --user stop fibeger-stack.service

# Restart all services
systemctl --user restart fibeger-stack.service

# View logs
journalctl --user -u fibeger-stack.service -f
```

### Emergency Recovery
```bash
# If automated startup fails, manually start:
cd /opt/fibeger

# Check what's running
podman-compose ps

# Start containers
podman-compose up -d

# Check logs
podman-compose logs -f
```

---

## References

- [Podman Systemd Integration](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html)
- [User Lingering](https://www.freedesktop.org/software/systemd/man/loginctl.html)
- [Cloudflared Service](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/run-tunnel/run-as-service/)
- [Tailscale on Linux](https://tailscale.com/kb/1031/install-linux/)

---

## Need Help?

If services don't start after reboot:

1. Run the verification script and save output:
   ```bash
   bash /opt/fibeger/scripts/verify-after-reboot.sh | tee /tmp/health-check.txt
   ```

2. Check system logs:
   ```bash
   sudo journalctl -b -n 200  # Boot logs
   ```

3. Check specific service logs:
   ```bash
   sudo journalctl -u cloudflared -n 50
   journalctl --user -u fibeger-stack.service -n 50
   ```

4. Review container logs:
   ```bash
   cd /opt/fibeger
   podman-compose logs --tail=100
   ```
