from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
from datetime import datetime, timezone
import asyncio
import json

from sse_starlette.sse import EventSourceResponse

from app.db.session import get_db
from app.db.models import TrainingRun, Checkpoint, RunStatus
from app.schemas import (
    TrainingRunCreate, TrainingRunResponse, TrainingRunDetail,
    CheckpointResponse, ModelResponse,
)
from app.middleware.auth import require_admin

router = APIRouter(prefix="/api/training-runs", tags=["training-runs"])


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
async def stop_run(run_id: UUID, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
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


# SSE stream router lives in a separate prefix
stream_router = APIRouter(prefix="/api/stream", tags=["streaming"])


@stream_router.get("/training-runs/{run_id}")
async def stream_run(run_id: UUID, db: AsyncSession = Depends(get_db)):
    """SSE stream for training run metrics. Simulates live updates for dev."""
    result = await db.execute(select(TrainingRun).where(TrainingRun.id == run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    async def event_generator():
        import random
        step = run.steps or 0
        while True:
            step += 100
            data = {
                "step": step,
                "avg_reward": round(random.uniform(-1, 3) + step * 0.001, 4),
                "entropy": round(max(0.1, 2.0 - step * 0.0005 + random.uniform(-0.1, 0.1)), 4),
                "loss_pi": round(max(0.01, 0.5 - step * 0.0002 + random.uniform(-0.02, 0.02)), 4),
                "loss_v": round(max(0.01, 1.0 - step * 0.0003 + random.uniform(-0.05, 0.05)), 4),
            }
            yield {"event": "metrics", "data": json.dumps(data)}
            await asyncio.sleep(2)
            if step > 10000:
                yield {"event": "done", "data": json.dumps({"status": "completed"})}
                break

    return EventSourceResponse(event_generator())
