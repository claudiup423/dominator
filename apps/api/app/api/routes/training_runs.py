from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
from datetime import datetime, timezone
from pathlib import Path
import asyncio
import json
import os

from sse_starlette.sse import EventSourceResponse

from app.db.session import get_db
from app.db.models import TrainingRun, Checkpoint, RunStatus
from app.schemas import (
    TrainingRunCreate, TrainingRunResponse, TrainingRunDetail,
    CheckpointResponse, ModelResponse,
)
from app.middleware.auth import require_admin

router = APIRouter(prefix="/api/training-runs", tags=["training-runs"])

# ─── Metrics file location ───────────────────────────────────────────
# The bot's metrics_bridge.py writes to this file.
# Set METRICS_FILE_PATH env var to override.
METRICS_FILE = Path(os.environ.get("METRICS_FILE_PATH", "data/metrics/live_metrics.jsonl"))


@router.get("", response_model=List[TrainingRunResponse])
async def list_runs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TrainingRun).order_by(TrainingRun.started_at.desc().nullslast()))
    return [TrainingRunResponse.model_validate(r) for r in result.scalars().all()]


@router.post("/start", response_model=TrainingRunResponse, status_code=201)
async def start_run(body: TrainingRunCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    run = TrainingRun(
        model_id=body.model_id,
        config_json=body.config_json,
        status=RunStatus.running,
        started_at=datetime.now(timezone.utc),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return TrainingRunResponse.model_validate(run)


@router.post("/{run_id}/stop", response_model=TrainingRunResponse)
async def stop_run(run_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TrainingRun).where(TrainingRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    run.status = RunStatus.stopped
    run.ended_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(run)
    return TrainingRunResponse.model_validate(run)


@router.get("/{run_id}", response_model=TrainingRunDetail)
async def get_run(run_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TrainingRun)
        .options(selectinload(TrainingRun.checkpoints), selectinload(TrainingRun.model))
        .where(TrainingRun.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return TrainingRunDetail(
        **TrainingRunResponse.model_validate(run).model_dump(),
        model=ModelResponse.model_validate(run.model) if run.model else None,
        checkpoints=[CheckpointResponse.model_validate(cp) for cp in run.checkpoints],
    )


@router.get("/{run_id}/checkpoints", response_model=List[CheckpointResponse])
async def get_checkpoints(run_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Checkpoint).where(Checkpoint.run_id == run_id).order_by(Checkpoint.step)
    )
    return [CheckpointResponse.model_validate(cp) for cp in result.scalars().all()]


@router.post("/{run_id}/ingest")
async def ingest_metrics(run_id: UUID, body: dict, db: AsyncSession = Depends(get_db)):
    """Accept a metrics point from the training bot and update the DB."""
    result = await db.execute(select(TrainingRun).where(TrainingRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    run.steps = body.get("step", run.steps)
    run.avg_reward = body.get("avg_reward", run.avg_reward)
    run.entropy = body.get("entropy", run.entropy)
    run.loss_pi = body.get("loss_pi", run.loss_pi)
    run.loss_v = body.get("loss_v", run.loss_v)

    if body.get("type") == "checkpoint" and body.get("status") == "saved":
        cp = Checkpoint(run_id=run_id, step=body["step"], artifact_path=body.get("path", ""))
        db.add(cp)

    await db.commit()
    return {"ok": True}


# ─── SSE stream ──────────────────────────────────────────────────────
stream_router = APIRouter(prefix="/api/stream", tags=["streaming"])


async def _tail_metrics_file(metrics_path: Path):
    """Async generator that tails a JSONL metrics file."""
    last_pos = 0

    # First, replay existing history
    if metrics_path.exists():
        with open(metrics_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    event_type = data.get("type", "metrics")
                    yield event_type, data
                    if event_type == "done":
                        return
                except json.JSONDecodeError:
                    continue
            last_pos = f.tell()

    # Then tail for new data
    stale_seconds = 0
    while stale_seconds < 900:  # 15 min timeout
        await asyncio.sleep(1.5)
        try:
            if not metrics_path.exists():
                stale_seconds += 1.5
                continue
            current_size = metrics_path.stat().st_size
            if current_size > last_pos:
                stale_seconds = 0
                with open(metrics_path, "r") as f:
                    f.seek(last_pos)
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            data = json.loads(line)
                            event_type = data.get("type", "metrics")
                            yield event_type, data
                            if event_type == "done":
                                return
                        except json.JSONDecodeError:
                            continue
                    last_pos = f.tell()
            else:
                stale_seconds += 1.5
        except IOError:
            stale_seconds += 3
            await asyncio.sleep(1.5)


@stream_router.get("/training-runs/{run_id}")
async def stream_run(run_id: UUID, db: AsyncSession = Depends(get_db)):
    """SSE stream for training run metrics. Reads real data from the bot's metrics file."""
    result = await db.execute(select(TrainingRun).where(TrainingRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Try multiple locations for the metrics file
    candidates = [
        METRICS_FILE,
        Path(f"data/metrics/{run_id}.jsonl"),
        Path(f"data/metrics/live_metrics.jsonl"),
    ]
    # Also check BOT_DIR env var
    bot_dir = os.environ.get("BOT_DIR", "")
    if bot_dir:
        candidates.append(Path(bot_dir) / "data" / "metrics" / "live_metrics.jsonl")

    async def event_generator():
        # Find which file exists
        metrics_path = None
        for p in candidates:
            if p.exists():
                metrics_path = p
                break

        if not metrics_path:
            # Wait for file to appear
            yield {"event": "status", "data": json.dumps({
                "message": "Waiting for training to start... Pipe training output through metrics_bridge.py",
                "mode": "waiting",
            })}
            for _ in range(400):  # Wait up to 10 min
                await asyncio.sleep(1.5)
                for p in candidates:
                    if p.exists():
                        metrics_path = p
                        break
                if metrics_path:
                    break

            if not metrics_path:
                yield {"event": "done", "data": json.dumps({
                    "status": "timeout",
                    "message": "No training data appeared. Make sure metrics_bridge.py is running.",
                })}
                return

        yield {"event": "status", "data": json.dumps({
            "message": f"Connected to live metrics",
            "mode": "live",
        })}

        # Stream metrics from the file
        async for event_type, data in _tail_metrics_file(metrics_path):
            if event_type == "metrics":
                yield {"event": "metrics", "data": json.dumps(data)}
                # Also update DB
                try:
                    async with db.begin():
                        await db.execute(
                            select(TrainingRun).where(TrainingRun.id == run_id)
                        )
                except Exception:
                    pass
            elif event_type == "checkpoint":
                yield {"event": "checkpoint", "data": json.dumps(data)}
            elif event_type == "done":
                yield {"event": "done", "data": json.dumps(data)}
                return
            elif event_type == "error":
                yield {"event": "error_event", "data": json.dumps(data)}

        yield {"event": "done", "data": json.dumps({"status": "stream_ended"})}

    return EventSourceResponse(event_generator())