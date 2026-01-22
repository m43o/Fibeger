# Fibeger Deployment Quick Start

This is a condensed guide to get Fibeger deployed quickly. For detailed instructions, see the full guides.

## Prerequisites

- ✅ Fedora server with Podman
- ✅ GitHub account with repository
- ✅ Tailscale account
- ✅ Cloudflare account with domain
- ✅ 30-60 minutes for initial setup

---

## 10-Minute Setup Guide

### 1. GitHub (5 minutes)

**Create GitHub Secrets:**
1. Go to: `https://github.com/YOUR_USERNAME/Fibeger/settings/secrets/actions`
2. Add three secrets:
   - `GHCR_PAT` - Generate at https://github.com/settings/tokens (needs `write:packages`)
   - `TAILSCALE_ID` - Get from https://login.tailscale.com/admin/settings/oauth
   - `TAILSCALE_SECRET` - Get from same OAuth page

📖 **Detailed guide:** [GITHUB_SETUP.md](./GITHUB_SETUP.md)

---

### 2. Fedora Server (15 minutes)

**Run automated setup:**

```bash
# Copy setup script to server
scp scripts/setup-fedora-server.sh user@your-server:~/

# SSH to server
ssh user@your-server

# Run setup
chmod +x setup-fedora-server.sh
./setup-fedora-server.sh
```

**The script will:**
- ✅ Install: podman-compose, git, cloudflared, tailscale
- ✅ Create: `/opt/fibeger` directory
- ✅ Generate: `.env` file with secure passwords
- ✅ Configure: Rootless Podman
- ✅ Show: Your Tailscale IP (save this!)

**⚠️ IMPORTANT:** Save the passwords shown at the end!

📖 **Detailed guide:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

---

### 3. Copy Files to Server (2 minutes)

```bash
# Option A: Clone repository
ssh user@your-server
cd /opt/fibeger
git clone https://github.com/YOUR_USERNAME/Fibeger.git .

# Option B: Copy files manually
scp docker-compose.yml user@your-server:/opt/fibeger/
scp Caddyfile user@your-server:/opt/fibeger/
```

---

### 4. Update Configuration (3 minutes)

**On Server - Update .env:**

```bash
ssh user@your-server
cd /opt/fibeger
nano .env
```

Change `IMAGE_REF` to your GitHub Container Registry URL:

```bash
IMAGE_REF=ghcr.io/YOUR_GITHUB_USERNAME/fibeger:latest
```

**On Local Machine - Update Workflow:**

Edit `.github/workflows/ci-deploy.yml` line 56:

```yaml
SERVER_TS_HOST: YOUR_TAILSCALE_IP  # Replace with IP from setup script
```

Commit and push:

```bash
git add .github/workflows/ci-deploy.yml
git commit -m "Configure Tailscale IP"
git push origin main
```

---

### 5. Cloudflare Tunnel (10 minutes)

**On Server:**

```bash
# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create fibeger
# Save the tunnel ID shown!

# Copy config template
sudo cp ~/cloudflared-config.example.yml /etc/cloudflared/config.yml

# Edit config
sudo nano /etc/cloudflared/config.yml
# Replace YOUR_TUNNEL_ID and YOUR_USERNAME

# Create DNS records
cloudflared tunnel route dns fibeger fibeger.com
cloudflared tunnel route dns fibeger minio.fibeger.com

# Install and start service
sudo cloudflared service install
sudo systemctl enable --now cloudflared

# Verify
sudo systemctl status cloudflared
```

📖 **Detailed guide:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md#step-4-cloudflare-tunnel-setup)

---

### 6. Deploy! (5-10 minutes)

**Push to GitHub to trigger deployment:**

```bash
git commit --allow-empty -m "Initial deployment"
git push origin main
```

**Monitor deployment:**
1. Go to: `https://github.com/YOUR_USERNAME/Fibeger/actions`
2. Watch the workflow run (takes ~10 minutes)
3. Wait for both jobs to complete ✅

---

### 7. Initialize MinIO (2 minutes)

**Create bucket:**
1. Go to: `https://minio.fibeger.com`
2. Login with credentials from `.env` file
3. Click **"Buckets"** → **"Create Bucket"**
4. Name: `fibeger`
5. Set to **public read** (or configure policies)

---

### 8. Verify (1 minute)

**Test your deployment:**

```bash
# Test website
curl https://fibeger.com

# On server - check containers
ssh user@your-server
cd /opt/fibeger
podman-compose ps

# Should show 5 containers running:
# ✅ db, minio, pgadmin, app, caddy
```

**Visit your site:**
- 🌐 Main app: https://fibeger.com
- 🗄️ MinIO: https://minio.fibeger.com

---

## Troubleshooting

### GitHub Actions Fails

**Check:**
- ✅ All three secrets exist: `GHCR_PAT`, `TAILSCALE_ID`, `TAILSCALE_SECRET`
- ✅ Tailscale IP is correct in workflow
- ✅ Server is connected to Tailscale: `tailscale status`

