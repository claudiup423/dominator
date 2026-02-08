"""
Eval job: runs evaluation for a checkpoint against a suite.
In dev mode, generates simulated metrics.
"""
import random
import time
from uuid import UUID
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.db.models import EvalResult


def run_eval_job(eval_result_id: str):
    settings = get_settings()
    engine = create_engine(settings.DATABASE_URL_SYNC)

    with Session(engine) as db:
        result = db.query(EvalResult).filter(EvalResult.id == UUID(eval_result_id)).first()
        if not result:
            return

        # Simulate evaluation (in production, this would run actual RL evals)
        time.sleep(5)  # Simulate work

        result.win_rate = round(random.uniform(0.45, 0.85), 4)
        result.goals_for = round(random.uniform(1.0, 3.5), 2)
        result.goals_against = round(random.uniform(0.5, 2.5), 2)
        result.kickoff_loss_rate = round(random.uniform(0.1, 0.4), 4)
        result.concede_open_net_rate = round(random.uniform(0.02, 0.15), 4)
        result.own_goal_rate = round(random.uniform(0.0, 0.05), 4)
        result.avg_shot_quality = round(random.uniform(0.3, 0.9), 4)
        result.last_man_overcommit_rate = round(random.uniform(0.05, 0.25), 4)
        result.boost_starve_rate = round(random.uniform(0.1, 0.4), 4)

        # Gate checks
        gates_passed = (
            result.win_rate >= 0.55 and
            result.own_goal_rate <= 0.03 and
            result.last_man_overcommit_rate <= 0.15 and
            result.concede_open_net_rate <= 0.10
        )
        result.passed_gates = gates_passed
        result.status = "completed"
        result.deltas_json = {}  # Would compute vs baseline in production

        db.commit()
