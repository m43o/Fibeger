# Reboot Quick Reference Card

Quick commands for managing Fibeger after a server reboot.

## 🚀 Quick Start After Reboot

```bash
# Wait 2-3 minutes after reboot, then run:
bash /opt/fibeger/scripts/verify-after-reboot.sh
```

---

## ✅ Health Check Commands

```bash
# Everything in one command
bash /opt/fibeger/scripts/verify-after-reboot.sh

# Check system services
sudo systemctl status tailscaled
sudo systemctl status cloudflared

# Check containers
cd /opt/fibeger && podman-compose ps

# Check website
curl -I https://your-domain.com
```

---

## 🔧 Common Fixes

### Containers Not Running

```bash
# Check user service
systemctl --user status fibeger-stack.service

# Manually start
systemctl --user start fibeger-stack.service

# Or directly via podman-compose
cd /opt/fibeger && podman-compose up -d
```

### Tailscale Not Connected

```bash
sudo systemctl status tailscaled
sudo tailscale up
```

### Cloudflared Not Connected

```bash
sudo systemctl status cloudflared
sudo systemctl restart cloudflared
```

### Website Not Accessible

```bash
# Test local Caddy
curl -H "Host: your-domain.com" http://127.0.0.1:8080

# Check Cloudflare tunnel
sudo journalctl -u cloudflared -n 20

# Check container logs
cd /opt/fibeger && podman-compose logs caddy
cd /opt/fibeger && podman-compose logs app
```

---

## 📊 Service Status Overview

```bash
# System services
systemctl is-active tailscaled cloudflared

# User services
systemctl --user is-active fibeger-stack.service podman.socket

# Containers
cd /opt/fibeger && podman-compose ps --format '{{.Service}}\t{{.Status}}'

# User lingering
loginctl show-user $USER | grep Linger
```

---

## 🔄 Restart Services

```bash
# Restart everything
systemctl --user restart fibeger-stack.service

# Restart individual containers
cd /opt/fibeger
podman-compose restart app
podman-compose restart caddy

# Restart system services
sudo systemctl restart cloudflared
```

---

## 📋 View Logs

```bash
# All containers
cd /opt/fibeger && podman-compose logs -f

# Specific container
cd /opt/fibeger && podman-compose logs -f app

# User service
journalctl --user -u fibeger-stack.service -f

# System services
sudo journalctl -u cloudflared -f
sudo journalctl -u tailscaled -f

# Boot logs (recent)
sudo journalctl -b -n 100
```

---

## 🛠️ Emergency Recovery

If automation fails, manually start everything:

```bash
# 1. Ensure Tailscale is up
sudo systemctl start tailscaled
sudo tailscale up

# 2. Ensure Cloudflared is up
sudo systemctl start cloudflared

# 3. Start containers manually
cd /opt/fibeger
podman-compose down
podman-compose up -d

# 4. Wait 30 seconds and verify
sleep 30
podman-compose ps
curl -I http://127.0.0.1:8080

# 5. Check website
curl -I https://your-domain.com
```

---

## 🎯 One-Time Setup Commands

Only needed once after initial deployment:

```bash
# Enable all services for auto-start
cd /opt/fibeger
bash scripts/ensure-services-on-boot.sh

# Enable user lingering (critical!)
sudo loginctl enable-linger $USER

# Verify setup
systemctl --user is-enabled fibeger-stack.service
loginctl show-user $USER | grep Linger
```

---

## 📱 Test Reboot Procedure

```bash
# 1. Verify current state
bash /opt/fibeger/scripts/verify-after-reboot.sh

# 2. Reboot
sudo reboot

# 3. Wait 2-3 minutes after reboot

# 4. SSH back in and verify
bash /opt/fibeger/scripts/verify-after-reboot.sh

# 5. Test website
curl -I https://your-domain.com

# 6. Test deployment (optional)
git push origin main
# Watch GitHub Actions to verify deployment still works
```

---

## 🔍 Troubleshooting Decision Tree

```
Website not loading?
│
├─ Can't curl localhost:8080?
│  │
│  ├─ Caddy not running?
│  │  └─ Run: podman-compose logs caddy
│  │
│  └─ App not running?
│     └─ Run: podman-compose logs app
│
└─ Localhost works but public domain doesn't?
   │
   ├─ Cloudflared not connected?
   │  └─ Run: sudo journalctl -u cloudflared -n 50
   │
   └─ Cloudflared running but tunnel not established?
      └─ Wait 1-2 minutes, then restart:
         sudo systemctl restart cloudflared
```

---

## 📈 Expected Boot Timeline

```
00:00 - Server boots
00:30 - System services start (Tailscale, Cloudflared)
01:00 - User services start (Podman)
01:30 - Containers start (DB, MinIO, App, Caddy)
02:00 - Health checks pass
02:30 - Cloudflare Tunnel connects
03:00 - Website fully operational ✓
```

---

## 🚨 Critical Checks

These must be enabled for auto-start to work:

```bash
# User lingering (CRITICAL!)
loginctl show-user $USER | grep Linger=yes

# Systemd services
systemctl is-enabled tailscaled      # Should be: enabled
systemctl is-enabled cloudflared     # Should be: enabled
systemctl --user is-enabled fibeger-stack.service  # Should be: enabled
```

---

## 💾 Backup & Restore After Issues

```bash
# Backup database
podman exec fibeger_db_1 pg_dump -U admin fibeger > /tmp/backup-$(date +%Y%m%d).sql

# Restore database
podman exec -i fibeger_db_1 psql -U admin fibeger < /tmp/backup-20260123.sql

# Recreate containers
cd /opt/fibeger
podman-compose down
podman-compose up -d --force-recreate
```

---

## 📞 Support Checklist

If you need to report an issue, gather this info:

```bash
# System info
uname -a
uptime

# Service status
systemctl is-active tailscaled cloudflared
systemctl --user is-active fibeger-stack.service

# Container status
cd /opt/fibeger && podman-compose ps

# Recent logs
sudo journalctl -b -n 50 > /tmp/boot-logs.txt
sudo journalctl -u cloudflared -n 50 > /tmp/cloudflared-logs.txt
journalctl --user -u fibeger-stack.service -n 50 > /tmp/fibeger-logs.txt
cd /opt/fibeger && podman-compose logs --tail=50 > /tmp/container-logs.txt

# Verification output
bash /opt/fibeger/scripts/verify-after-reboot.sh > /tmp/verification.txt
```

---

## 🔐 Security Notes

- Never expose Podman ports directly (always use Cloudflare Tunnel)
- Keep `.env` file permissions at 600: `chmod 600 /opt/fibeger/.env`
- Regularly update system: `sudo dnf update -y`
- Monitor logs for suspicious activity

---

## 📚 Additional Resources

- Full guide: `/opt/fibeger/docs/AUTO_START_AFTER_REBOOT.md`
- Deployment guide: `/opt/fibeger/docs/DEPLOYMENT_GUIDE.md`
- Deployment checklist: `/opt/fibeger/docs/DEPLOYMENT_CHECKLIST.md`

---

## 💡 Pro Tips

1. **Set up monitoring**: Create a cron job to run the verification script every 5 minutes
2. **Bookmark status page**: Keep your domain's status page open for quick checks
3. **Enable notifications**: Configure email alerts for service failures
4. **Test reboots regularly**: Monthly reboot tests catch issues before they matter
5. **Document customizations**: Keep notes on any changes to standard setup

---

**Last Updated:** 2026-01-23
