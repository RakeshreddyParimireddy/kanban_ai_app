#!/usr/bin/env sh
set -e
cd "$(dirname "$0")/.."
docker build -t pm-app .
docker rm -f pm-app >/dev/null 2>&1 || true
ENV_FILE=""
[ -f .env ] && ENV_FILE="--env-file .env"
docker run -d --name pm-app -p 8000:8000 $ENV_FILE -v "$(pwd)/backend/data:/app/data" pm-app
echo "Running at http://localhost:8000"
