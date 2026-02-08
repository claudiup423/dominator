from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID
import asyncio
import json

from sse_starlette.sse import EventSourceResponse
from redis import Redis

from app.db.session import get_db
from app.db.models import EvalSuite, EvalResult, Checkpoint
from app.schemas import (
    EvalSuiteCreate, EvalSuiteResponse, EvalRunRequest,
    EvalResultResponse, EvalCompareResponse,
)
from app.middleware.auth import require_admin
from app.core.config import get_settings

router = APIRouter(prefix="/api/evals", tags=["evals"])
suite_router = APIRouter(prefix="/api/eval-suites", tags=["eval-suites"])


@suite_router.get("", response_model=List[EvalSuiteResponse])
async def list_suites(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EvalSuite).order_by(EvalSuite.created_at.desc()))
    return [EvalSuiteResponse.model_validate(s) for s in result.scalars().all()]


@suite_router.post("", response_model=EvalSuiteResponse, status_code=201)
async def create_suite(body: EvalSuiteCreate, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    suite = EvalSuite(**body.model_dump())
    db.add(suite)
    await db.commit()
    await db.refresh(suite)
    return EvalSuiteResponse.model_validate(suite)


@router.post("/run", response_model=EvalResultResponse, status_code=201)
async def run_eval(body: EvalRunRequest, db: AsyncSession = Depends(get_db), _=Depends(require_admin)):
    # Validate checkpoint and suite exist
    cp = await db.execute(select(Checkpoint).where(Checkpoint.id == body.checkpoint_id))
    if not cp.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    suite = await db.execute(select(EvalSuite).where(EvalSuite.id == body.suite_id))
    if not suite.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Suite not found")

    eval_result = EvalResult(
        checkpoint_id=body.checkpoint_id,
        suite_id=body.suite_id,
        status="running",
    )
    db.add(eval_result)
    await db.commit()
    await db.refresh(eval_result)

    # Enqueue job
    try:
        settings = get_settings()
        redis_conn = Redis.from_url(settings.REDIS_URL)
        from rq import Queue
        q = Queue("evals", connection=redis_conn)
        q.enqueue("app.jobs.eval_job.run_eval_job", str(eval_result.id))
    except Exception:
        pass  # In dev without worker, eval will stay in "running"

    return EvalResultResponse.model_validate(eval_result)


@router.get("/{eval_id}", response_model=EvalResultResponse)
async def get_eval(eval_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EvalResult).where(EvalResult.id == eval_id))
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Eval not found")
    return EvalResultResponse.model_validate(ev)


@router.get("/compare", response_model=EvalCompareResponse)
async def compare_evals(
    base_checkpoint_id: UUID = Query(...),
    candidate_checkpoint_id: UUID = Query(...),
    db: AsyncSession = Depends(get_db),
):
    base_r = await db.execute(
        select(EvalResult).where(EvalResult.checkpoint_id == base_checkpoint_id).order_by(EvalResult.created_at.desc())
    )
    base = base_r.scalar_one_or_none()
    cand_r = await db.execute(
        select(EvalResult).where(EvalResult.checkpoint_id == candidate_checkpoint_id).order_by(EvalResult.created_at.desc())
    )
    candidate = cand_r.scalar_one_or_none()

    if not base or not candidate:
        raise HTTPException(status_code=404, detail="Eval results not found for comparison")

    metrics = ["win_rate", "goals_for", "goals_against", "kickoff_loss_rate",
               "concede_open_net_rate", "own_goal_rate", "avg_shot_quality",
               "last_man_overcommit_rate", "boost_starve_rate"]
    deltas = {}
    for m in metrics:
        bv = getattr(base, m) or 0
        cv = getattr(candidate, m) or 0
        deltas[m] = round(cv - bv, 4)

    return EvalCompareResponse(
        base=EvalResultResponse.model_validate(base),
        candidate=EvalResultResponse.model_validate(candidate),
        deltas=deltas,
    )


# SSE for eval progress
eval_stream_router = APIRouter(prefix="/api/stream", tags=["streaming"])


@eval_stream_router.get("/evals/{eval_id}")
async def stream_eval(eval_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EvalResult).where(EvalResult.id == eval_id))
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(status_code=404, detail="Eval not found")

    async def event_generator():
        import random
        for pct in range(0, 101, 10):
            yield {"event": "progress", "data": json.dumps({"percent": pct, "status": "running"})}
            await asyncio.sleep(1)
        yield {"event": "done", "data": json.dumps({"status": "completed"})}

    return EventSourceResponse(event_generator())
