#!/usr/bin/env python3
"""
Ingest a JSONL training log file into the database.
Usage: python scripts/ingest_training_jsonl.py <run_id> <path_to_jsonl>
"""
import os
import sys
import json
from uuid import UUID

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'apps', 'api'))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.db.models import TrainingRun, Checkpoint, RunStatus

DB_URL = os.environ.get("DATABASE_URL_SYNC", "postgresql://dominator:dominator_dev@localhost:5432/dominator")
engine = create_engine(DB_URL)


def ingest(run_id: str, log_path: str):
    with Session(engine) as db:
        run = db.query(TrainingRun).filter(TrainingRun.id == UUID(run_id)).first()
        if not run:
            print(f"❌ Run {run_id} not found")
            sys.exit(1)

        count = 0
        with open(log_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                entry = json.loads(line)
                entry_type = entry.get("type")

                if entry_type == "metrics":
                    run.steps = entry.get("step", run.steps)
                    run.avg_reward = entry.get("avg_reward", run.avg_reward)
                    run.entropy = entry.get("entropy", run.entropy)
                    run.loss_pi = entry.get("loss_pi", run.loss_pi)
                    run.loss_v = entry.get("loss_v", run.loss_v)
                    count += 1

                elif entry_type == "checkpoint":
                    existing = db.query(Checkpoint).filter(
                        Checkpoint.run_id == run.id,
                        Checkpoint.step == entry["step"]
                    ).first()
                    if not existing:
                        cp = Checkpoint(
                            run_id=run.id,
                            step=entry["step"],
                            artifact_path=entry.get("path", ""),
                        )
                        db.add(cp)
                        count += 1

                elif entry_type == "status":
                    status_val = entry.get("status")
                    if status_val in [s.value for s in RunStatus]:
                        run.status = status_val
                        count += 1

        db.commit()
        print(f"✅ Ingested {count} entries for run {run_id}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python scripts/ingest_training_jsonl.py <run_id> <path_to_jsonl>")
        sys.exit(1)
    ingest(sys.argv[1], sys.argv[2])
