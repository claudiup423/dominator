"""
DominanceBot Agent v1.3.2 -- Auto-detects goals, saves, demos, match end.
Uses RLBot v5 MatchManager + live packet reading.

Requirements: pip install rlbot --pre requests
Run:    python agent.py
Build:  pyinstaller --onefile --name DominanceBot agent.py
"""

import sys, os, time, json, signal, logging, argparse, threading, subprocess
from pathlib import Path
import requests

VERSION = "1.3.2"
API_URL = os.environ.get("DOMINANCEBOT_API", "http://100.89.134.116:8000")
POLL_INTERVAL = 3
HEARTBEAT_INTERVAL = 15

DATA_DIR = Path(os.environ.get("APPDATA", Path.home())) / "DominanceBot"
TOKEN_FILE = DATA_DIR / "token.json"
TOML_DIR = DATA_DIR / "match"
BOT_PROJECT = Path(os.environ.get("DOMINANCEBOT_PROJECT", "E:/DominanceBot_v2"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [DominanceBot] %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger(__name__)

SKILL_MAP = {
    "bronze": 0.0, "silver": 0.2, "gold": 0.4, "platinum": 0.55,
    "diamond": 0.7, "champion": 0.85, "grand_champion": 0.95, "ssl": 1.0,
}

LOCK_FILE = DATA_DIR / "agent.lock"


# -- Single-instance lock (Windows-safe) --

def _pid_is_running(pid: int) -> bool:
    if pid <= 0:
        return False
    if sys.platform == "win32":
        try:
            out = subprocess.check_output(
                ["cmd.exe", "/c", f'tasklist /FI "PID eq {pid}"'],
                stderr=subprocess.STDOUT,
                text=True,
            )
            return str(pid) in out
        except Exception:
            return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def acquire_single_instance_lock():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(str(LOCK_FILE), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        os.write(fd, str(os.getpid()).encode("utf-8"))
        os.close(fd)
        return
    except FileExistsError:
        pass

    try:
        pid = int(LOCK_FILE.read_text().strip() or "0")
    except Exception:
        pid = 0

    if _pid_is_running(pid):
        raise SystemExit(f"Another DominanceBot agent instance is already running (pid={pid}).")

    try:
        LOCK_FILE.unlink()
    except Exception:
        pass

    fd = os.open(str(LOCK_FILE), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    os.write(fd, str(os.getpid()).encode("utf-8"))
    os.close(fd)


def release_single_instance_lock():
    try:
        if LOCK_FILE.exists():
            LOCK_FILE.unlink()
    except Exception:
        pass


# -- API Client --

class CloudAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url.rstrip("/")
        self.s = requests.Session()
        self.s.headers.update({"X-Agent-Token": token, "Content-Type": "application/json"})
        self.timeout = 10

    def poll(self):
        r = self.s.get(f"{self.base_url}/api/agent/poll", timeout=self.timeout)
        r.raise_for_status()
        return r.json()

    def heartbeat(self):
        r = self.s.post(f"{self.base_url}/api/agent/heartbeat", timeout=self.timeout)
        r.raise_for_status()

    def send_event(self, sid, t_ms, etype, payload=None):
        try:
            r = self.s.post(
                f"{self.base_url}/api/agent/event",
                json={"session_id": sid, "t_ms": t_ms, "type": etype, "payload_json": payload or {}},
                timeout=self.timeout,
            )
            r.raise_for_status()
        except Exception as e:
            log.warning(f"Event send failed: {e}")

    def complete_match(self, sid, ps, os_):
        r = self.s.post(
            f"{self.base_url}/api/agent/complete",
            json={"session_id": sid, "player_score": ps, "opponent_score": os_},
            timeout=self.timeout,
        )
        r.raise_for_status()
        return r.json()


# -- TOML Generator --

def write_match_toml(config):
    TOML_DIR.mkdir(parents=True, exist_ok=True)
    diff = config.get("difficulty", "gold")
    skill = SKILL_MAP.get(diff, 0.4)

    bot_toml = BOT_PROJECT / "src" / "ppo" / "bot.toml"
    use_custom_bot = bot_toml.exists()

    if use_custom_bot:
        bot_toml_path = str(bot_toml).replace("\\", "/")
        toml = f"""[rlbot]
launcher = "epic"
auto_start_bots = true

[match]
game_mode = "Soccer"
game_map = "DFH_Stadium_P"
skip_replays = true
instant_start = true
enable_rendering = true

[[cars]]
toml = "{bot_toml_path}"
team = 0
name = "DominanceBot"

[[cars]]
type = "human"
team = 1
name = "Player"
"""
    else:
        toml = f"""[rlbot]
launcher = "epic"
auto_start_bots = true

[match]
game_mode = "Soccer"
game_map = "DFH_Stadium_P"
skip_replays = true
instant_start = true
enable_rendering = true

[[cars]]
type = "psyonix"
team = 0
skill = {skill}
name = "Bot ({diff.capitalize()})"

[[cars]]
type = "human"
team = 1
name = "Player"
"""

    p = (TOML_DIR / "match.toml").resolve()
    p.write_text(toml, encoding="utf-8")
    return p


# -- Agent --

class Agent:
    def __init__(self, api: CloudAPI):
        self.api = api
        self.running = True
        self.mm = None
        self._in_match = False

    def stop(self):
        self.running = False
        self._in_match = False
        if self.mm:
            try:
                self.mm.shut_down()
            except Exception:
                pass

    def _hb_loop(self):
        while self.running:
            try:
                self.api.heartbeat()
            except Exception:
                pass
            time.sleep(HEARTBEAT_INTERVAL)

    def launch_match(self, session_id, config):
        if self._in_match:
            log.warning("Match already running; ignoring start.")
            return
        self._in_match = True

        log.info("=== LAUNCHING MATCH ===")
        log.info(f"  Difficulty: {config.get('difficulty', '?')} | Style: {config.get('opponent_style', '?')}")
        toml_path = write_match_toml(config)

        try:
            from rlbot.managers.match import MatchManager
            import rlbot_flatbuffers as flat

            self.mm = MatchManager()

            # 1) Start server
            print("[DBG] ensure_server_started...", flush=True)
            self.mm.ensure_server_started()

            # 2) Connect with match communications so we get packets
            print("[DBG] connect_and_run...", flush=True)
            if not self.mm.rlbot_interface.is_connected:
                self.mm.connect_and_run(
                    wants_match_communications=True,
                    wants_ball_predictions=False,
                    close_between_matches=False,
                    background_thread=True,
                )

            # 3) Start match
            print("[DBG] start_match...", flush=True)
            self.mm.rlbot_interface.start_match(toml_path)

            # 4) CRITICAL: Send InitComplete so packets start flowing
            print("[DBG] sending InitComplete...", flush=True)
            if not self.mm.initialized:
                self.mm.rlbot_interface.send_msg(flat.InitComplete())
                self.mm.initialized = True

            # 5) Wait for first packet
            print("[DBG] wait_for_first_packet...", flush=True)
            self.mm.wait_for_first_packet()
            print("[DBG] First packet received!", flush=True)

            print("  ========================================")
            print("   Rocket League is running!")
            print("   Play your match. Events are tracked")
            print("   automatically - goals, saves, demos.")
            print("  ========================================")
            sys.stdout.flush()

            match_start = time.time()
            t_ms = lambda: int((time.time() - match_start) * 1000)

            self.api.send_event(session_id, 0, "match_start", {
                "difficulty": config.get("difficulty"),
                "style": config.get("opponent_style"),
            })

            prev = {"pg": 0, "og": 0, "ps": 0, "os": 0, "psh": 0, "pd": 0, "od": 0}
            events_sent = 0
            seen_active = False
            prev_phase = None
            match_ended = False
            player_score = 0
            opponent_score = 0

            # Wait for match to actually begin (skip stale Inactive/Ended)
            print("[DBG] Waiting for match to begin...", flush=True)
            wait_start = time.time()
            match_started = False
            while not match_started and self.running and (time.time() - wait_start) < 120:
                time.sleep(0.5)
                packet = self.mm.packet
                if not packet:
                    continue
                phase = packet.match_info.match_phase
                if phase not in (flat.MatchPhase.Inactive, flat.MatchPhase.Ended):
                    match_started = True
                    print(f"[DBG] Match started! Phase: {phase}", flush=True)

            if not match_started:
                log.warning("Timed out waiting for match to start")

            stop_check_counter = 0
            print(f"[DBG] Entering main tracking loop, running={self.running}", flush=True)

            while not match_ended and self.running:
                time.sleep(0.5)

                # Check for website stop signal every ~3s
                stop_check_counter += 1
                if stop_check_counter >= 6:
                    stop_check_counter = 0
                    try:
                        poll_resp = self.api.poll()
                        cmd = poll_resp.get("command", "idle")
                        if cmd != "idle":
                            print(f"[DBG] Poll: {poll_resp}", flush=True)
                        if cmd == "stop_match" and poll_resp.get("session_id") == session_id:
                            log.info("Stop signal received from website!")
                            match_ended = True
                            continue
                    except Exception as e:
                        log.warning(f"Poll check failed: {e}")

                packet = self.mm.packet
                if not packet:
                    continue

                phase = packet.match_info.match_phase

                # Read player stats (human=team 1, bot=team 0)
                pg = og = ps = os_ = psh = pd = od = 0
                for player in packet.players:
                    si = player.score_info
                    if player.team == 1:  # human (orange)
                        pg, ps, psh, pd = si.goals, si.saves, si.shots, si.demolitions
                    elif player.team == 0:  # bot (blue)
                        og, os_, _, od = si.goals, si.saves, si.shots, si.demolitions

                player_score, opponent_score = pg, og

                # Detect events by comparing to previous state
                if pg > prev["pg"]:
                    self.api.send_event(session_id, t_ms(), "goal_scored", {"score": f"{pg}-{og}"})
                    log.info(f"  GOAL! You scored! ({pg}-{og})")
                    events_sent += 1

                if og > prev["og"]:
                    self.api.send_event(session_id, t_ms(), "goal_conceded", {"score": f"{pg}-{og}"})
                    log.info(f"  Goal conceded ({pg}-{og})")
                    events_sent += 1

                if ps > prev["ps"]:
                    self.api.send_event(session_id, t_ms(), "save", {"by": "player"})
                    log.info(f"  Save!")
                    events_sent += 1

                if os_ > prev["os"]:
                    self.api.send_event(session_id, t_ms(), "save", {"by": "opponent"})
                    events_sent += 1

                if psh > prev["psh"]:
                    self.api.send_event(session_id, t_ms(), "shot", {"by": "player"})
                    events_sent += 1

                if pd > prev["pd"]:
                    self.api.send_event(session_id, t_ms(), "demo", {"by": "player"})
                    log.info(f"  Demo!")
                    events_sent += 1

                if od > prev["od"]:
                    self.api.send_event(session_id, t_ms(), "demo", {"by": "opponent"})
                    log.info(f"  You got demo'd!")
                    events_sent += 1

                prev = {"pg": pg, "og": og, "ps": ps, "os": os_, "psh": psh, "pd": pd, "od": od}

                # Track Active phase
                if phase == flat.MatchPhase.Active:
                    seen_active = True

                # Detect match end (only after Active has been seen)
                if seen_active and phase == flat.MatchPhase.Ended and prev_phase != flat.MatchPhase.Ended:
                    match_ended = True
                    result = "win" if pg > og else "loss" if pg < og else "draw"
                    self.api.send_event(session_id, t_ms(), "match_end", {
                        "final_score": f"{pg}-{og}",
                        "result": result,
                        "player_saves": ps,
                        "player_shots": psh,
                        "player_demos": pd,
                        "opponent_saves": os_,
                        "opponent_demos": od,
                    })
                    print(f"\n  ========================================")
                    print(f"   MATCH OVER: {pg} - {og} ({result.upper()})")
                    print(f"   Shots: {psh} | Saves: {ps} | Demos: {pd}")
                    print(f"   Events tracked: {events_sent}")
                    print(f"  ========================================\n")
                    sys.stdout.flush()

                prev_phase = phase

            # Report final score
            print(f"[DBG] Match loop exited. Score: {player_score}-{opponent_score}, events={events_sent}", flush=True)
            try:
                result = "win" if player_score > opponent_score else "loss" if player_score < opponent_score else "draw"
                self.api.complete_match(session_id, player_score, opponent_score)
                log.info(f"Match reported! Final {player_score}-{opponent_score} ({result}). Events={events_sent}")
            except Exception as e:
                log.error(f"Failed to report match: {e}")

        except Exception as e:
            log.error(f"Launch failed: {e}")
            import traceback
            traceback.print_exc()
            sys.stdout.flush()
        finally:
            self._in_match = False
            if self.mm:
                try:
                    self.mm.shut_down()
                except Exception:
                    pass
                self.mm = None

    def run(self):
        log.info(f"DominanceBot Agent v{VERSION}")
        log.info(f"API: {self.api.base_url}")
        log.info("Waiting for match commands...")
        log.info("(Click 'Launch Match' on the website)")
        print()

        threading.Thread(target=self._hb_loop, daemon=True).start()

        while self.running:
            try:
                resp = self.api.poll()
                if resp.get("command") == "start_match":
                    sid = resp["session_id"]
                    cfg = resp["config"]
                    log.info(f"Match command received! Session: {sid[:8]}...")
                    self.launch_match(sid, cfg)
                    log.info("Ready for next match...\n")
            except requests.ConnectionError:
                log.warning("Server unreachable -- retrying in 10s...")
                time.sleep(10)
                continue
            except Exception as e:
                log.error(f"Error: {e}")

            time.sleep(POLL_INTERVAL)


# -- Auth --

def save_token(token, api_url):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    TOKEN_FILE.write_text(json.dumps({"token": token, "api_url": api_url}))

def load_token():
    if TOKEN_FILE.exists():
        try:
            d = json.loads(TOKEN_FILE.read_text())
            return d["token"], d.get("api_url", API_URL)
        except Exception:
            pass
    return None

def login_prompt():
    print("=" * 50)
    print(f"  DominanceBot Agent v{VERSION}")
    print("=" * 50)
    print()
    api_url = input(f"API URL [{API_URL}]: ").strip() or API_URL
    email = input("Email: ").strip()
    password = input("Password: ").strip()
    r = requests.post(f"{api_url}/api/auth/login", json={"email": email, "password": password}, timeout=10)
    r.raise_for_status()
    data = r.json()
    save_token(data["access_token"], api_url)
    print(f"\n  Logged in as {data['user']['email']}")
    return data["access_token"], api_url


def main():
    parser = argparse.ArgumentParser(description="DominanceBot Agent")
    parser.add_argument("--token", help="Access token")
    parser.add_argument("--api-url", default=API_URL)
    parser.add_argument("--logout", action="store_true")
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    acquire_single_instance_lock()

    try:
        if args.logout:
            if TOKEN_FILE.exists():
                TOKEN_FILE.unlink()
            print("Logged out.")
            return

        if args.token:
            token, api_url = args.token, args.api_url
        else:
            saved = load_token()
            if saved:
                token, api_url = saved
                log.info("Using saved login")
            else:
                token, api_url = login_prompt()

        api = CloudAPI(api_url, token)
        api.heartbeat()
        log.info("Connected to server")

        agent = Agent(api)

        signal.signal(signal.SIGINT, lambda s, f: agent.stop())
        if sys.platform == "win32" and hasattr(signal, "SIGBREAK"):
            signal.signal(signal.SIGBREAK, signal.SIG_IGN)

        agent.run()

    finally:
        release_single_instance_lock()
        log.info("Stopped.")


if __name__ == "__main__":
    main()