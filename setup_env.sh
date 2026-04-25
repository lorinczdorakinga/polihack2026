#!/usr/bin/env bash
# setup_env.sh — Setup virtual environment for Polihack 2026

set -e

echo "🛠️  Setting up Polihack 2026 Environment"
echo "========================================"

# 1. Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
else
    echo "✅ Virtual environment already exists."
fi

# 2. Activate and install dependencies
echo "📥 Installing dependencies..."
source venv/bin/bin/activate 2>/dev/null || source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "✨ Environment Ready!"
echo "========================================"
echo "To activate the environment, run:"
echo "   source venv/bin/activate"
echo ""
echo "Then you can run your scripts:"
echo "   python webcam_server.py"
echo "   python fire.py http://localhost:5000/stream"
