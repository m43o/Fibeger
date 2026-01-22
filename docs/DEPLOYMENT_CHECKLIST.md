# Deployment Checklist

Use this checklist to ensure all steps are completed for deployment.

## Pre-Deployment Setup

### GitHub Configuration
- [ ] Repository exists and is accessible
- [ ] GitHub Actions is enabled
- [ ] Secrets configured in Settings → Secrets and variables → Actions:
  - [ ] `GHCR_PAT` (GitHub Personal Access Token with packages permissions)
  - [ ] `TAILSCALE_ID` (OAuth Client ID)
  - [ ] `TAILSCALE_SECRET` (OAuth Client Secret)

### Tailscale Configuration
- [ ] Tailscale account created
- [ ] OAuth client created with `tag:ci` tag
- [ ] Tailscale installed on Fedora server: `sudo dnf install -y tailscale`
- [ ] Tailscale started: `sudo tailscale up`
- [ ] Tailscale IP noted: `tailscale ip -4`
- [ ] Tailscale IP updated in `.github/workflows/ci-deploy.yml` (line 56)
- [ ] Tailscale SSH tested: `tailscale ssh deploy@YOUR_TAILSCALE_IP`

### Cloudflare Configuration
- [ ] Domain added to Cloudflare
- [ ] Cloudflared installed: `sudo dnf install -y cloudflared`
- [ ] Authenticated: `cloudflared tunnel login`
- [ ] Tunnel created: `cloudflared tunnel create fibeger`
- [ ] Tunnel ID noted
- [ ] Config file created: `/etc/cloudflared/config.yml`
- [ ] DNS records created:
  - [ ] `fibeger.com` → tunnel
  - [ ] `minio.fibeger.com` → tunnel
- [ ] Cloudflared service installed: `sudo cloudflared service install`
- [ ] Cloudflared service enabled: `sudo systemctl enable --now cloudflared`
- [ ] Cloudflared service running: `sudo systemctl status cloudflared`

## Fedora Server Setup

### System Packages
- [ ] Podman installed (usually pre-installed on Fedora)
- [ ] Podman-compose installed: `sudo dnf install -y podman-compose`
- [ ] Git installed: `sudo dnf install -y git`

### Deployment Directory
- [ ] Directory created: `sudo mkdir -p /opt/fibeger`
- [ ] Ownership set: `sudo chown -R $USER:$USER /opt/fibeger`
- [ ] Files copied/cloned to `/opt/fibeger`:
  - [ ] `docker-compose.yml`
  - [ ] `Caddyfile`

### Environment Configuration
- [ ] `.env` file created at `/opt/fibeger/.env`
- [ ] Environment variables set:
  - [ ] `ADMIN_USER` (your choice)
  - [ ] `ADMIN_PASSWORD` (secure password)
  - [ ] `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`)
  - [ ] `IMAGE_REF` (will be updated by CI/CD)
- [ ] Permissions set: `chmod 600 /opt/fibeger/.env`

