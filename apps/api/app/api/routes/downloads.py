"""
Download endpoints — serves the agent .exe and latest bot model.

GET /api/download/agent          → DominanceBot.exe (the desktop agent)
GET /api/download/model          → Latest promoted model weights
GET /api/download/model/info     → Model metadata (version, hash, size)
POST /api/download/agent/upload  → Admin uploads new agent build
POST /api/download/model/upload  → Admin uploads new model weights

Files are stored in DOWNLOADS_DIR (default: ./data/downloads/)
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
import hashlib
import json
import os
import sys
import shutil
from pathlib import Path
from datetime import datetime, timezone

from app.middleware.auth import require_admin

router = APIRouter(prefix="/api/download", tags=["downloads"])

DOWNLOADS_DIR = Path(os.environ.get("DOWNLOADS_DIR", "./data/downloads"))
AGENT_DIR = DOWNLOADS_DIR / "agent"
MODEL_DIR = DOWNLOADS_DIR / "model"


def _ensure_dirs():
    AGENT_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_DIR.mkdir(parents=True, exist_ok=True)


def _file_hash(path: Path) -> str:
    """SHA256 hash of a file."""
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _read_meta(meta_path: Path) -> dict:
    if meta_path.exists():
        return json.loads(meta_path.read_text())
    return {}


def _write_meta(meta_path: Path, data: dict):
    meta_path.write_text(json.dumps(data, indent=2))


# ── Agent Download ─────────────────────────────────────────────────

@router.get("/agent")
async def download_agent():
    """Download the DominanceBot desktop agent."""
    _ensure_dirs()

    # Find the agent binary (could be .exe on Windows or no extension on Linux)
    agent_files = [f for f in AGENT_DIR.iterdir()
                   if f.is_file() and f.name != "meta.json"]

    if not agent_files:
        raise HTTPException(
            status_code=404,
            detail="Agent not built yet. Go to Admin > Deploy and build or upload the agent.",
        )

    agent_path = max(agent_files, key=lambda f: f.stat().st_mtime)
    return FileResponse(
        path=str(agent_path),
        filename=agent_path.name,
        media_type="application/octet-stream",
    )


@router.get("/agent/info")
async def agent_info():
    """Get agent version info (so agent can check for self-updates)."""
    _ensure_dirs()
    meta = _read_meta(AGENT_DIR / "meta.json")

    agent_files = [f for f in AGENT_DIR.iterdir()
                   if f.is_file() and f.name != "meta.json"]
    agent_path = max(agent_files, key=lambda f: f.stat().st_mtime) if agent_files else None

    return {
        "available": agent_path is not None,
        "version": meta.get("version", "unknown"),
        "hash": meta.get("hash"),
        "size_bytes": agent_path.stat().st_size if agent_path else 0,
        "filename": agent_path.name if agent_path else None,
        "uploaded_at": meta.get("uploaded_at"),
    }


@router.post("/agent/upload")
async def upload_agent(
    file: UploadFile = File(...),
    _=Depends(require_admin),
):
    """Admin uploads a new agent build."""
    _ensure_dirs()
    agent_path = AGENT_DIR / "DominanceBot.exe"

    with open(agent_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_hash = _file_hash(agent_path)
    meta = {
        "version": file.filename or "DominanceBot.exe",
        "hash": file_hash,
        "size_bytes": agent_path.stat().st_size,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    _write_meta(AGENT_DIR / "meta.json", meta)

    return {"status": "uploaded", **meta}


# ── Model Download ─────────────────────────────────────────────────

@router.get("/model")
async def download_model():
    """
    Download the latest bot model weights.
    The agent calls this before each match to check for updates.
    """
    _ensure_dirs()

    # Find the model file (could be .pt, .onnx, .zip, etc.)
    model_files = [f for f in MODEL_DIR.iterdir()
                   if f.is_file() and f.name != "meta.json"]

    if not model_files:
        raise HTTPException(
            status_code=404,
            detail="No model uploaded yet. Admin needs to upload a model first.",
        )

    # Serve the most recent one
    model_path = max(model_files, key=lambda f: f.stat().st_mtime)
    return FileResponse(
        path=str(model_path),
        filename=model_path.name,
        media_type="application/octet-stream",
    )


@router.get("/model/info")
async def model_info():
    """
    Model metadata — the agent checks this to know if it needs to
    download a new model or if its cached copy is still current.
    """
    _ensure_dirs()
    meta = _read_meta(MODEL_DIR / "meta.json")

    model_files = [f for f in MODEL_DIR.iterdir()
                   if f.is_file() and f.name != "meta.json"]

    return {
        "available": len(model_files) > 0,
        "version": meta.get("version", "unknown"),
        "hash": meta.get("hash"),
        "filename": meta.get("filename"),
        "size_bytes": meta.get("size_bytes", 0),
        "uploaded_at": meta.get("uploaded_at"),
        "difficulty_tiers": meta.get("difficulty_tiers", []),
        "description": meta.get("description", ""),
    }


@router.post("/model/upload")
async def upload_model(
    file: UploadFile = File(...),
    version: str = "latest",
    description: str = "",
    _=Depends(require_admin),
):
    """
    Admin uploads new model weights after training.
    This is what the agent downloads before each match.
    """
    _ensure_dirs()

    # Clear old model files
    for f in MODEL_DIR.iterdir():
        if f.name != "meta.json":
            f.unlink()

    # Save new model
    filename = file.filename or "model.pt"
    model_path = MODEL_DIR / filename

    with open(model_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_hash = _file_hash(model_path)
    meta = {
        "version": version,
        "filename": filename,
        "hash": file_hash,
        "size_bytes": model_path.stat().st_size,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "description": description,
    }
    _write_meta(MODEL_DIR / "meta.json", meta)

    return {"status": "uploaded", **meta}


@router.post("/agent/build")
async def build_agent(
    _=Depends(require_admin),
):
    """
    Build the agent .exe from source using PyInstaller.
    
    This runs PyInstaller on agent.py and stores the result
    so players can download it from /api/download/agent.
    
    The agent source is expected at AGENT_SOURCE_DIR (default: /agent).
    """
    import subprocess as sp

    _ensure_dirs()

    agent_source = Path(os.environ.get("AGENT_SOURCE_DIR", "/agent"))
    agent_script = agent_source / "agent.py"

    if not agent_script.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Agent source not found at {agent_script}. Mount the agent/ directory.",
        )

    # Build with PyInstaller
    build_dir = DOWNLOADS_DIR / "_build"
    build_dir.mkdir(parents=True, exist_ok=True)
    dist_dir = build_dir / "dist"

    try:
        result = sp.run(
            [
                sys.executable, "-m", "PyInstaller",
                "--onefile",
                "--name", "DominanceBot",
                "--distpath", str(dist_dir),
                "--workpath", str(build_dir / "build"),
                "--specpath", str(build_dir),
                "--clean",
                str(agent_script),
            ],
            capture_output=True,
            text=True,
            timeout=300,  # 5 min max
            cwd=str(agent_source),
        )

        if result.returncode != 0:
            return {
                "status": "build_failed",
                "stdout": result.stdout[-2000:] if result.stdout else "",
                "stderr": result.stderr[-2000:] if result.stderr else "",
            }

        # Find the built exe
        exe_path = dist_dir / "DominanceBot.exe"
        if not exe_path.exists():
            # Linux build
            exe_path = dist_dir / "DominanceBot"

        if not exe_path.exists():
            return {"status": "build_failed", "detail": "PyInstaller ran but no output found"}

        # Copy to agent download dir (clear old files first)
        for old_f in AGENT_DIR.iterdir():
            if old_f.name != "meta.json":
                old_f.unlink()
        dest = AGENT_DIR / exe_path.name
        shutil.copy2(str(exe_path), str(dest))

        file_hash = _file_hash(dest)
        meta = {
            "version": datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S"),
            "hash": file_hash,
            "size_bytes": dest.stat().st_size,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "build_method": "pyinstaller",
        }
        _write_meta(AGENT_DIR / "meta.json", meta)

        # Cleanup build artifacts
        shutil.rmtree(build_dir, ignore_errors=True)

        return {"status": "built", **meta}

    except sp.TimeoutExpired:
        return {"status": "build_failed", "detail": "Build timed out after 5 minutes"}
    except FileNotFoundError:
        return {
            "status": "build_failed",
            "detail": "PyInstaller not installed. Run: pip install pyinstaller",
        }