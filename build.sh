#!/usr/bin/env bash
# Build script for Render deployment

set -e  # Exit on error

echo "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt
echo "Installed versions:"
pip show fastapi starlette | grep -E "^(Name|Version):"

echo "Running database migrations/seed..."
python seed.py

echo "Build complete!"
