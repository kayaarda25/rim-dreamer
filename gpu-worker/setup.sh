#!/bin/bash
set -e

echo "=== GPU Worker Setup: COLMAP + Nerfstudio ==="

# 1. System dependencies
echo "[1/5] Installing system dependencies..."
apt-get update && apt-get install -y \
    git cmake build-essential ninja-build \
    libboost-all-dev libeigen3-dev libceres-dev \
    libflann-dev libfreeimage-dev libmetis-dev \
    libgoogle-glog-dev libgflags-dev libsqlite3-dev \
    libglew-dev qtbase5-dev libqt5opengl5-dev \
    ffmpeg curl wget \
    && rm -rf /var/lib/apt/lists/*

# 2. COLMAP
echo "[2/5] Installing COLMAP..."
if ! command -v colmap &> /dev/null; then
    git clone https://github.com/colmap/colmap.git /tmp/colmap
    cd /tmp/colmap && mkdir -p build && cd build
    cmake .. -GNinja -DCMAKE_CUDA_ARCHITECTURES="all-major"
    ninja -j$(nproc)
    ninja install
    cd /
    rm -rf /tmp/colmap
    echo "COLMAP installed: $(colmap -h 2>&1 | head -1)"
else
    echo "COLMAP already installed, skipping."
fi

# 3. PyTorch (CUDA)
echo "[3/5] Installing PyTorch..."
pip3 install --upgrade pip
pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# 4. Nerfstudio + gsplat
echo "[4/5] Installing Nerfstudio + gsplat..."
pip3 install nerfstudio gsplat

# 5. Worker dependencies
echo "[5/5] Installing worker Python deps..."
pip3 install requests pillow

echo ""
echo "=== Setup complete ==="
echo "CUDA:       $(nvcc --version 2>/dev/null | tail -1 || echo 'not found')"
echo "COLMAP:     $(colmap -h 2>&1 | head -1 || echo 'not found')"
echo "Nerfstudio: $(pip3 show nerfstudio 2>/dev/null | grep Version || echo 'not found')"
echo ""
echo "Start the worker with:"
echo "  cd $(dirname "$0")"
echo "  CALLBACK_URL=https://yqjdzziqdimflzytcpbg.supabase.co/functions/v1/worker-callback \\"
echo "  STORAGE_BASE_URL=https://yqjdzziqdimflzytcpbg.supabase.co/storage/v1 \\"
echo "  SUPABASE_SERVICE_ROLE_KEY=your-key \\"
echo "  python3 worker.py"
