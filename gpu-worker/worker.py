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
import threading
from pathlib import Path
from PIL import Image, ImageOps

# Fix PyTorch 2.6+ weights_only default breaking nerfstudio export
os.environ.setdefault("TORCH_FORCE_WEIGHTS_ONLY_LOAD", "0")

CALLBACK_URL = os.environ.get("CALLBACK_URL")
STORAGE_BASE = os.environ.get("STORAGE_BASE_URL")
WORKER_DIR = Path("/tmp/reconstruction")


def update_status(project_id, **kwargs):
    """Send status update to Lovable backend."""
    if not CALLBACK_URL:
        print(f"[STATUS] {project_id}: {kwargs}")
        return
    try:
        requests.post(CALLBACK_URL, json={"project_id": project_id, **kwargs}, timeout=10)
    except Exception as e:
        print(f"Callback failed: {e}")


def download_files(project_id, files, work_dir):
    """Download raw files from storage."""
    raw_dir = work_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    for i, f in enumerate(files):
        url = f["url"]
        ext = url.rsplit(".", 1)[-1] if "." in url else "jpg"
        out_path = raw_dir / f"{i:04d}.{ext}"
        resp = requests.get(url, timeout=60, headers={
            "User-Agent": "Mozilla/5.0 (compatible; RimDreamer/1.0)"
        })
        resp.raise_for_status()
        out_path.write_bytes(resp.content)
        print(f"Downloaded {i+1}/{len(files)}: {out_path.name}")
    return raw_dir


def preprocess_images(raw_dir, output_dir, max_size=1600):
    """Auto-rotate from EXIF and resize images."""
    output_dir.mkdir(parents=True, exist_ok=True)
    for img_path in sorted(raw_dir.iterdir()):
        if img_path.suffix.lower() not in ('.jpg', '.jpeg', '.png', '.webp'):
            continue
        img = ImageOps.exif_transpose(Image.open(img_path))
        w, h = img.size
        if max(w, h) > max_size:
            scale = max_size / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
        img.save(output_dir / f"{img_path.stem}.jpg", "JPEG", quality=90)
    print(f"Preprocessed {len(list(output_dir.iterdir()))} images")
    return output_dir


def _detect_gpu():
    """Check if CUDA GPU is available for COLMAP."""
    try:
        result = subprocess.run(["nvidia-smi"], capture_output=True, timeout=5)
        return result.returncode == 0
    except Exception:
        return False


def run_colmap(images_dir, output_dir):
    """Run COLMAP sparse reconstruction."""
    db_path = output_dir / "database.db"
    sparse_dir = output_dir / "sparse"
    sparse_dir.mkdir(parents=True, exist_ok=True)

    use_gpu = "0"  # Force CPU — COLMAP not compiled with GPU support
    print(f"COLMAP using GPU: {use_gpu}")

    subprocess.run([
        "colmap", "feature_extractor",
        "--database_path", str(db_path),
        "--image_path", str(images_dir),
        "--ImageReader.single_camera", "1",
        "--SiftExtraction.use_gpu", use_gpu,
    ], check=True)

    subprocess.run([
        "colmap", "exhaustive_matcher",
        "--database_path", str(db_path),
        "--SiftMatching.use_gpu", use_gpu,
    ], check=True)

    subprocess.run([
        "colmap", "mapper",
        "--database_path", str(db_path),
        "--image_path", str(images_dir),
        "--output_path", str(sparse_dir),
    ], check=True)

    model_dir = sparse_dir / "0"
    if not model_dir.exists():
        raise RuntimeError("COLMAP failed. Try more photos with better overlap.")
    return model_dir


def train_gaussian_splatting(images_dir, colmap_dir, output_dir):
    """Train 3D Gaussian Splatting using Nerfstudio."""
    output_dir.mkdir(parents=True, exist_ok=True)
    processed_dir = output_dir / "processed"

    subprocess.run([
        "ns-process-data", "images",
        "--data", str(images_dir),
        "--output-dir", str(processed_dir),
        "--skip-colmap",
        "--colmap-model-path", str(colmap_dir),
    ], check=True)

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


