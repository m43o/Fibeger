# MinIO Troubleshooting Guide

This guide helps you diagnose and fix common MinIO upload issues in Fibeger.

## Quick Fix for Most Issues

If you can access MinIO console but uploads fail, run these commands on your server:

```bash
# Replace $ADMIN_USER and $ADMIN_PASSWORD with your actual credentials from /opt/fibeger/.env
podman exec fibeger_minio_1 mc alias set myminio http://localhost:9000 $ADMIN_USER $ADMIN_PASSWORD
podman exec fibeger_minio_1 mc mb --ignore-existing myminio/fibeger
podman exec fibeger_minio_1 mc anonymous set public myminio/fibeger
```

This creates the bucket and sets public read access. Then try uploading again.

---

## Common Issue: Upload Fails with 500 Error

### Symptoms
- MinIO console accessible at `https://minio.fibeger.com`
- File uploads in the app fail with "Failed to upload file" error
- Browser console shows: `POST https://fibeger.com/api/upload 500 (Internal Server Error)`

### Root Causes & Solutions

#### 1. Bucket Doesn't Exist

**Check:**
- Login to MinIO console at `https://minio.fibeger.com`
- Look for a bucket named `fibeger`

**Fix:**
Run the setup script on your server:
```bash
cd /opt/fibeger
chmod +x scripts/setup-minio.sh
./scripts/setup-minio.sh
```

**Or manually via MinIO Console:**
1. Go to `https://minio.fibeger.com`
2. Click "Buckets" → "Create Bucket"
3. Name it: `fibeger`
4. Click "Create Bucket"

#### 2. Bucket Policy Not Set (Files Not Publicly Readable)

**Check:**
- In MinIO console, click on the `fibeger` bucket
- Go to "Access" or "Summary" tab
- Check if "Access Policy" shows "Public" or "Custom"

**Fix via MinIO Console:**
1. Click on the `fibeger` bucket
2. Go to "Access" tab
3. Click "Add Access Rule" or "Edit Policy"
4. Add this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": ["*"]
      },
      "Action": [
        "s3:GetObject"
      ],
      "Resource": [
        "arn:aws:s3:::fibeger/*"
      ]
    }
  ]
}
```

**Or use MinIO Client (mc):**
```bash
# First, configure the mc alias (replace $ADMIN_USER and $ADMIN_PASSWORD with your values)
podman exec -it fibeger_minio_1 mc alias set myminio http://localhost:9000 $ADMIN_USER $ADMIN_PASSWORD

# Then set public policy
podman exec -it fibeger_minio_1 mc anonymous set public myminio/fibeger

# Verify
podman exec -it fibeger_minio_1 mc anonymous get myminio/fibeger
```

#### 3. Wrong Credentials

**Check environment variables in Docker/Podman:**
```bash
cd /opt/fibeger
podman exec fibeger_app_1 env | grep S3
# Or if using docker-compose:
# docker compose exec app env | grep S3
```

Should show:
- `S3_ENDPOINT=http://minio:9000`
- `S3_PUBLIC_URL=https://fibeger.com/minio`
- `S3_BUCKET=fibeger`
- `S3_ACCESS_KEY_ID=<your admin user>`
- `S3_SECRET_ACCESS_KEY=<your admin password>`
- `S3_USE_TLS=false`

**Fix:**
Ensure your `/opt/fibeger/.env` file has the correct `ADMIN_USER` and `ADMIN_PASSWORD`, then restart:
```bash
cd /opt/fibeger
podman restart fibeger_app_1 fibeger_minio_1
# Or if using docker-compose:
# docker compose down && docker compose up -d
```

#### 4. MinIO Not Accessible from App Container

**Check connectivity:**
```bash
podman exec fibeger_app_1 curl -v http://minio:9000/minio/health/live
# Or: docker compose exec app curl -v http://minio:9000/minio/health/live
```

Should return HTTP 200 OK.

**Fix:**
If it fails, check that MinIO is running:
```bash
podman ps
podman logs fibeger_minio_1
# Or: docker compose ps && docker compose logs minio
```

Restart if needed:
```bash
podman restart fibeger_minio_1 fibeger_app_1
# Or: docker compose restart minio app
```

