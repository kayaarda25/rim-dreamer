# GPU Worker — COLMAP + 3D Gaussian Splatting

This document describes how to set up the external GPU worker that processes
reconstruction jobs dispatched by the Lovable backend.

## Overview

```
[Lovable Edge Function: start-reconstruction]
         │
         ▼
[GPU Worker Service]  ◄── Receives job via HTTP POST or polls DB
         │
         ├── 1. Download raw images from storage
         ├── 2. (If video) Extract frames with ffmpeg
         ├── 3. Preprocess: auto-rotate (EXIF), resize to ~1600px
         ├── 4. Run COLMAP for camera pose estimation
         ├── 5. Train 3D Gaussian Splatting model
         ├── 6. Export .splat file + thumbnail
         ├── 7. Upload outputs to storage
         └── 8. POST callback to /functions/v1/worker-callback
```

## Docker Setup

### Dockerfile

```dockerfile
FROM nvidia/cuda:12.2.0-devel-ubuntu22.04

# System deps
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    git cmake build-essential \
    libboost-all-dev libeigen3-dev libceres-dev \
    libflann-dev libfreeimage-dev libmetis-dev \
    libgoogle-glog-dev libgflags-dev libsqlite3-dev \
    libglew-dev qtbase5-dev libqt5opengl5-dev \
    ffmpeg curl wget \
    && rm -rf /var/lib/apt/lists/*

# Install COLMAP
RUN git clone https://github.com/colmap/colmap.git /opt/colmap && \
    cd /opt/colmap && mkdir build && cd build && \
    cmake .. -DCMAKE_CUDA_ARCHITECTURES="all-major" && \
    make -j$(nproc) && make install

# Install Nerfstudio (includes Gaussian Splatting support)
RUN pip3 install --upgrade pip && \
    pip3 install torch torchvision --index-url https://download.pytorch.org/whl/cu121 && \
    pip3 install nerfstudio gsplat

# Install worker script deps
RUN pip3 install requests pillow

WORKDIR /app
COPY worker.py /app/
COPY entrypoint.sh /app/

ENTRYPOINT ["/app/entrypoint.sh"]
```

### worker.py

