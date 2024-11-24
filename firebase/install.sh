#!/bin/bash
set -e

# Check for project ID argument
if [ -z "$1" ]; then
    echo "Please provide your Firebase project ID"
    echo "Usage: ./deploy.sh <project-id>"
    exit 1
fi

PROJECT_ID=$1

# Install Firebase CLI if needed
if ! command -v firebase &> /dev/null; then
    npm install -g firebase-tools
fi

# Ensure we're logged in
firebase login --no-localhost

# Initialize Firebase with all options preset
firebase init \
  --project=$PROJECT_ID \
  --hosting \
  --firestore \
  --functions \
  --non-interactive

# Install function dependencies
cd functions
npm install
cd ..

# Deploy everything
firebase deploy