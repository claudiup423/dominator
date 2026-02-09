"""
Match Launcher — Starts a Rocket League match with DominanceBot loaded.

This service:
1. Writes an rlbot.toml match config for the selected checkpoint + settings
2. Starts RLBotServer (the v5 core that talks to Rocket League)
3. Starts the bot process (loads the PPO model from checkpoint)
4. Rocket League opens with -rlbot flag, player plays in-game

Prerequisites:
- RLBotServer.exe in BOT_DIR (download from https://github.com/RLBot/core/releases)
- pip install rlbot (the v5 python interface)
- Rocket League installed (Steam or Epic)

Set these env vars:
  BOT_DIR         = path to bot folder (default: ./bot)
  CHECKPOINTS_DIR = path to saved checkpoints (default: ./data/checkpoints)
"""

import os
import sys
import json
import signal
import asyncio
import subprocess
import logging
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

BOT_DIR = Path(os.environ.get("BOT_DIR", "./bot"))
CHECKPOINTS_DIR = Path(os.environ.get("CHECKPOINTS_DIR", "./data/checkpoints"))


class MatchState:
    """Tracks the currently running match."""
    def __init__(self):
        self.active = False
        self.session_id: Optional[str] = None
        self.rlbot_process: Optional[subprocess.Popen] = None
        self.bot_process: Optional[subprocess.Popen] = None
        self.reporter_process: Optional[subprocess.Popen] = None
        self.started_at: Optional[datetime] = None
        self.config: dict = {}

    def to_dict(self):
        return {
            "active": self.active,
            "session_id": self.session_id,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "config": self.config,
        }


# Global match state
_match = MatchState()


def _write_match_toml(checkpoint_path: Optional[str], difficulty: str, opponent_style: str) -> Path:
    """
    Generate an rlbot.toml that sets up:
    - 1 human player (the user, team 0 / blue)
    - 1 bot (DominanceBot, team 1 / orange)
    """
    # Map difficulty to bot settings (you can make the bot play at different levels)
    bot_name = f"DominanceBot ({difficulty.capitalize()})"

    # Bot run command — this starts the Python bot that loads the PPO model
    bot_run_cmd = f"{sys.executable} bot.py"
    if checkpoint_path:
        bot_run_cmd += f" --checkpoint \"{checkpoint_path}\""

    toml_content = f"""# Auto-generated match config by DominanceBot platform
# Generated: {datetime.now(timezone.utc).isoformat()}

[rlbot]
launcher = "Steam"
auto_start_agents = true
wait_for_agents = true

[match]
skip_replays = false
start_without_countdown = false
existing_match_behavior = "Restart"
game_mode = "Soccer"
game_map = "Stadium_P"

# Mutators (default = standard ranked settings)
[mutators]
match_length = "5 Minutes"
max_score = "Unlimited"
overtime = "Unlimited"
series_length = "Unlimited"
game_speed = "Default"
ball_max_speed = "Default"
ball_type = "Default"
ball_weight = "Default"
ball_size = "Default"
ball_bounciness = "Default"
boost_amount = "Default"
rumble = "None"
boost_strength = "1x"
gravity = "Default"
demolish = "Default"
respawn_time = "3 Seconds"

# Player (human)
[[cars]]
name = "Player"
team = 0
type = "human"

# DominanceBot
[[cars]]
name = "{bot_name}"
team = 1
type = "rlbot"
agent_id = "dominancebot"
run_command = "{bot_run_cmd}"
"""

    toml_path = BOT_DIR / "match.toml"
    toml_path.parent.mkdir(parents=True, exist_ok=True)
    toml_path.write_text(toml_content)
    logger.info(f"Wrote match config to {toml_path}")
    return toml_path


def _write_bot_toml() -> Path:
    """Write the bot.toml config for RLBot to identify this bot."""
    toml_content = """[settings]
name = "DominanceBot"
agent_id = "dominancebot"
run_command = "python bot.py"
logo_file = "logo.png"
description = "PPO-trained RL bot from the DominanceBot training platform"
"""
    toml_path = BOT_DIR / "bot.toml"
    toml_path.parent.mkdir(parents=True, exist_ok=True)
    toml_path.write_text(toml_content)
    return toml_path