```python
#!/usr/bin/env python3
"""
GPU Worker for 3D Gaussian Splatting reconstruction.
Processes jobs from the Lovable backend.
"""

import os
import sys
import json
import shutil
import subprocess
import requests
from pathlib import Path
from PIL import Image

CALLBACK_URL = os.environ.get("CALLBACK_URL")
STORAGE_BASE = os.environ.get("STORAGE_BASE_URL")
WORKER_DIR = Path("/tmp/reconstruction")


def update_status(project_id: str, **kwargs):
    """Send status update to Lovable backend."""
    if not CALLBACK_URL:
        print(f"[STATUS] {project_id}: {kwargs}")
        return
    try:
        requests.post(CALLBACK_URL, json={"project_id": project_id, **kwargs}, timeout=10)
    except Exception as e:
        print(f"Callback failed: {e}")


def download_files(project_id: str, files: list, work_dir: Path):
    """Download raw files from storage."""
    raw_dir = work_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)

    for i, f in enumerate(files):
        url = f["url"]
        ext = url.rsplit(".", 1)[-1] if "." in url else "jpg"
        out_path = raw_dir / f"{i:04d}.{ext}"
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
        out_path.write_bytes(resp.content)
        print(f"Downloaded {i+1}/{len(files)}: {out_path.name}")

    return raw_dir


def extract_frames(video_path: Path, output_dir: Path, fps: int = 3):
    """Extract frames from video at given FPS."""
    output_dir.mkdir(parents=True, exist_ok=True)
    subprocess.run([
        "ffmpeg", "-i", str(video_path),
        "-vf", f"fps={fps}",
        "-q:v", "2",
        str(output_dir / "%04d.jpg")
    ], check=True)
    return sorted(output_dir.glob("*.jpg"))


def preprocess_images(raw_dir: Path, output_dir: Path, max_size: int = 1600):
    """Auto-rotate from EXIF and resize images."""
    output_dir.mkdir(parents=True, exist_ok=True)

    for img_path in sorted(raw_dir.iterdir()):
        if img_path.suffix.lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
            continue

        img = Image.open(img_path)

        # Auto-rotate based on EXIF
        from PIL import ImageOps
        img = ImageOps.exif_transpose(img)

        # Resize
        w, h = img.size
        if max(w, h) > max_size:
            scale = max_size / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

        out_path = output_dir / f"{img_path.stem}.jpg"
        img.save(out_path, "JPEG", quality=90)

    print(f"Preprocessed {len(list(output_dir.iterdir()))} images")
    return output_dir


def run_colmap(images_dir: Path, output_dir: Path):
    """Run COLMAP sparse reconstruction."""
    db_path = output_dir / "database.db"
    sparse_dir = output_dir / "sparse"
    sparse_dir.mkdir(parents=True, exist_ok=True)

    # Feature extraction
    subprocess.run([
        "colmap", "feature_extractor",
        "--database_path", str(db_path),
        "--image_path", str(images_dir),
        "--ImageReader.single_camera", "1",
        "--SiftExtraction.use_gpu", "1",
    ], check=True)

    # Feature matching
    subprocess.run([
        "colmap", "exhaustive_matcher",
        "--database_path", str(db_path),
        "--SiftMatching.use_gpu", "1",
    ], check=True)

    # Sparse reconstruction
    subprocess.run([
        "colmap", "mapper",
        "--database_path", str(db_path),
        "--image_path", str(images_dir),
        "--output_path", str(sparse_dir),
    ], check=True)

    # Check if reconstruction succeeded
    model_dir = sparse_dir / "0"
    if not model_dir.exists():
        raise RuntimeError("COLMAP failed to reconstruct. Try more photos with better overlap.")

    return model_dir


def train_gaussian_splatting(images_dir: Path, colmap_dir: Path, output_dir: Path):
    """Train 3D Gaussian Splatting using Nerfstudio."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # Use nerfstudio's ns-process-data for COLMAP data
    processed_dir = output_dir / "processed"
    subprocess.run([
        "ns-process-data", "images",
        "--data", str(images_dir),
        "--output-dir", str(processed_dir),
        "--skip-colmap",  # We already ran COLMAP
        "--colmap-model-path", str(colmap_dir),
    ], check=True)

    # Train splatfacto (Nerfstudio's Gaussian Splatting)
    subprocess.run([
        "ns-train", "splatfacto",
        "--data", str(processed_dir),
        "--output-dir", str(output_dir / "model"),
        "--max-num-iterations", "30000",
        "--viewer.quit-on-train-completion", "True",
        "nerfstudio-data",
        "--data", str(processed_dir),
    ], check=True)

    return output_dir / "model"


def export_splat(model_dir: Path, output_path: Path):
    """Export trained model to .splat format for web viewer."""
    subprocess.run([
        "ns-export", "gaussian-splat",
        "--load-config", str(next(model_dir.rglob("config.yml"))),
        "--output-dir", str(output_path.parent),
    ], check=True)

    # The exported file should be in output_path.parent
    splat_files = list(output_path.parent.glob("*.splat")) + list(output_path.parent.glob("*.ply"))
    if splat_files:
        shutil.move(str(splat_files[0]), str(output_path))

    return output_path


def generate_thumbnail(images_dir: Path, output_path: Path):
    """Generate a thumbnail from one of the input images."""
    images = sorted(images_dir.glob("*.jpg"))
    if images:
        img = Image.open(images[len(images) // 2])
        img.thumbnail((800, 600))
        img.save(output_path, "JPEG", quality=85)
    return output_path


def upload_to_storage(local_path: Path, storage_path: str):
    """Upload file to S3-compatible storage. Implement based on your storage provider."""
    # For Supabase Storage, use the REST API:
    # PUT {STORAGE_BASE}/object/reconstructions/{storage_path}
    if STORAGE_BASE:
        with open(local_path, "rb") as f:
            resp = requests.post(
                f"{STORAGE_BASE}/object/reconstructions/{storage_path}",
                files={"file": f},
                headers={"Authorization": f"Bearer {os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')}"},
            )
            resp.raise_for_status()
            return f"{STORAGE_BASE}/object/public/reconstructions/{storage_path}"
    return str(local_path)


def process_job(project_id: str, files: list):
    """Main job processing pipeline."""
    work_dir = WORKER_DIR / project_id
    work_dir.mkdir(parents=True, exist_ok=True)

    try:
        # 1. Download files
        update_status(project_id, progress_stage="preparing_images", status="processing")
        raw_dir = download_files(project_id, files, work_dir)

        # 2. Check for video input and extract frames
        video_files = [f for f in raw_dir.iterdir() if f.suffix.lower() in ('.mp4', '.mov', '.webm')]
        if video_files:
            frames_dir = work_dir / "frames"
            extract_frames(video_files[0], frames_dir, fps=3)
            images_dir = frames_dir
        else:
            images_dir = raw_dir

        # 3. Preprocess images
        processed_dir = work_dir / "processed"
        preprocess_images(images_dir, processed_dir)

        # 4. Run COLMAP
        update_status(project_id, progress_stage="colmap")
        colmap_dir = work_dir / "colmap"
        colmap_dir.mkdir(parents=True, exist_ok=True)
        sparse_model = run_colmap(processed_dir, colmap_dir)

        # 5. Train Gaussian Splatting
        update_status(project_id, progress_stage="training_splats")
        gs_output = work_dir / "gs_output"
        model_dir = train_gaussian_splatting(processed_dir, sparse_model, gs_output)

        # 6. Export
        update_status(project_id, progress_stage="exporting")
        splat_path = work_dir / "output" / "model.splat"
        splat_path.parent.mkdir(parents=True, exist_ok=True)
        export_splat(model_dir, splat_path)

        # Generate thumbnail
        thumb_path = work_dir / "output" / "preview.jpg"
        generate_thumbnail(processed_dir, thumb_path)

        # 7. Upload outputs
        model_url = upload_to_storage(splat_path, f"projects/{project_id}/output/model.splat")
        preview_url = upload_to_storage(thumb_path, f"projects/{project_id}/output/preview.jpg")

        # 8. Callback: done
        update_status(
            project_id,
            status="done",
            model_url=model_url,
            preview_url=preview_url,
        )

        print(f"✅ Project {project_id} completed successfully!")

    except Exception as e:
        print(f"❌ Project {project_id} failed: {e}")
        update_status(
            project_id,
            status="failed",
            error_message=str(e),
        )

    finally:
        # Cleanup
        if work_dir.exists():
            shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == "__main__":
    # Can be called with: python worker.py '{"project_id": "...", "files": [...]}'
    if len(sys.argv) > 1:
        job = json.loads(sys.argv[1])
        process_job(job["project_id"], job["files"])
    else:
        # HTTP server mode for receiving jobs
        from http.server import HTTPServer, BaseHTTPRequestHandler
        import threading

        class JobHandler(BaseHTTPRequestHandler):
            def do_POST(self):
                content_length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(content_length))

                # Process in background thread
                thread = threading.Thread(
                    target=process_job,
                    args=(body["project_id"], body["files"]),
                )
                thread.start()

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"accepted": True}).encode())

        port = int(os.environ.get("PORT", 8080))
        server = HTTPServer(("0.0.0.0", port), JobHandler)
        print(f"Worker listening on port {port}")
        server.serve_forever()
```

