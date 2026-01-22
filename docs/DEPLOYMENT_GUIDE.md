# Deployment Guide: Fedora + Podman + Tailscale + Cloudflare Tunnel

This guide covers deploying Fibeger to a Fedora server using Podman, with GitHub Actions CI/CD via Tailscale SSH, and public exposure via Cloudflare Tunnel.

## Architecture Overview

```
GitHub Actions (CI/CD)
    ↓ (Tailscale SSH)
Fedora Server (Podman)
    ↓ (localhost:8080)
Cloudflare Tunnel
    ↓ (HTTPS)
Public Internet
```

## Prerequisites

- Fedora server with Podman installed
- GitHub repository with Actions enabled
- Tailscale account
- Cloudflare account with domain configured

---

## Step 1: Configure GitHub Secrets

Go to your repository **Settings → Secrets and variables → Actions** and add:

### `GHCR_PAT` (GitHub Container Registry Personal Access Token)
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `write:packages`, `read:packages`, `delete:packages`
4. Copy the token and add it as `GHCR_PAT`

### `TAILSCALE_ID` and `TAILSCALE_SECRET` (OAuth Client)
1. Go to https://login.tailscale.com/admin/settings/oauth
2. Click "Generate OAuth client"
3. Add tag: `tag:ci` (create tag in ACL if needed)
4. Copy Client ID → `TAILSCALE_ID`
5. Copy Client Secret → `TAILSCALE_SECRET`

---

## Step 2: Tailscale Configuration

### On Your Fedora Server

```bash
# Install Tailscale
sudo dnf install -y tailscale

# Enable and start
sudo systemctl enable --now tailscaled

# Connect to your tailnet
sudo tailscale up

# Get your Tailscale IP
tailscale ip -4
# Example output: 100.119.236.64
```

### Update Workflow with Your Tailscale IP

Edit `.github/workflows/ci-deploy.yml` line 56:

```yaml
SERVER_TS_HOST: 100.119.236.64  # Replace with your actual Tailscale IP
```

### Configure Tailscale ACL (Optional but Recommended)

