# GitHub Configuration for CI/CD

This guide covers setting up GitHub for automated deployment to your Fedora server.

## Overview

The CI/CD pipeline uses:
- **GitHub Actions** for automation
- **GitHub Container Registry (GHCR)** for Docker images
- **Tailscale** for secure SSH access to your server
- **GitHub Secrets** for sensitive credentials

---

## Step 1: Create GitHub Personal Access Token (PAT)

This token allows GitHub Actions to push Docker images to GHCR.

### Instructions:

1. Go to **GitHub Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
   - Direct link: https://github.com/settings/tokens

2. Click **"Generate new token"** → **"Generate new token (classic)"**

3. Configure the token:
   - **Note:** `GHCR Access for Fibeger`
   - **Expiration:** Choose expiration (recommend 90 days or 1 year)
   - **Scopes:** Select these permissions:
     - ✅ `write:packages` (Upload packages to GitHub Package Registry)
     - ✅ `read:packages` (Download packages from GitHub Package Registry)
     - ✅ `delete:packages` (Delete packages from GitHub Package Registry)

4. Click **"Generate token"**

5. **IMPORTANT:** Copy the token immediately (you won't be able to see it again!)

6. Save this token as `GHCR_PAT` in your repository secrets (see Step 3 below)

---

## Step 2: Create Tailscale OAuth Credentials

These credentials allow GitHub Actions to connect to your Tailscale network.

### Instructions:

1. Go to **Tailscale Admin Console** → **Settings** → **OAuth clients**
   - Direct link: https://login.tailscale.com/admin/settings/oauth

2. Click **"Generate OAuth client"**

3. Configure the OAuth client:
   - **Description:** `GitHub Actions CI/CD`
   - **Tags:** `tag:ci` (you may need to create this tag first)

4. Click **"Generate client"**

5. **IMPORTANT:** Copy both values:
   - **Client ID** → Save as `TAILSCALE_ID`
   - **Client Secret** → Save as `TAILSCALE_SECRET`

### Create the `tag:ci` Tag (if needed)

If the `tag:ci` tag doesn't exist, add it to your Tailscale ACL:

1. Go to **Tailscale Admin Console** → **Access Controls**
   - Direct link: https://login.tailscale.com/admin/acls

2. Add this to your ACL configuration:

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

3. Click **"Save"**

### Tag Your Server (Optional but Recommended)

On your Fedora server, tag it so the ACL rule applies:

```bash
sudo tailscale up --advertise-tags=tag:server
```

---

## Step 3: Add Secrets to GitHub Repository

Now add all three secrets to your GitHub repository.

### Instructions:

1. Go to your repository on GitHub

2. Navigate to **Settings** → **Secrets and variables** → **Actions**
   - Direct link: `https://github.com/YOUR_USERNAME/Fibeger/settings/secrets/actions`

3. Click **"New repository secret"** for each of the following:

#### Secret 1: `GHCR_PAT`
- **Name:** `GHCR_PAT`
- **Value:** The GitHub Personal Access Token from Step 1
- Click **"Add secret"**

#### Secret 2: `TAILSCALE_ID`
- **Name:** `TAILSCALE_ID`
- **Value:** The OAuth Client ID from Step 2
- Click **"Add secret"**

#### Secret 3: `TAILSCALE_SECRET`
- **Name:** `TAILSCALE_SECRET`
- **Value:** The OAuth Client Secret from Step 2
- Click **"Add secret"**

### Verify Secrets

You should now see three secrets listed:
- ✅ `GHCR_PAT`
- ✅ `TAILSCALE_ID`
- ✅ `TAILSCALE_SECRET`

---

## Step 4: Enable GitHub Actions

Ensure GitHub Actions is enabled for your repository.

### Instructions:

1. Go to **Settings** → **Actions** → **General**

2. Under **"Actions permissions"**, select:
   - ✅ **"Allow all actions and reusable workflows"**

3. Under **"Workflow permissions"**, select:
   - ✅ **"Read and write permissions"**

4. Click **"Save"**

---

## Step 5: Update Workflow Configuration

Update the workflow file with your server's Tailscale IP.

### Find Your Server's Tailscale IP:

On your Fedora server:

```bash
tailscale ip -4
```

Example output: `100.119.236.64`

### Update the Workflow:

Edit `.github/workflows/ci-deploy.yml`:

```yaml
env:
  IMAGE_REF: ${{ needs.build-and-push.outputs.image_ref }}
  SERVER_TS_HOST: 100.119.236.64  # ← Replace with your Tailscale IP
  REMOTE_COMPOSE_DIR: /opt/fibeger
```

**Save and commit this change:**

```bash
git add .github/workflows/ci-deploy.yml
git commit -m "Update Tailscale IP for deployment"
git push origin main
```

---

## Step 6: Test the Workflow

Now test that everything is configured correctly.

### Trigger a Deployment:

1. Make a small change to your code (or use an empty commit):

```bash
git commit --allow-empty -m "Test CI/CD deployment"
git push origin main
```

2. Go to **Actions** tab in your GitHub repository
   - Direct link: `https://github.com/YOUR_USERNAME/Fibeger/actions`

3. You should see a new workflow run starting

4. Click on the workflow run to see details

### Workflow Steps:

The workflow will:
1. ✅ **Build and push** - Build Docker image and push to GHCR (~5-10 minutes)
2. ✅ **Deploy** - Connect via Tailscale SSH and deploy to server (~2-3 minutes)

### If Successful:

✅ Both jobs show green checkmarks
✅ Your app is now deployed at `https://fibeger.com`

### If Failed:

Check the logs for errors. Common issues:

❌ **Build fails** → Check Dockerfile, dependencies
❌ **Tailscale connection fails** → Check Tailscale OAuth credentials, ACLs
❌ **Deployment fails** → Check server setup, podman-compose, .env file
❌ **Image pull fails** → Check GHCR_PAT permissions

---

## Step 7: Verify Deployment

After a successful workflow run, verify your deployment.

### Check GitHub Container Registry:

1. Go to your repository on GitHub
2. Click **"Packages"** (right sidebar)
3. You should see `fibeger` package with recent push

### Check Your Server:

SSH into your server:

```bash
ssh user@your-server
cd /opt/fibeger
podman-compose ps
```

You should see all containers running.

### Check Your Website:

Visit your domain:
- https://fibeger.com (main app)
- https://minio.fibeger.com (MinIO console)

---

## Workflow Behavior

### Automatic Deployments

The workflow is configured to run automatically on:
- ✅ **Push to `main` branch**

Every time you push to `main`, it will:
1. Build a new Docker image
2. Tag it with the commit SHA
3. Push to GitHub Container Registry
4. Deploy to your server
5. Update `.env` with new image reference
6. Restart containers with new image

### Manual Deployments

You can also trigger the workflow manually:

1. Go to **Actions** → **Build and Deploy to Podman Server**
2. Click **"Run workflow"**
3. Select branch (usually `main`)
4. Click **"Run workflow"**

---

## Security Best Practices

### Secrets Management

- ✅ Never commit secrets to git
- ✅ Rotate secrets regularly (every 90 days recommended)
- ✅ Use strong, unique passwords
- ✅ Store backups of secrets in a password manager

### Access Control

- ✅ Use Tailscale ACLs to restrict CI access
- ✅ Use ephemeral Tailscale nodes in GitHub Actions (configured)
- ✅ Limit GitHub PAT permissions to only what's needed
- ✅ Use a dedicated `deploy` user on the server (recommended)

### Monitoring

- ✅ Enable GitHub Actions notifications
- ✅ Monitor workflow runs regularly
- ✅ Set up Cloudflare alerts for downtime
- ✅ Check server logs for deployment issues

---

## Troubleshooting

### "GHCR_PAT" Not Found

**Error:** `Error: Input required and not supplied: password`

**Solution:**
1. Verify secret exists: Settings → Secrets and variables → Actions
2. Ensure secret name is exactly `GHCR_PAT` (case-sensitive)
3. Re-create the secret if needed

### Tailscale Connection Fails

**Error:** `Failed to connect to Tailscale network`

**Solution:**
1. Verify `TAILSCALE_ID` and `TAILSCALE_SECRET` are correct
2. Check Tailscale ACL allows `tag:ci` → `tag:server:22`
3. Verify your server is connected: `tailscale status`
4. Test SSH manually: `tailscale ssh deploy@YOUR_SERVER_IP`

### Image Push Fails

**Error:** `denied: permission_denied`

**Solution:**
1. Verify GHCR_PAT has `write:packages` permission
2. Check if package visibility is correct (public recommended)
3. Ensure repository name matches in workflow

### Deployment Script Fails

**Error:** `podman-compose: command not found`

**Solution:**
1. Install podman-compose on server: `sudo dnf install -y podman-compose`
2. Or use the setup script: `scripts/setup-fedora-server.sh`

### Container Fails to Start

**Error:** Container exits immediately after deployment

**Solution:**
1. Check server logs: `podman-compose logs -f app`
2. Verify `.env` file has all required variables
3. Check database connection
4. Verify IMAGE_REF is correct

---

## Advanced Configuration

### Build Matrix

To build for multiple platforms (ARM64, AMD64):

Edit `.github/workflows/ci-deploy.yml`:

```yaml
- name: Build and push image
  uses: docker/build-push-action@v6
  with:
    context: .
    platforms: linux/amd64,linux/arm64
    push: true
    tags: ${{ env.IMAGE_REF }}
```

### Conditional Deployments

To skip deployment on specific commits:

Add to commit message: `[skip deploy]`

Edit workflow:

```yaml
deploy:
  runs-on: ubuntu-latest
  needs: [build-and-push]
  if: "!contains(github.event.head_commit.message, '[skip deploy]')"
```

### Staging Environment

To add a staging environment:

1. Create a `staging` branch
2. Duplicate the workflow for staging
3. Deploy to a different domain or subdomain
4. Use a separate deployment directory

---

## Monitoring and Notifications

### Enable GitHub Actions Email Notifications

1. Go to **GitHub Settings** → **Notifications**
2. Under **"Actions"**, enable:
   - ✅ Email notifications for failed workflows

### Workflow Status Badge

Add to your README.md:

```markdown
![Deploy Status](https://github.com/YOUR_USERNAME/Fibeger/actions/workflows/ci-deploy.yml/badge.svg)
```

### Slack/Discord Notifications (Optional)

Add to workflow:

```yaml
- name: Notify Slack
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "Deployment failed! Check logs at ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
      }
```

---

## Resources

- **GitHub Actions Docs:** https://docs.github.com/en/actions
- **GHCR Docs:** https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- **Tailscale GitHub Action:** https://github.com/tailscale/github-action
- **Tailscale SSH:** https://tailscale.com/kb/1193/tailscale-ssh

---

## Quick Reference

### Secrets Required
```
GHCR_PAT          - GitHub Personal Access Token (write:packages)
TAILSCALE_ID      - Tailscale OAuth Client ID
TAILSCALE_SECRET  - Tailscale OAuth Client Secret
```

### Workflow Variables to Update
```yaml
SERVER_TS_HOST: 100.119.236.64    # Your Tailscale IP
REMOTE_COMPOSE_DIR: /opt/fibeger  # Deployment directory
```

### Test Commands
```bash
# Generate test commit
git commit --allow-empty -m "Test deployment"
git push origin main

# View workflow runs
gh run list
gh run view

# Test Tailscale SSH
tailscale ssh deploy@YOUR_SERVER_IP

# Test GHCR access
echo $GHCR_PAT | docker login ghcr.io -u YOUR_USERNAME --password-stdin
```

---

## Support

If you encounter issues:

1. **Check workflow logs:** Actions tab → Click on failed run
2. **Check server status:** SSH to server and run `podman-compose ps`
3. **Verify secrets:** Settings → Secrets → Ensure all three exist
4. **Test Tailscale:** `tailscale ssh` should work from local machine
5. **Consult docs:** 
   - `DEPLOYMENT_GUIDE.md` - Complete deployment guide
   - `DEPLOYMENT_CHECKLIST.md` - Step-by-step checklist
