#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "==> Installing Python backend dependencies..."
pip install --upgrade pip
pip install -r backend/requirements.txt

echo "==> Building React frontend..."
cd frontend
npm install
npm run build
cd ..

echo "==> Build complete! Both backend and frontend are ready."