Add to your Tailscale ACL (https://login.tailscale.com/admin/acls):

```json
{
  "tagOwners": {
    "tag:ci": ["autogroup:admin"]
  },
  "acls": [
    {
      "action": "accept",
      "src": ["tag:ci"],
      "dst": ["tag:server:22"]
    }
  ]
}
```

Tag your server: `sudo tailscale up --advertise-tags=tag:server`

### Test Tailscale SSH

From your local machine (or any Tailscale-connected device):

```bash
tailscale ssh deploy@100.119.236.64
```

If this works, GitHub Actions will be able to deploy!

---

## Step 3: Fedora Server Setup

### Install Required Packages

```bash
# Install podman-compose
sudo dnf install -y podman-compose git

# Install cloudflared (for Cloudflare Tunnel)
sudo dnf install -y cloudflared
```

### Create Deployment Directory

```bash
# Create directory
sudo mkdir -p /opt/fibeger
sudo chown -R $USER:$USER /opt/fibeger

# Clone repository (or copy files)
cd /opt/fibeger
git clone https://github.com/YOUR_USERNAME/Fibeger.git .
# OR copy docker-compose.yml and Caddyfile manually
```

### Create Environment File

Create `/opt/fibeger/.env`:

```bash
# Admin credentials (used for DB, MinIO, pgAdmin)
ADMIN_USER=admin
ADMIN_PASSWORD=CHANGE_THIS_SECURE_PASSWORD

# NextAuth secret (generate with: openssl rand -base64 32)
NEXTAUTH_SECRET=CHANGE_THIS_TO_RANDOM_64_CHAR_STRING

# Image reference (will be updated by CI/CD automatically)
IMAGE_REF=ghcr.io/yourusername/fibeger:latest
```

**Generate a secure NextAuth secret:**

```bash
openssl rand -base64 32
```

### Set Proper Permissions

```bash
chmod 600 /opt/fibeger/.env
```

### Enable Podman Socket (Optional, for compatibility)

```bash
# Enable user podman socket
systemctl --user enable --now podman.socket

# Enable rootless podman
echo "export DOCKER_HOST=unix:///run/user/$(id -u)/podman/podman.sock" >> ~/.bashrc
```

---

## Step 4: Cloudflare Tunnel Setup

### Authenticate with Cloudflare

```bash
# This will open a browser for authentication
cloudflared tunnel login
```

### Create Tunnel

```bash
# Create a tunnel named "fibeger"
cloudflared tunnel create fibeger

# Note the Tunnel ID from the output
# Example: Created tunnel fibeger with id a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

### Create Tunnel Configuration

Create `/etc/cloudflared/config.yml` (requires sudo):

```bash
sudo mkdir -p /etc/cloudflared
sudo nano /etc/cloudflared/config.yml
```

Content:

```yaml
tunnel: YOUR_TUNNEL_ID_HERE
credentials-file: /home/YOUR_USERNAME/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  # Main app
  - hostname: fibeger.com
    service: http://127.0.0.1:8080
    originRequest:
      noTLSVerify: true
  
  # MinIO console subdomain
  - hostname: minio.fibeger.com
    service: http://127.0.0.1:8080
    originRequest:
      noTLSVerify: true
  
  # Catch-all
  - service: http_status:404
```

**Replace:**
- `YOUR_TUNNEL_ID_HERE` with your actual tunnel ID
- `YOUR_USERNAME` with your server username
- `fibeger.com` with your actual domain

### Create DNS Records

```bash
# Point your domains to the tunnel
cloudflared tunnel route dns fibeger fibeger.com
cloudflared tunnel route dns fibeger minio.fibeger.com

# Add wildcard if needed
cloudflared tunnel route dns fibeger "*.fibeger.com"
```

### Install Cloudflared as a System Service

```bash
# Install the service
sudo cloudflared service install

# Enable and start
sudo systemctl enable --now cloudflared

# Check status
sudo systemctl status cloudflared

# View logs
sudo journalctl -u cloudflared -f
```

---

## Step 5: Initial Deployment (Manual First Run)

Before GitHub Actions can deploy, do an initial manual setup:

```bash
cd /opt/fibeger

# Update IMAGE_REF in .env to a valid image (or use the latest from GHCR)
# The first build will be done by GitHub Actions

# Start the stack (this will use the default image)
podman-compose pull
podman-compose up -d

# Check status
podman-compose ps

# View logs
podman-compose logs -f
```

### Initialize MinIO

```bash
# Access MinIO console at https://minio.fibeger.com (via Cloudflare Tunnel)
# Login with ADMIN_USER and ADMIN_PASSWORD from .env

# Create bucket named "fibeger"
# Set bucket to public read (or configure policies as needed)
```

---

## Step 6: Deploy via GitHub Actions

Now push to the `main` branch:

```bash
git add .
git commit -m "Configure deployment"
git push origin main
```

GitHub Actions will:
1. Build Docker image
2. Push to GHCR
3. Connect to your server via Tailscale SSH
4. Pull the new image
5. Update the stack with `podman-compose up -d`

### Monitor Deployment

- **GitHub Actions:** https://github.com/YOUR_USERNAME/Fibeger/actions
- **Server logs:** `podman-compose logs -f`
- **Cloudflare Tunnel:** `sudo journalctl -u cloudflared -f`

---

## Step 7: Verify Deployment

### Check All Services

```bash
cd /opt/fibeger

# Check container status
podman-compose ps

# Should show all services running:
# - db (postgres)
# - minio
# - pgadmin
# - app (your Next.js app)
# - caddy
```

### Test Endpoints

```bash
# Test local Caddy
curl -H "Host: fibeger.com" http://127.0.0.1:8080

# Test via Cloudflare Tunnel
curl https://fibeger.com

# Test MinIO
curl https://minio.fibeger.com
```

### Access Your App

- **Main app:** https://fibeger.com
- **MinIO Console:** https://minio.fibeger.com
- **MinIO S3 API:** https://fibeger.com/minio

---

## Troubleshooting

### GitHub Actions Can't Connect via Tailscale

```bash
# On server, check Tailscale status
tailscale status

# Test SSH manually
tailscale ssh deploy@YOUR_TAILSCALE_IP

# Check Tailscale logs
sudo journalctl -u tailscaled -f
```

### Containers Not Starting

```bash
# Check logs for specific service
podman-compose logs db
podman-compose logs app

# Restart a service
podman-compose restart app

# Rebuild and restart
podman-compose up -d --force-recreate
```

### Cloudflare Tunnel Not Working

```bash
# Check cloudflared status
sudo systemctl status cloudflared

# Check logs
sudo journalctl -u cloudflared -f

# Restart tunnel
sudo systemctl restart cloudflared

# Test local endpoint
curl -H "Host: fibeger.com" http://127.0.0.1:8080
```

### Database Migration Issues

```bash
# Connect to app container
podman exec -it fibeger_app_1 bash

# Run Prisma migrations
npx prisma migrate deploy

# Or push schema (for development)
npx prisma db push
```

### Permission Issues

```bash
# Fix permissions on deployment directory
sudo chown -R $USER:$USER /opt/fibeger

# Fix .env permissions
chmod 600 /opt/fibeger/.env

# Check SELinux (if enabled)
sudo setenforce 0  # Temporarily disable for testing
sudo getenforce    # Check status
```

---

## Maintenance

### View Logs

```bash
# All services
podman-compose logs -f

# Specific service
podman-compose logs -f app

# Last 100 lines
podman-compose logs --tail=100 app
```

### Update Manually

```bash
cd /opt/fibeger

# Pull latest image
export IMAGE_REF=$(grep IMAGE_REF .env | cut -d= -f2)
podman pull $IMAGE_REF

# Restart with new image
podman-compose up -d
```

### Backup Database

```bash
# Backup
podman exec fibeger_db_1 pg_dump -U admin fibeger > backup.sql

# Restore
podman exec -i fibeger_db_1 psql -U admin fibeger < backup.sql
```

### Clean Up Old Images

```bash
# Remove unused images
podman image prune -a

# Remove old containers
podman container prune
```

---

## Security Considerations

1. **Never expose Podman ports directly** - Always use Caddy + Cloudflare Tunnel
2. **Use strong passwords** - Generate with `openssl rand -base64 32`
3. **Keep .env secure** - `chmod 600 /opt/fibeger/.env`
4. **Enable Tailscale ACLs** - Restrict CI access to specific ports
5. **Enable SELinux** - Configure proper contexts for Podman
6. **Regular updates** - Keep Fedora, Podman, and Cloudflared updated

```bash
# Update system
sudo dnf update -y

# Update Cloudflared
sudo dnf update cloudflared
```

---

## Performance Tuning

### Podman Performance

```bash
# Increase container limits
sudo nano /etc/containers/containers.conf

# Add:
[engine]
events_logger = "file"
cgroup_manager = "systemd"
```

### Caddy Performance

Already configured with `zstd gzip` compression in Caddyfile.

### Database Performance

Edit `docker-compose.yml` to add PostgreSQL tuning:

```yaml
db:
  command: postgres -c shared_buffers=256MB -c max_connections=200
```

---

## Next Steps

1. **Set up monitoring** - Consider Prometheus + Grafana
2. **Configure backups** - Automate DB and MinIO backups
3. **Add staging environment** - Create a separate stack for testing
4. **SSL monitoring** - Cloudflare handles this, but monitor certificate validity
5. **Log aggregation** - Consider Loki or similar for centralized logs

---

## Resources

- **Tailscale SSH:** https://tailscale.com/kb/1193/tailscale-ssh
- **Cloudflare Tunnel:** https://developers.cloudflare.com/cloudflare-one/connections/connect-apps
- **Podman Compose:** https://github.com/containers/podman-compose
- **GitHub Actions:** https://docs.github.com/en/actions

---

## Support

If you encounter issues:

1. Check service logs: `podman-compose logs -f`
2. Check Cloudflare Tunnel: `sudo journalctl -u cloudflared -f`
3. Check Tailscale: `tailscale status`
4. Check GitHub Actions: Repository → Actions tab