## Viewing Logs

### App Logs (for upload errors)
```bash
podman logs fibeger_app_1 -f --tail=50
# Or: docker compose logs app -f --tail=50
```

Look for lines like:
- `File upload error:`
- `S3 upload error details:`

### MinIO Logs
```bash
podman logs fibeger_minio_1 -f --tail=50
# Or: docker compose logs minio -f --tail=50
```

Look for:
- Authentication failures
- Bucket access errors
- Network errors

## Testing Upload Manually

### Using curl from inside app container
```bash
# Get into app container
podman exec -it fibeger_app_1 sh
# Or: docker compose exec app sh

# Once inside, try to reach MinIO
curl -v http://minio:9000/minio/health/live
```

### Using MinIO Client (mc)
```bash
# Configure mc alias inside the running MinIO container
podman exec fibeger_minio_1 mc alias set myminio http://localhost:9000 $ADMIN_USER $ADMIN_PASSWORD

# Test upload
podman exec fibeger_minio_1 sh -c 'echo "test" > /tmp/test.txt && mc cp /tmp/test.txt myminio/fibeger/test.txt'

# Verify file was uploaded
podman exec fibeger_minio_1 mc ls myminio/fibeger/

# Test public access (should work if policy is correct)
curl -I https://fibeger.com/minio/fibeger/test.txt
```

## Environment Configuration Reference

### In docker-compose.yml (app service)
```yaml
S3_ENDPOINT: http://minio:9000          # Internal Docker network address
S3_PUBLIC_URL: https://fibeger.com/minio # Public URL for browser access
S3_BUCKET: fibeger                       # Bucket name
S3_ACCESS_KEY_ID: ${ADMIN_USER}         # From .env file
S3_SECRET_ACCESS_KEY: ${ADMIN_PASSWORD} # From .env file
S3_USE_TLS: "false"                      # No TLS for internal connection
```

### In Caddyfile
```caddy
# MinIO S3 API under /minio on apex
@minioAPI path /minio*
handle @minioAPI {
    uri strip_prefix /minio
    reverse_proxy minio:9000
}
```

This routes `https://fibeger.com/minio/*` → `http://minio:9000/*`

## Quick Fix Checklist

Run through this checklist to fix most issues:

- [ ] MinIO service is running: `podman ps` or `docker compose ps`
- [ ] Bucket `fibeger` exists: `podman exec fibeger_minio_1 mc alias set myminio http://localhost:9000 $ADMIN_USER $ADMIN_PASSWORD && podman exec fibeger_minio_1 mc ls myminio/`
- [ ] Bucket has public read policy set: `podman exec fibeger_minio_1 mc anonymous get myminio/fibeger`
- [ ] Environment variables are correct in app container: `podman exec fibeger_app_1 env | grep S3`
- [ ] App can reach MinIO: `podman exec fibeger_app_1 curl http://minio:9000/minio/health/live`
- [ ] Check app logs: `podman logs fibeger_app_1 --tail=50`
- [ ] Check MinIO logs: `podman logs fibeger_minio_1 --tail=50`
- [ ] Restart services: `podman restart fibeger_minio_1 fibeger_app_1`

## Still Not Working?

1. **Check Docker/Podman network:**
   ```bash
   podman network inspect fibeger_fib-net
   # Or: docker network inspect fibeger_fib-net
   ```
   Both `app` and `minio` containers should be listed.

2. **Verify Caddy routing:**
   ```bash
   podman logs fibeger_caddy_1 --tail=50
   # Or: docker compose logs caddy --tail=50
   ```
   Look for requests to `/minio/*`

3. **Test from browser:**
   - Upload a file manually via MinIO console
   - Try to access it at: `https://fibeger.com/minio/fibeger/<filename>`
   - If this works, the issue is in the app code; if not, check Caddy/networking

4. **Check browser console:**
   - Open DevTools → Network tab
   - Try uploading again
   - Check the response body of the failed `/api/upload` request

5. **Enable debug logging:**
   Add to app environment in docker-compose.yml:
   ```yaml
   DEBUG: "*"
   ```
   Restart and check logs again:
   ```bash
   podman restart fibeger_app_1
   podman logs fibeger_app_1 -f
   ```
