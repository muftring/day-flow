#!/bin/bash
# DayFlow — one-command setup
set -e

echo ""
echo "  ╔══════════════════════════════╗"
echo "  ║         DayFlow Setup        ║"
echo "  ╚══════════════════════════════╝"
echo ""

# Check Node
if ! command -v node &>/dev/null; then
  echo "  ✗ Node.js not found. Please install from https://nodejs.org"
  exit 1
fi

NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 18 ]; then
  echo "  ✗ Node.js 18+ required (found $(node --version))"
  exit 1
fi

echo "  ✓ Node.js $(node --version)"

# Install
echo ""
echo "  Installing dependencies..."
npm install

echo ""
echo "  ✓ Done! Starting DayFlow..."
echo ""

npm start
