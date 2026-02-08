#!/usr/bin/env python3
"""
Simulate a training run by generating JSONL log data and writing it to a file.
Usage: python scripts/simulate_training_run.py [output_path]
"""
import json
import random
import sys
import os


def simulate(output_path: str = "data/artifacts/simulated_run.jsonl"):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    entries = []

    # Status: running
    entries.append({"type": "status", "status": "running", "timestamp": "2024-01-15T10:00:00Z"})

    # Simulate 500 steps of metrics
    for step in range(0, 500001, 1000):
        progress = step / 500000
        entries.append({
            "type": "metrics",
            "step": step,
            "avg_reward": round(-0.5 + 3.0 * progress + random.gauss(0, 0.2), 4),
            "entropy": round(max(0.1, 2.0 - 1.5 * progress + random.gauss(0, 0.1)), 4),
            "loss_pi": round(max(0.01, 0.5 - 0.4 * progress + random.gauss(0, 0.02)), 4),
            "loss_v": round(max(0.01, 1.0 - 0.8 * progress + random.gauss(0, 0.05)), 4),
        })

        # Checkpoint every 50k steps
        if step > 0 and step % 50000 == 0:
            entries.append({
                "type": "checkpoint",
                "step": step,
                "path": f"checkpoints/sim_run/step_{step}.pt",
            })

    # Status: completed
    entries.append({"type": "status", "status": "completed", "timestamp": "2024-01-15T18:00:00Z"})

    with open(output_path, "w") as f:
        for entry in entries:
            f.write(json.dumps(entry) + "\n")

    print(f"✅ Simulated training run written to {output_path}")
    print(f"   {len(entries)} entries, 10 checkpoints")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "data/artifacts/simulated_run.jsonl"
    simulate(path)