**Test SSH:**
```bash
tailscale ssh user@YOUR_TAILSCALE_IP
```

---

### Containers Not Starting

**Check logs:**
```bash
ssh user@your-server
cd /opt/fibeger
podman-compose logs -f
```

**Common fixes:**
```bash
# Restart containers
podman-compose down
podman-compose up -d

# Check .env file
cat .env

# Check permissions
ls -la .env  # Should show -rw------- (600)
```

---

### Website Not Loading

**Check Cloudflare Tunnel:**
```bash
# On server
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -f
```

**Test locally:**
```bash
curl -H "Host: fibeger.com" http://127.0.0.1:8080
```

**Common fixes:**
```bash
# Restart tunnel
sudo systemctl restart cloudflared

# Check config
sudo cat /etc/cloudflared/config.yml
```

---

## Next Steps After Deployment

### ✅ Security Checklist
- [ ] Rotate secrets every 90 days
- [ ] Enable Tailscale ACLs
- [ ] Configure MinIO bucket policies
- [ ] Set up automated backups
- [ ] Enable SELinux (if disabled)

### ✅ Optional Enhancements
- [ ] Set up monitoring (Prometheus/Grafana)
- [ ] Configure automated backups
- [ ] Add staging environment
- [ ] Set up log aggregation
- [ ] Configure email notifications

---

## Complete Documentation

### 📚 Available Guides

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **[README_QUICKSTART.md](./README_QUICKSTART.md)** | 10-minute setup | First-time deployment |
| **[DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)** | Complete guide | Full detailed instructions |
| **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** | Step-by-step checklist | Verify all steps complete |
| **[GITHUB_SETUP.md](./GITHUB_SETUP.md)** | GitHub configuration | Setting up CI/CD |
| **[scripts/README.md](../scripts/README.md)** | Scripts documentation | Understanding helper scripts |

### 🛠️ Helper Resources

| Resource | Purpose |
|----------|---------|
| **[.env.example](../.env.example)** | Environment variables template |
| **[setup-fedora-server.sh](../scripts/setup-fedora-server.sh)** | Automated server setup |
| **[cloudflared-config.example.yml](../scripts/cloudflared-config.example.yml)** | Cloudflare Tunnel template |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        GITHUB ACTIONS                        │
│  • Build Docker image                                        │
│  • Push to GHCR                                              │
│  • Deploy via Tailscale SSH                                  │
└────────────────────────┬────────────────────────────────────┘
                         │ Tailscale SSH
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                      FEDORA SERVER                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Podman Compose Stack                                 │   │
│  │  • PostgreSQL (db)                                   │   │
│  │  • MinIO (object storage)                            │   │
│  │  • pgAdmin (database admin)                          │   │
│  │  • Next.js App (main application)                    │   │
│  │  • Caddy (reverse proxy on 127.0.0.1:8080)          │   │
│  └─────────────────────────────────────────────────────┘   │
│                         │                                    │
│                         ↓ localhost:8080                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Cloudflare Tunnel (cloudflared)                      │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS Tunnel
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE NETWORK                        │
│  • SSL/TLS Termination                                       │
│  • DDoS Protection                                           │
│  • CDN & Caching                                             │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                      PUBLIC INTERNET                         │
│  • https://fibeger.com                                       │
│  • https://minio.fibeger.com                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Support

**Need help?**

1. ✅ **Check logs first:**
   - GitHub Actions: Repository → Actions tab
   - Server: `podman-compose logs -f`
   - Cloudflared: `sudo journalctl -u cloudflared -f`
   - Tailscale: `tailscale status`

2. ✅ **Consult documentation:**
   - [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Comprehensive troubleshooting
   - [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Verify all steps
   - [GITHUB_SETUP.md](./GITHUB_SETUP.md) - CI/CD issues

3. ✅ **Common Issues:**
   - Tailscale connection → Check ACLs and OAuth credentials
   - Cloudflare tunnel → Check config and service status
   - Containers failing → Check logs and `.env` file
   - Website not loading → Verify entire chain from Cloudflare → Caddy

---

## Quick Commands Reference

```bash
# ===== Server Management =====
ssh user@your-server
cd /opt/fibeger

# Check status
podman-compose ps

# View logs
podman-compose logs -f [service]

# Restart
podman-compose restart [service]
podman-compose down && podman-compose up -d

# ===== Cloudflare Tunnel =====
sudo systemctl status cloudflared
sudo systemctl restart cloudflared
sudo journalctl -u cloudflared -f

# ===== Tailscale =====
tailscale status
tailscale ip -4
tailscale ssh user@server

# ===== GitHub Actions =====
gh run list
gh run view
gh run watch

# ===== Local Testing =====
curl -H "Host: fibeger.com" http://127.0.0.1:8080
curl https://fibeger.com

# ===== Database =====
podman exec -it fibeger_db_1 psql -U admin fibeger

# ===== Cleanup =====
podman image prune -a
podman container prune
```

---

**That's it! Your Fibeger deployment should now be live! 🎉**

For detailed instructions on any step, see the full documentation linked above.
