#!/usr/bin/env bash
# Build script for Render deployment

set -e  # Exit on error

echo "Installing dependencies..."
pip install -r requirements.txt

echo "Running database migrations/seed..."
python seed.py

echo "Build complete!"
