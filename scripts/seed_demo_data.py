#!/usr/bin/env python3
"""
Seed the Dominator database with demo data.
Run: python scripts/seed_demo_data.py
Requires DATABASE_URL_SYNC env var or defaults to local dev.
"""
import os
import sys
import uuid
import random
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'apps', 'api'))
sys.path.insert(0, os.environ.get('PYTHONPATH', '/app'))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.db.models import (
    User, Model, TrainingRun, Checkpoint, EvalSuite, EvalResult,
    TrainingSession, SessionEvent, Artifact,
    UserRole, RunStatus, ModelTag,
)
from app.core.security import hash_password

DB_URL = os.environ.get("DATABASE_URL_SYNC", "postgresql://dominator:dominator_dev@localhost:5432/dominator")
engine = create_engine(DB_URL)


def seed():
    with Session(engine) as db:
        print("🌱 Seeding demo data...")

        # ─── Users ────────────────────────────────────────────
        admin = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            email="admin@dominator.gg",
            password_hash=hash_password("admin123"),
            role=UserRole.admin,
        )
        player = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000002"),
            email="player@dominator.gg",
            password_hash=hash_password("player123"),
            role=UserRole.player,
        )
        db.add_all([admin, player])
        db.flush()
        print("  ✓ Users created (admin@dominator.gg / admin123, player@dominator.gg / player123)")

        # ─── Models ───────────────────────────────────────────
        stable_model = Model(
            id=uuid.UUID("10000000-0000-0000-0000-000000000001"),
            name="Dominator-PPO",
            version="v2.4.1",
            params_count=12_500_000,
            git_sha="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
            tag=ModelTag.stable,
        )
        candidate1 = Model(
            id=uuid.UUID("10000000-0000-0000-0000-000000000002"),
            name="Dominator-PPO",
            version="v2.5.0-rc1",
            params_count=14_200_000,
            git_sha="b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
            tag=ModelTag.candidate,
        )
        candidate2 = Model(
            id=uuid.UUID("10000000-0000-0000-0000-000000000003"),
            name="Dominator-SAC",
            version="v1.0.0-alpha",
            params_count=18_000_000,
            git_sha="c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
            tag=ModelTag.candidate,
        )
        db.add_all([stable_model, candidate1, candidate2])
        db.flush()
        print("  ✓ Models created (1 stable, 2 candidates)")

        # ─── Training Runs ────────────────────────────────────
        now = datetime.now(timezone.utc)
        run_completed = TrainingRun(
            id=uuid.UUID("20000000-0000-0000-0000-000000000001"),
            model_id=stable_model.id,
            status=RunStatus.completed,
            started_at=now - timedelta(days=3),
            ended_at=now - timedelta(days=2),
            config_json={"lr": 3e-4, "batch_size": 4096, "gamma": 0.99, "clip_range": 0.2, "ent_coef": 0.01},
            steps=500000,
            avg_reward=2.34,
            entropy=0.85,
            loss_pi=0.042,
            loss_v=0.18,
        )
        run_running = TrainingRun(
            id=uuid.UUID("20000000-0000-0000-0000-000000000002"),
            model_id=candidate1.id,
            status=RunStatus.running,
            started_at=now - timedelta(hours=6),
            config_json={"lr": 1e-4, "batch_size": 8192, "gamma": 0.995, "clip_range": 0.15, "ent_coef": 0.005},
            steps=187000,
            avg_reward=1.87,
            entropy=1.12,
            loss_pi=0.067,
            loss_v=0.31,
        )
        run_failed = TrainingRun(
            id=uuid.UUID("20000000-0000-0000-0000-000000000003"),
            model_id=candidate2.id,
            status=RunStatus.failed,
            started_at=now - timedelta(days=1),
            ended_at=now - timedelta(hours=20),
            config_json={"lr": 1e-3, "batch_size": 2048, "gamma": 0.98, "clip_range": 0.3, "ent_coef": 0.02},
            steps=45000,
            avg_reward=-0.12,
            entropy=2.8,
            loss_pi=0.45,
            loss_v=1.2,
        )
        db.add_all([run_completed, run_running, run_failed])
        db.flush()
        print("  ✓ Training runs created (completed, running, failed)")

        # ─── Checkpoints ─────────────────────────────────────
        all_checkpoints = []
        for run in [run_completed, run_running, run_failed]:
            max_step = run.steps or 10000
            for i in range(10):
                step = int(max_step * (i + 1) / 10)
                cp = Checkpoint(
                    run_id=run.id,
                    step=step,
                    artifact_path=f"checkpoints/{run.id}/step_{step}.pt",
                )
                all_checkpoints.append(cp)
                db.add(cp)
        db.flush()
        print(f"  ✓ {len(all_checkpoints)} checkpoints created")

        # ─── Eval Suites ──────────────────────────────────────
        suite_1v1 = EvalSuite(
            id=uuid.UUID("30000000-0000-0000-0000-000000000001"),
            name="1v1_ladder_v1",
            definition_json={
                "format": "1v1",
                "num_games": 100,
                "opponents": ["built-in-allstar", "built-in-nexto"],
                "metrics": ["win_rate", "goals_for", "goals_against", "avg_shot_quality"],
            },
        )
        suite_3v3 = EvalSuite(
            id=uuid.UUID("30000000-0000-0000-0000-000000000002"),
            name="3v3_scrim_v1",
            definition_json={
                "format": "3v3",
                "num_games": 50,
                "opponents": ["self-play-pool"],
                "metrics": ["win_rate", "kickoff_loss_rate", "boost_starve_rate", "last_man_overcommit_rate"],
            },
        )
        db.add_all([suite_1v1, suite_3v3])
        db.flush()
        print("  ✓ Eval suites created")

        # ─── Eval Results ─────────────────────────────────────
        # Stable model evals (good)
        stable_cps = [cp for cp in all_checkpoints if cp.run_id == run_completed.id]
        if stable_cps:
            stable_eval = EvalResult(
                checkpoint_id=stable_cps[-1].id,
                suite_id=suite_1v1.id,
                win_rate=0.72,
                goals_for=2.8,
                goals_against=1.1,
                kickoff_loss_rate=0.18,
                concede_open_net_rate=0.05,
                own_goal_rate=0.01,
                avg_shot_quality=0.74,
                last_man_overcommit_rate=0.08,
                boost_starve_rate=0.22,
                passed_gates=True,
                status="completed",
                deltas_json={},
            )
            db.add(stable_eval)

        # Candidate evals (mixed)
        cand_cps = [cp for cp in all_checkpoints if cp.run_id == run_running.id]
        if cand_cps:
            cand_eval = EvalResult(
                checkpoint_id=cand_cps[-1].id,
                suite_id=suite_1v1.id,
                win_rate=0.68,
                goals_for=2.5,
                goals_against=1.3,
                kickoff_loss_rate=0.22,
                concede_open_net_rate=0.07,
                own_goal_rate=0.02,
                avg_shot_quality=0.69,
                last_man_overcommit_rate=0.12,
                boost_starve_rate=0.28,
                passed_gates=True,
                status="completed",
                deltas_json={
                    "win_rate": -0.04,
                    "goals_for": -0.3,
                    "goals_against": 0.2,
                },
            )
            db.add(cand_eval)
        db.flush()
        print("  ✓ Eval results created")

        # ─── Training Sessions ────────────────────────────────
        modes = ["defense", "shooting", "possession", "50/50s"]
        difficulties = ["gold", "plat", "diamond", "champ"]
        styles = ["passive", "aggro", "counter"]

        for i in range(5):
            session = TrainingSession(
                user_id=player.id,
                mode=modes[i % len(modes)],
                difficulty=difficulties[i % len(difficulties)],
                opponent_style=styles[i % len(styles)],
                started_at=now - timedelta(hours=i * 4 + 1),
                ended_at=now - timedelta(hours=i * 4),
                score_json={"player": random.randint(1, 5), "opponent": random.randint(0, 3)},
                summary_json={
                    "insights": [
                        {"title": "Great positioning", "detail": "You maintained backpost rotation 85% of the time.", "type": "positive"},
                        {"title": "Boost management", "detail": "Average boost level was 42 — solid for this difficulty.", "type": "positive"},
                        {"title": "Aerial commitment", "detail": "2 over-commits on aerial challenges. Stay grounded more.", "type": "warning"},
                    ],
                    "recommended_drill": {
                        "name": "Shadow Defense Fundamentals",
                        "mode": "defense",
                        "difficulty": difficulties[i % len(difficulties)],
                        "duration_min": 5,
                        "focus": "patience and tracking",
                    },
                },
            )
            db.add(session)
            db.flush()

            # Add events
            event_types = ["goal_scored", "goal_conceded", "save", "shot", "boost_pickup", "demo", "bookmark"]
            for j in range(random.randint(8, 20)):
                evt = SessionEvent(
                    session_id=session.id,
                    t_ms=random.randint(0, 300000),
                    type=random.choice(event_types),
                    payload_json={"value": random.uniform(0, 1)},
                )
                db.add(evt)

        db.flush()
        print("  ✓ Training sessions + events created")

        # ─── Artifacts ────────────────────────────────────────
        artifact_kinds = ["checkpoint", "log", "tensorboard", "config"]
        for i in range(8):
            art = Artifact(
                kind=artifact_kinds[i % len(artifact_kinds)],
                path=f"artifacts/demo_{i}.{'pt' if i % 2 == 0 else 'jsonl'}",
                metadata_json={"run_id": str(run_completed.id), "size_mb": random.randint(5, 500)},
            )
            db.add(art)
        db.flush()
        print("  ✓ Artifacts created")

        db.commit()
        print("\n✅ Demo data seeded successfully!")
        print("   Admin login: admin@dominator.gg / admin123")
        print("   Player login: player@dominator.gg / player123")


if __name__ == "__main__":
    seed()