def export_splat(model_dir, output_path):
    """Export trained model to .splat format."""
    env = os.environ.copy()
    env["TORCH_FORCE_WEIGHTS_ONLY_LOAD"] = "0"
    subprocess.run([
        "ns-export", "gaussian-splat",
        "--load-config", str(next(model_dir.rglob("config.yml"))),
        "--output-dir", str(output_path.parent),
    ], check=True, env=env)

    splat_files = list(output_path.parent.glob("*.splat")) + list(output_path.parent.glob("*.ply"))
    if splat_files:
        shutil.move(str(splat_files[0]), str(output_path))
    return output_path


def upload_to_storage(local_path, storage_path):
    """Upload file to Supabase Storage."""
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


def process_job(project_id, files):
    """Main job processing pipeline."""
    work_dir = WORKER_DIR / project_id
    work_dir.mkdir(parents=True, exist_ok=True)

    try:
        update_status(project_id, progress_stage="preparing_images", status="processing")
        raw_dir = download_files(project_id, files, work_dir)

        # Check for video input
        video_files = [f for f in raw_dir.iterdir() if f.suffix.lower() in ('.mp4', '.mov', '.webm')]
        if video_files:
            frames_dir = work_dir / "frames"
            frames_dir.mkdir(parents=True, exist_ok=True)
            subprocess.run([
                "ffmpeg", "-i", str(video_files[0]),
                "-vf", "fps=3", "-q:v", "2",
                str(frames_dir / "%04d.jpg")
            ], check=True)
            images_dir = frames_dir
        else:
            images_dir = raw_dir

        processed_dir = work_dir / "processed"
        preprocess_images(images_dir, processed_dir)

        update_status(project_id, progress_stage="colmap")
        colmap_dir = work_dir / "colmap"
        colmap_dir.mkdir(parents=True, exist_ok=True)
        sparse_model = run_colmap(processed_dir, colmap_dir)

        update_status(project_id, progress_stage="training_splats")
        gs_output = work_dir / "gs_output"
        model_dir = train_gaussian_splatting(processed_dir, sparse_model, gs_output)

        update_status(project_id, progress_stage="exporting")
        splat_path = work_dir / "output" / "model.splat"
        splat_path.parent.mkdir(parents=True, exist_ok=True)
        export_splat(model_dir, splat_path)

        # Generate thumbnail
        thumb_path = work_dir / "output" / "preview.jpg"
        images = sorted(processed_dir.glob("*.jpg"))
        if images:
            img = Image.open(images[len(images) // 2])
            img.thumbnail((800, 600))
            img.save(thumb_path, "JPEG", quality=85)

        # Upload outputs
        model_url = upload_to_storage(splat_path, f"projects/{project_id}/output/model.splat")
        preview_url = upload_to_storage(thumb_path, f"projects/{project_id}/output/preview.jpg")

        update_status(project_id, status="done", model_url=model_url, preview_url=preview_url)
        print(f"✅ Project {project_id} completed!")

    except Exception as e:
        print(f"❌ Project {project_id} failed: {e}")
        update_status(project_id, status="failed", error_message=str(e))

    finally:
        if work_dir.exists():
            shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        job = json.loads(sys.argv[1])
        process_job(job["project_id"], job["files"])
    else:
        from http.server import HTTPServer, BaseHTTPRequestHandler

        class JobHandler(BaseHTTPRequestHandler):
            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
                threading.Thread(
                    target=process_job,
                    args=(body["project_id"], body["files"]),
                ).start()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"accepted": True}).encode())

        port = int(os.environ.get("PORT", 8080))
        server = HTTPServer(("0.0.0.0", port), JobHandler)
        print(f"Worker listening on port {port}")
        server.serve_forever()
