# Deployment Scripts

This directory contains helper scripts and configuration templates for deploying Fibeger.

## Files

### `setup-fedora-server.sh`
Automated setup script for preparing a Fedora server for Fibeger deployment.

**What it does:**
- Installs required packages (podman, podman-compose, git, cloudflared, tailscale)
- Creates deployment directory at `/opt/fibeger`
- Generates `.env` file with secure random passwords
- Configures rootless Podman
- Provides Tailscale IP for CI/CD configuration
- Gives you next steps

**Usage:**
```bash
# Copy to your Fedora server
scp setup-fedora-server.sh user@your-server:~/

# SSH into server
ssh user@your-server

# Run the script
chmod +x setup-fedora-server.sh
./setup-fedora-server.sh
```

**Important:** Save the generated passwords shown during setup!

---

### `setup-minio.sh`
Script to initialize MinIO bucket and set proper permissions for file uploads.

**What it does:**
- Creates the `fibeger` bucket in MinIO
- Sets public read policy on the bucket (required for serving uploaded files)
- Uses the MinIO client (mc) via Docker

**Usage:**
```bash
# SSH into your server
ssh user@your-server

# Navigate to the project directory
cd /opt/fibeger

# Run the setup script
chmod +x scripts/setup-minio.sh
./scripts/setup-minio.sh
```

**When to use:**
- After initial deployment when file uploads fail with 500 errors
- If you need to recreate the bucket
- When setting up a new MinIO instance

**Note:** This script reads credentials from `/opt/fibeger/.env`

---

### `cloudflared-config.example.yml`
Template configuration file for Cloudflare Tunnel.

**What it does:**
- Provides a ready-to-use Cloudflare Tunnel configuration
- Routes `fibeger.com` and `minio.fibeger.com` to local Caddy
- Includes performance tuning and optional monitoring

**Usage:**
```bash
# 1. Create tunnel first
cloudflared tunnel login
cloudflared tunnel create fibeger
# Note the tunnel ID

# 2. Copy template
sudo cp cloudflared-config.example.yml /etc/cloudflared/config.yml

# 3. Edit with your values
sudo nano /etc/cloudflared/config.yml
# Replace YOUR_TUNNEL_ID and YOUR_USERNAME

# 4. Create DNS records
cloudflared tunnel route dns fibeger fibeger.com
cloudflared tunnel route dns fibeger minio.fibeger.com

# 5. Install and start service
sudo cloudflared service install
sudo systemctl enable --now cloudflared

# 6. Check status
sudo systemctl status cloudflared
sudo journalctl -u cloudflared -f
```

---

### `use-production-schema.js`
Switches Prisma schema to production configuration.

**Usage:**
```bash
node scripts/use-production-schema.js
```

This is used by the Docker build process and typically doesn't need to be run manually.

---

## Quick Start

For a complete deployment, follow this order:

### 1. Local Preparation (Your Dev Machine)
```bash
# Ensure all files are committed
git add .
git commit -m "Prepare for deployment"

# Configure GitHub Secrets (via GitHub website):
# - GHCR_PAT
# - TAILSCALE_ID
# - TAILSCALE_SECRET
```

### 2. Server Setup (Fedora Server)
```bash
# Copy and run setup script
scp scripts/setup-fedora-server.sh user@your-server:~/
ssh user@your-server
chmod +x setup-fedora-server.sh
./setup-fedora-server.sh

# Save the generated passwords!
```

### 3. Cloudflare Tunnel (Fedora Server)
```bash
# Copy and configure Cloudflare Tunnel
scp scripts/cloudflared-config.example.yml user@your-server:~/
ssh user@your-server

cloudflared tunnel login
cloudflared tunnel create fibeger
# Note the tunnel ID

sudo cp cloudflared-config.example.yml /etc/cloudflared/config.yml
sudo nano /etc/cloudflared/config.yml
# Replace YOUR_TUNNEL_ID and YOUR_USERNAME

cloudflared tunnel route dns fibeger fibeger.com
cloudflared tunnel route dns fibeger minio.fibeger.com

sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

### 4. Copy Application Files (Fedora Server)
```bash
ssh user@your-server
cd /opt/fibeger

