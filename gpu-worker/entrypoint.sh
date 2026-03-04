#!/bin/bash
set -e
echo "=== GPU Worker for 3D Gaussian Splatting ==="
echo "CUDA: $(nvcc --version 2>/dev/null | tail -1 || echo 'not found')"
echo "COLMAP: $(colmap -h 2>/dev/null | head -1 || echo 'not found')"
python3 /app/worker.py "$@"
