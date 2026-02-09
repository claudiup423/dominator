"""
Training control endpoints — proxies commands to the bot's training_server.py.

The bot machine runs training_server.py on port 9000.
This API proxies requests from the web frontend to that server.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import httpx
import os
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from datetime import datetime, timezone
from app.middleware.auth import require_admin

router = APIRouter(prefix="/api/training", tags=["training-control"])

# URL of the bot's training server
TRAINING_SERVER_URL = os.environ.get("TRAINING_SERVER_URL", "http://host.docker.internal:9000")


async def _proxy_get(path: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{TRAINING_SERVER_URL}{path}")
            return r.json()
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Training server not reachable. Is training_server.py running?")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Training server error: {str(e)}")


async def _proxy_post(path: str, data: dict = None) -> dict:
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{TRAINING_SERVER_URL}{path}", json=data)
            return r.json()
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Training server not reachable. Is training_server.py running?")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Training server error: {str(e)}")


class LaunchTrainingRequest(BaseModel):
    mode: str = "1v1"
    checkpoint_path: Optional[str] = None
    rewards: dict = {}
    hyperparameters: dict = {}
    training: dict = {}
    run_id: Optional[str] = None


@router.get("/status")
async def get_status():
    return await _proxy_get("/status")


@router.post("/launch")
async def launch_training(body: LaunchTrainingRequest, db: AsyncSession = Depends(get_db)):
    """Start training on the bot machine and create a DB run record."""
    config = {
        "mode": body.mode,
        "checkpoint_path": body.checkpoint_path,
        "rewards": body.rewards or {"goal": 10.0, "touch": 3.0, "velocity_ball_to_goal": 5.0, "velocity_player_to_ball": 1.0, "speed": 0.1, "boost_penalty": 0.0, "demo": 0.0, "aerial": 0.0},
        "hyperparameters": body.hyperparameters or {"policy_lr": 5e-4, "critic_lr": 5e-4, "n_proc": 16, "ppo_batch_size": 50000, "ts_per_iteration": 50000, "ppo_epochs": 3, "ppo_ent_coef": 0.01, "gamma": 0.99, "tick_skip": 8},
        "training": body.training or {"save_every_ts": 5000000, "timestep_limit": 10000000000, "timeout_seconds": 15, "log_to_wandb": False},
        "run_id": body.run_id,
    }

    # Start training on bot machine
    result = await _proxy_post("/start", config)

    # Create a DB record for this run
    from app.db.models import Model, TrainingRun, RunStatus
    from sqlalchemy import select

    model_result = await db.execute(select(Model).limit(1))
    model = model_result.scalar_one_or_none()
    if not model:
        model = Model(name="DominanceBot", version="v2.0")
        db.add(model)
        await db.flush()

    run = TrainingRun(
        model_id=model.id,
        status=RunStatus.running,
        started_at=datetime.now(timezone.utc),
        config_json=config,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    result["run_id"] = str(run.id)

    return result

@router.post("/stop")
async def stop_training():
    return await _proxy_post("/stop")


@router.get("/checkpoints")
async def list_checkpoints():
    return await _proxy_get("/checkpoints")


@router.get("/logs")
async def get_logs(n: int = 100):
    return await _proxy_get(f"/logs?n={n}")


@router.get("/metrics")
async def get_metrics():
    return await _proxy_get("/metrics")


@router.get("/active-config")
async def get_active_config():
    config = await _proxy_get("/config")
    return {"active": config is not None, "config": config}


@router.get("/defaults")
async def get_defaults():
    return {
        "modes": ["1v1", "2v2", "3v3"],
        "rewards": {
            "goal": {"default": 10.0, "min": 0, "max": 50, "step": 0.5, "description": "Reward for scoring a goal"},
            "touch": {"default": 3.0, "min": 0, "max": 20, "step": 0.5, "description": "Reward for touching the ball"},
            "velocity_ball_to_goal": {"default": 5.0, "min": 0, "max": 20, "step": 0.5, "description": "Ball moving toward opponent goal"},
            "velocity_player_to_ball": {"default": 1.0, "min": 0, "max": 10, "step": 0.1, "description": "Driving toward the ball"},
            "speed": {"default": 0.1, "min": 0, "max": 5, "step": 0.1, "description": "Reward for car speed"},
            "boost_penalty": {"default": 0.0, "min": 0, "max": 5, "step": 0.1, "description": "Penalty for wasting boost"},
            "demo": {"default": 0.0, "min": 0, "max": 10, "step": 0.5, "description": "Reward for demolishing opponents"},
            "aerial": {"default": 0.0, "min": 0, "max": 10, "step": 0.5, "description": "Reward for aerial play"},
        },
        "hyperparameters": {
            "policy_lr": {"default": 5e-4, "min": 1e-5, "max": 1e-2},
            "critic_lr": {"default": 5e-4, "min": 1e-5, "max": 1e-2},
            "n_proc": {"default": 16, "min": 1, "max": 64},
            "ppo_batch_size": {"default": 50000, "min": 1000, "max": 500000, "step": 1000},
            "ts_per_iteration": {"default": 50000, "min": 1000, "max": 500000, "step": 1000},
            "ppo_epochs": {"default": 3, "min": 1, "max": 10},
            "ppo_ent_coef": {"default": 0.01, "min": 0.0, "max": 0.1, "step": 0.001},
            "gamma": {"default": 0.99, "min": 0.9, "max": 1.0, "step": 0.001},
            "tick_skip": {"default": 8, "min": 1, "max": 16},
        },
    }


# ─── Eval Results (proxy to training server) ─────────────────────────

@router.get("/evals")
async def get_eval_results():
    """Proxy eval results from the training server."""
    return await _proxy_get("/evals")


@router.get("/evals/latest")
async def get_latest_eval():
    """Proxy latest eval result."""
    return await _proxy_get("/evals/latest")


@router.get("/evals/elo")
async def get_elo_state():
    """Proxy Elo rating state."""
    return await _proxy_get("/evals/elo")


@router.get("/evals/tiers")
async def get_tier_status():
    """Proxy frozen tier status."""
    return await _proxy_get("/evals/tiers")


@router.get("/evals/regressions")
async def get_regressions():
    """Proxy regression log."""
    return await _proxy_get("/evals/regressions")