"""
Job: Ingest a JSONL training log file, upserting run metrics and checkpoints.
"""
import json
from uuid import UUID
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.db.models import TrainingRun, Checkpoint, RunStatus


def ingest_training_log_job(run_id: str, log_path: str):
    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL_SYNC)

    with Session(engine) as db:
        run = db.query(TrainingRun).filter(TrainingRun.id == UUID(run_id)).first()
        if not run:
            return

        with open(log_path, "r") as f:
            for line in f:
                entry = json.loads(line.strip())
                entry_type = entry.get("type")

                if entry_type == "metrics":
                    run.steps = entry.get("step", run.steps)
                    run.avg_reward = entry.get("avg_reward", run.avg_reward)
                    run.entropy = entry.get("entropy", run.entropy)
                    run.loss_pi = entry.get("loss_pi", run.loss_pi)
                    run.loss_v = entry.get("loss_v", run.loss_v)

                elif entry_type == "checkpoint":
                    existing = db.query(Checkpoint).filter(
                        Checkpoint.run_id == run.id,
                        Checkpoint.step == entry["step"]
                    ).first()
                    if not existing:
                        cp = Checkpoint(
                            run_id=run.id,
                            step=entry["step"],
                            artifact_path=entry.get("path"),
                        )
                        db.add(cp)

                elif entry_type == "status":
                    status_val = entry.get("status")
                    if status_val in [s.value for s in RunStatus]:
                        run.status = status_val

        db.commit()
