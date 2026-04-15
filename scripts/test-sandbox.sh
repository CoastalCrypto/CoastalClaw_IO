#!/bin/bash
set -e

# Wrapper for sandbox-cli.js on Unix/Mac/Linux

COMMAND="${1:-start}"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Install from https://nodejs.org"
    exit 1
fi

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Install Docker from https://docker.com"
    exit 1
fi

echo "Running: node scripts/sandbox-cli.js $COMMAND" >&2
node scripts/sandbox-cli.js "$COMMAND"