async def start_match(
    session_id: str,
    checkpoint_path: Optional[str] = None,
    difficulty: str = "gold",
    opponent_style: str = "passive",
    api_base_url: str = "http://localhost:8000",
) -> dict:
    """
    Launch a Rocket League match with DominanceBot.
    
    Args:
        session_id: The API session ID to report events to
        checkpoint_path: Path to the model checkpoint to load
        difficulty: Bot difficulty tier
        opponent_style: Bot playing style
        api_base_url: URL of the DominanceBot API for event reporting
    
    Returns:
        Match state dict
    """
    global _match

    if _match.active:
        return {"error": "A match is already running", "match": _match.to_dict()}

    logger.info(f"Starting match: session={session_id}, difficulty={difficulty}, style={opponent_style}")

    # 1. Write match config
    toml_path = _write_match_toml(checkpoint_path, difficulty, opponent_style)
    _write_bot_toml()

    _match.active = True
    _match.session_id = session_id
    _match.started_at = datetime.now(timezone.utc)
    _match.config = {
        "difficulty": difficulty,
        "opponent_style": opponent_style,
        "checkpoint_path": checkpoint_path,
    }

    try:
        # 2. Start RLBotServer (it handles launching RL + connecting to it)
        rlbot_server_path = BOT_DIR / "RLBotServer.exe"
        if not rlbot_server_path.exists():
            # Try to find it in PATH
            rlbot_server_path = "RLBotServer"

        _match.rlbot_process = subprocess.Popen(
            [str(rlbot_server_path), str(toml_path)],
            cwd=str(BOT_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
        )
        logger.info(f"RLBotServer started (PID: {_match.rlbot_process.pid})")

        # 3. Start the event reporter script (watches game, sends events to API)
        reporter_path = BOT_DIR / "event_reporter.py"
        if reporter_path.exists():
            _match.reporter_process = subprocess.Popen(
                [sys.executable, str(reporter_path),
                 "--session-id", session_id,
                 "--api-url", api_base_url],
                cwd=str(BOT_DIR),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
            )
            logger.info(f"Event reporter started (PID: {_match.reporter_process.pid})")

        return {"status": "started", "match": _match.to_dict()}

    except FileNotFoundError as e:
        _match.active = False
        logger.error(f"Failed to start match: {e}")
        return {
            "error": f"Could not find RLBotServer. Make sure RLBotServer.exe is in {BOT_DIR}",
            "detail": str(e),
        }
    except Exception as e:
        _match.active = False
        logger.error(f"Failed to start match: {e}")
        return {"error": str(e)}


async def stop_match() -> dict:
    """Stop the running match and clean up processes."""
    global _match

    if not _match.active:
        return {"status": "no_match_running"}

    logger.info("Stopping match...")

    # Kill processes gracefully
    for name, proc in [
        ("reporter", _match.reporter_process),
        ("bot", _match.bot_process),
        ("rlbot_server", _match.rlbot_process),
    ]:
        if proc and proc.poll() is None:
            try:
                if sys.platform == "win32":
                    proc.send_signal(signal.CTRL_BREAK_EVENT)
                else:
                    proc.terminate()
                proc.wait(timeout=5)
                logger.info(f"Stopped {name} process (PID: {proc.pid})")
            except subprocess.TimeoutExpired:
                proc.kill()
                logger.warning(f"Force killed {name} process (PID: {proc.pid})")
            except Exception as e:
                logger.error(f"Error stopping {name}: {e}")

    session_id = _match.session_id
    _match = MatchState()

    return {"status": "stopped", "session_id": session_id}


def get_match_status() -> dict:
    """Get current match state."""
    # Check if processes are still alive
    if _match.active:
        if _match.rlbot_process and _match.rlbot_process.poll() is not None:
            # RLBotServer died — match is over
            _match.active = False

    return _match.to_dict()