### User Configuration
- [ ] User `deploy` exists (or whatever user you're using)
- [ ] User can run podman without sudo (rootless podman)
- [ ] User can access `/opt/fibeger` directory

## Initial Deployment

### First Time Setup
- [ ] Navigate to deployment directory: `cd /opt/fibeger`
- [ ] Test podman-compose: `podman-compose version`
- [ ] Pull images: `podman-compose pull` (may fail initially, that's ok)
- [ ] Start services: `podman-compose up -d`
- [ ] Check status: `podman-compose ps`
- [ ] All services healthy:
  - [ ] `db` (PostgreSQL)
  - [ ] `minio` (MinIO)
  - [ ] `pgadmin` (pgAdmin4)
  - [ ] `app` (Next.js app)
  - [ ] `caddy` (Caddy web server)

### MinIO Configuration
- [ ] Access MinIO console: https://minio.fibeger.com
- [ ] Login with `ADMIN_USER` and `ADMIN_PASSWORD`
- [ ] Create bucket: `fibeger`
- [ ] Set bucket policy (public read or as needed)

### Database Initialization
- [ ] Database migrations run (usually automatic via entrypoint.sh)
- [ ] Can connect to pgAdmin: http://localhost (if port exposed, or via Cloudflare)

## CI/CD Verification

### GitHub Actions
- [ ] Push code to `main` branch
- [ ] GitHub Actions workflow triggered
- [ ] Build job completes successfully
- [ ] Deploy job completes successfully
- [ ] Check Actions tab for any errors

### Deployment Verification
- [ ] SSH into server: `ssh your-user@your-server`
- [ ] Check running containers: `cd /opt/fibeger && podman-compose ps`
- [ ] Check app logs: `podman-compose logs -f app`
- [ ] No errors in logs

## Public Access Verification

### Website Accessibility
- [ ] Main app accessible: https://fibeger.com
- [ ] No certificate errors
- [ ] App loads correctly
- [ ] Can create account / login
- [ ] Can upload files (tests S3/MinIO integration)

### MinIO Access
- [ ] MinIO console accessible: https://minio.fibeger.com
- [ ] MinIO API accessible: https://fibeger.com/minio
- [ ] Files uploaded via app appear in MinIO bucket

### Network Path Verification
- [ ] Cloudflare Tunnel active: `sudo systemctl status cloudflared`
- [ ] Caddy running: `podman-compose ps caddy`
- [ ] App container running: `podman-compose ps app`
- [ ] Can curl locally: `curl -H "Host: fibeger.com" http://127.0.0.1:8080`

## Post-Deployment

### Monitoring
- [ ] Check Cloudflare analytics
- [ ] Monitor cloudflared logs: `sudo journalctl -u cloudflared -f`
- [ ] Monitor app logs: `podman-compose logs -f app`
- [ ] Monitor database logs: `podman-compose logs -f db`

### Backups
- [ ] Database backup strategy in place
- [ ] MinIO data backup strategy in place
- [ ] Document backup/restore procedures

### Security
- [ ] `.env` file permissions correct: `chmod 600`
- [ ] No sensitive data in git repository
- [ ] Firewall rules configured (if applicable)
- [ ] SELinux configured (if enabled)
- [ ] System updates: `sudo dnf update -y`

## Troubleshooting Commands

If something goes wrong, use these commands:

```bash
# Check Tailscale
tailscale status
tailscale ip -4

# Check Cloudflared
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -f

# Check Podman containers
cd /opt/fibeger
podman-compose ps
podman-compose logs -f

# Restart services
podman-compose restart app
podman-compose restart caddy

# Full restart
podman-compose down
podman-compose up -d

# Check local Caddy
curl -H "Host: fibeger.com" http://127.0.0.1:8080

# Test Tailscale SSH
tailscale ssh deploy@YOUR_TAILSCALE_IP

# Manual image pull
export IMAGE_REF=$(grep IMAGE_REF .env | cut -d= -f2)
echo $GHCR_PAT | podman login ghcr.io -u YOUR_USERNAME --password-stdin
podman pull $IMAGE_REF
```

## Quick Reference

### Important Paths
- Deployment directory: `/opt/fibeger`
- Environment file: `/opt/fibeger/.env`
- Compose file: `/opt/fibeger/docker-compose.yml`
- Caddyfile: `/opt/fibeger/Caddyfile`
- Cloudflared config: `/etc/cloudflared/config.yml`

### Important Commands
```bash
# View logs
podman-compose logs -f [service]

# Restart service
podman-compose restart [service]

# Full restart
podman-compose down && podman-compose up -d

# Check status
podman-compose ps

# Pull new images
podman-compose pull

# Clean up
podman image prune -a
```

### Important URLs
- GitHub Actions: https://github.com/YOUR_USERNAME/Fibeger/actions
- Main app: https://fibeger.com
- MinIO console: https://minio.fibeger.com
- Tailscale admin: https://login.tailscale.com/admin
- Cloudflare dashboard: https://dash.cloudflare.com

## Status Indicators

### All Systems Operational
✅ GitHub Actions: Last run successful
✅ Tailscale: Connected (green dot in admin panel)
✅ Cloudflared: `systemctl status cloudflared` shows "active (running)"
✅ Podman containers: All show "Up" in `podman-compose ps`
✅ Website: https://fibeger.com loads without errors
✅ MinIO: Console accessible, files uploading correctly

### Common Issues
❌ GitHub Actions fails → Check secrets, Tailscale connection
❌ Can't SSH via Tailscale → Check Tailscale status, ACLs
❌ Website not loading → Check cloudflared, Caddy, DNS records
❌ App container crashing → Check logs, environment variables, database connection
❌ Files not uploading → Check MinIO, S3 configuration in app

---

## Done! 🎉

Once all checkboxes are complete, your deployment is fully operational.

For detailed troubleshooting, see `DEPLOYMENT_GUIDE.md`.
