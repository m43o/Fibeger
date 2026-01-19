Deployment to Fedora (podman)

- On the Fedora host install podman and podman-compose.
- Copy `docker-compose.yml` to the server (e.g. `/opt/fibeger/docker-compose.yml`).
- Create an `.env` file in the same directory with production values (see `.env.example`).

Quick start (on server):

```bash
# create folder
sudo mkdir -p /opt/fibeger
sudo chown $USER /opt/fibeger
# copy compose and env
# then run
podman-compose -f /opt/fibeger/docker-compose.yml up -d
```

CI/CD (GitHub Actions):
- Set secrets: `GHCR_PAT`, `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY` (private key), optionally `SERVER_SSH_PORT` and `REMOTE_COMPOSE_DIR`.
- The workflow will build and push an image to GHCR and SSH to the server to pull and restart the stack.

Notes:
- The app uses S3-compatible storage. When `S3_ENDPOINT` and `S3_BUCKET` are configured, uploads go to that storage (MinIO).
- Prisma migrations are run at container start via the entrypoint script (`npx prisma migrate deploy`). Ensure `DATABASE_URL` is reachable from the container.
