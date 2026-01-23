#!/bin/bash
# Setup MinIO bucket and policy for Fibeger
# Run this script on your server after deploying

set -e

echo "Setting up MinIO for Fibeger..."

# Get environment variables from .env
if [ -f /opt/fibeger/.env ]; then
    source /opt/fibeger/.env
else
    echo "Error: /opt/fibeger/.env not found"
    exit 1
fi

# Configure mc and set up bucket using the running MinIO container
echo "Configuring MinIO client..."
podman exec fibeger_minio_1 mc alias set myminio http://localhost:9000 "${ADMIN_USER}" "${ADMIN_PASSWORD}"

echo "Creating bucket: fibeger"
podman exec fibeger_minio_1 mc mb --ignore-existing myminio/fibeger

echo "Setting public read policy on bucket..."
podman exec fibeger_minio_1 mc anonymous set public myminio/fibeger

echo "Verifying bucket policy..."
podman exec fibeger_minio_1 mc anonymous get myminio/fibeger

echo ""
echo "✓ MinIO setup complete!"
echo ""
echo "Bucket: fibeger"
echo "Status: Public read access enabled"
echo ""
echo "MinIO is now configured and ready to use!"