### entrypoint.sh

```bash
#!/bin/bash
set -e

echo "=== GPU Worker for 3D Gaussian Splatting ==="
echo "CUDA: $(nvcc --version 2>/dev/null | tail -1 || echo 'not found')"
echo "COLMAP: $(colmap -h 2>/dev/null | head -1 || echo 'not found')"
echo "Nerfstudio: $(ns-train --help 2>/dev/null | head -1 || echo 'not found')"

python3 /app/worker.py "$@"
```

## Environment Variables

| Variable | Description |
|---|---|
| `CALLBACK_URL` | URL for status callbacks, e.g., `https://<project>.supabase.co/functions/v1/worker-callback` |
| `STORAGE_BASE_URL` | Supabase Storage API base URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for storage uploads |
| `PORT` | HTTP port for job server (default: 8080) |

## Running

```bash
# Build
docker build -t gs-worker .

# Run (GPU required)
docker run --gpus all \
  -e CALLBACK_URL="https://yqjdzziqdimflzytcpbg.supabase.co/functions/v1/worker-callback" \
  -e STORAGE_BASE_URL="https://yqjdzziqdimflzytcpbg.supabase.co/storage/v1" \
  -e SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
  -p 8080:8080 \
  gs-worker

# Send a test job
curl -X POST http://localhost:8080/jobs \
  -H "Content-Type: application/json" \
  -d '{"project_id": "test-123", "files": [{"url": "https://example.com/photo1.jpg", "type": "image"}]}'
```

## GPU Requirements

- NVIDIA GPU with ≥8GB VRAM (RTX 3070+ recommended)
- CUDA 12.x
- ~50GB disk space for Docker image + temp files

## Alternative: Without Nerfstudio

If you prefer a simpler setup without Nerfstudio, you can use the original
3D Gaussian Splatting implementation directly:

```bash
# Clone original 3DGS repo
git clone --recursive https://github.com/graphdeco-inria/gaussian-splatting.git

# Train
python train.py -s /path/to/colmap/output -m /path/to/output --iterations 30000

# The output point_cloud.ply can be converted to .splat format
# using available conversion tools.
```