# Option A: Clone from GitHub
git clone https://github.com/YOUR_USERNAME/Fibeger.git .

# Option B: Copy files manually
scp docker-compose.yml user@your-server:/opt/fibeger/
scp Caddyfile user@your-server:/opt/fibeger/
```

### 5. Update Configuration (Local)
```bash
# Update Tailscale IP in workflow
# Get IP from server: tailscale ip -4
# Edit .github/workflows/ci-deploy.yml line 56

# Update IMAGE_REF in server's .env
# Edit /opt/fibeger/.env on server
# Replace: IMAGE_REF=ghcr.io/YOUR_GITHUB_USERNAME/fibeger:latest
```

### 6. Deploy (Local)
```bash
# Push to trigger deployment
git push origin main

# Monitor GitHub Actions
# Go to: https://github.com/YOUR_USERNAME/Fibeger/actions
```

### 7. Verify (Fedora Server)
```bash
ssh user@your-server
cd /opt/fibeger

# Check containers
podman-compose ps

# Check logs
podman-compose logs -f

# Test locally
curl -H "Host: fibeger.com" http://127.0.0.1:8080

# Test via Cloudflare
curl https://fibeger.com
```

---

## Troubleshooting

### Setup Script Fails

```bash
# Check logs
./setup-fedora-server.sh 2>&1 | tee setup.log

# Manually install a package
sudo dnf install -y <package-name>
```

### Cloudflare Tunnel Issues

```bash
# Check status
sudo systemctl status cloudflared

# View logs
sudo journalctl -u cloudflared -f

# Test configuration
cloudflared tunnel --config /etc/cloudflared/config.yml run

# Restart service
sudo systemctl restart cloudflared
```

### Podman Compose Issues

```bash
# Test podman-compose
podman-compose version

# If not found, try installing from pip
pip3 install --user podman-compose

# Or use podman kube instead
podman generate kube > fibeger.yaml
podman play kube fibeger.yaml
```

### Permission Issues

```bash
# Fix deployment directory ownership
sudo chown -R $USER:$USER /opt/fibeger

# Fix .env permissions
chmod 600 /opt/fibeger/.env

# Enable lingering for rootless podman
loginctl enable-linger $USER
```

---

## Additional Resources

- **Deployment Guide:** `../docs/DEPLOYMENT_GUIDE.md`
- **Deployment Checklist:** `../docs/DEPLOYMENT_CHECKLIST.md`
- **Tailscale SSH Docs:** https://tailscale.com/kb/1193/tailscale-ssh
- **Cloudflare Tunnel Docs:** https://developers.cloudflare.com/cloudflare-one/connections/connect-apps
- **Podman Compose:** https://github.com/containers/podman-compose

---

## Support

If you encounter issues:

1. Check the logs:
   - GitHub Actions: Repository → Actions tab
   - Cloudflared: `sudo journalctl -u cloudflared -f`
   - Podman: `podman-compose logs -f`
   - Tailscale: `tailscale status`

2. Verify connectivity:
   - Tailscale: `tailscale ping YOUR_SERVER`
   - Cloudflare: Check Cloudflare dashboard
   - Local: `curl http://127.0.0.1:8080`

3. Review configuration:
   - GitHub Secrets: Ensure all are set correctly
   - Tailscale IP: Must match in workflow
   - Cloudflare config: Check tunnel ID and paths
   - .env file: Verify all variables are set

4. Consult documentation:
   - `DEPLOYMENT_GUIDE.md` for detailed instructions
   - `DEPLOYMENT_CHECKLIST.md` for step-by-step verification
