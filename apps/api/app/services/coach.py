"""
AI Coaching Service — uses a local LLM (Ollama) to generate post-match analysis.

The service:
1. Takes raw session events + score + mode/difficulty
2. Computes concrete stats from the events
3. Sends a structured prompt to Ollama
4. Parses the response into typed insights + drill recommendation

Requires Ollama running locally: https://ollama.com
Default model: mistral (7B) — fast, good at structured output
Set OLLAMA_URL and OLLAMA_MODEL env vars to customize.
"""

import json
import logging
from typing import Optional
import httpx

logger = logging.getLogger(__name__)


class CoachService:
    """Generates coaching insights from match data using a local LLM."""

    def __init__(self, base_url: str = "http://localhost:11434", model: str = "mistral"):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = 60  # LLM can be slow on first load

    async def is_available(self) -> bool:
        """Check if Ollama is reachable."""
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(f"{self.base_url}/api/tags")
                return r.status_code == 200
        except Exception:
            return False

    def _compute_stats(self, events: list[dict], score: dict, mode: str, difficulty: str, opponent_style: str, duration_seconds: float) -> dict:
        """Compute concrete stats from raw session events."""
        stats = {
            "mode": mode,
            "difficulty": difficulty,
            "opponent_style": opponent_style,
            "duration_seconds": round(duration_seconds, 1),
            "player_score": score.get("player", 0),
            "opponent_score": score.get("opponent", 0),
            "result": "win" if score.get("player", 0) > score.get("opponent", 0) else "loss" if score.get("player", 0) < score.get("opponent", 0) else "draw",
            "total_events": len(events),
        }

        # Count events by type
        type_counts: dict[str, int] = {}
        for ev in events:
            t = ev.get("type", "unknown")
            type_counts[t] = type_counts.get(t, 0) + 1

        stats["event_counts"] = type_counts
        stats["goals_scored"] = type_counts.get("goal_scored", 0)
        stats["goals_conceded"] = type_counts.get("goal_conceded", 0)
        stats["shots"] = type_counts.get("shot", 0)
        stats["saves"] = type_counts.get("save", 0)
        stats["demos"] = type_counts.get("demo", 0)
        stats["aerials"] = type_counts.get("aerial", 0)
        stats["boost_pickups"] = type_counts.get("boost_pickup", 0)
        stats["clears"] = type_counts.get("clear", 0)

        # Derived stats
        if stats["shots"] > 0:
            stats["shot_conversion_rate"] = round(stats["goals_scored"] / stats["shots"], 2)
        else:
            stats["shot_conversion_rate"] = 0.0

        # Goal timing analysis
        goal_times = [ev["t_ms"] for ev in events if ev.get("type") == "goal_scored"]
        concede_times = [ev["t_ms"] for ev in events if ev.get("type") == "goal_conceded"]
        if goal_times:
            stats["avg_goal_time_ms"] = round(sum(goal_times) / len(goal_times))
        if concede_times:
            stats["avg_concede_time_ms"] = round(sum(concede_times) / len(concede_times))

        # Activity rate (events per minute)
        if duration_seconds > 0:
            stats["events_per_minute"] = round(len(events) / (duration_seconds / 60), 1)

        return stats

    def _build_prompt(self, stats: dict) -> str:
        """Build the coaching prompt for the LLM."""
        return f"""You are an elite Rocket League coach analyzing a 1v1 training match. 
Your job is to give the player clear, specific, and actionable feedback based on their match data.

MATCH DATA:
{json.dumps(stats, indent=2)}

IMPORTANT CONTEXT:
- Mode: {stats['mode']} (the player was specifically practicing this skill)
- Difficulty: {stats['difficulty']} (this is the AI opponent's rank tier)
- Opponent style: {stats['opponent_style']}
- Result: {stats['result']} ({stats['player_score']}-{stats['opponent_score']})
- Duration: {stats['duration_seconds']:.0f} seconds

Respond with ONLY a JSON object (no markdown, no explanation) with this exact structure:
{{
  "insights": [
    {{
      "title": "Short title (max 6 words)",
      "detail": "2-3 sentences explaining what happened, why it matters, and what to do about it. Be specific — reference actual numbers from the match data. Do NOT be generic.",
      "type": "positive" | "warning" | "tip"
    }}
  ],
  "recommended_drill": {{
    "name": "Specific drill name",
    "mode": "defense" | "shooting" | "possession" | "50/50s",
    "difficulty": "{stats['difficulty']}",
    "duration_min": 5,
    "focus": "One sentence describing what this drill targets and WHY based on the match"
  }},
  "summary": "One paragraph (3-4 sentences) overall match summary. What went well, what didn't, and the single most important thing to work on next."
}}

RULES:
- Include exactly 3-5 insights
- At least 1 must be "positive" (something they did well)
- At least 1 must be "warning" (something that needs work) 
- At least 1 must be "tip" (actionable advice for improvement)
- Reference actual numbers: "You had X saves" not "Your saves were good"
- The recommended drill MUST directly address the biggest weakness shown in the data
- Be encouraging but honest. Don't sugarcoat losses.
- If they won, still find areas to improve
- If they lost, still find things they did well"""

    async def analyze_match(
        self,
        events: list[dict],
        score: dict,
        mode: str,
        difficulty: str,
        opponent_style: str,
        duration_seconds: float,
    ) -> Optional[dict]:
        """
        Generate coaching insights from match data.
        
        Returns the parsed coaching response, or None if LLM is unavailable.
        """
        stats = self._compute_stats(events, score, mode, difficulty, opponent_style, duration_seconds)
        prompt = self._build_prompt(stats)

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "user", "content": prompt}
                        ],
                        "stream": False,
                        "options": {
                            "temperature": 0.7,
                            "num_predict": 1024,
                        },
                    },
                )

                if response.status_code != 200:
                    logger.warning(f"Ollama returned {response.status_code}: {response.text[:200]}")
                    return None

                data = response.json()
                content = data.get("message", {}).get("content", "")

                # Parse JSON from response (strip any markdown fencing)
                content = content.strip()
                if content.startswith("```"):
                    content = content.split("\n", 1)[-1]
                if content.endswith("```"):
                    content = content.rsplit("```", 1)[0]
                content = content.strip()

                parsed = json.loads(content)

                # Validate structure
                if "insights" not in parsed or "recommended_drill" not in parsed:
                    logger.warning("LLM response missing required fields")
                    return None

                # Ensure correct types on insights
                for insight in parsed["insights"]:
                    if insight.get("type") not in ("positive", "warning", "tip"):
                        insight["type"] = "tip"

                return parsed

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse LLM JSON: {e}")
            return None
        except httpx.ConnectError:
            logger.warning("Ollama not reachable — falling back to static analysis")
            return None
        except Exception as e:
            logger.error(f"Coach analysis error: {e}")
            return None

    def generate_fallback(self, events: list[dict], score: dict, mode: str, difficulty: str, opponent_style: str, duration_seconds: float) -> dict:
        """
        Rule-based fallback when LLM is unavailable.
        Still uses real event data instead of random picks.
        """
        stats = self._compute_stats(events, score, mode, difficulty, opponent_style, duration_seconds)
        insights = []

        # Result-based insight
        if stats["result"] == "win":
            insights.append({
                "title": "Match won",
                "detail": f"You beat the {difficulty}-tier {opponent_style} opponent {stats['player_score']}-{stats['opponent_score']}. The match lasted {stats['duration_seconds']:.0f} seconds across {stats['total_events']} events.",
                "type": "positive",
            })
        elif stats["result"] == "loss":
            insights.append({
                "title": "Room to improve",
                "detail": f"You lost {stats['player_score']}-{stats['opponent_score']} against a {difficulty}-tier {opponent_style} opponent. Don't worry — every loss is data. Let's look at what happened.",
                "type": "warning",
            })
        else:
            insights.append({
                "title": "Close match",
                "detail": f"A {stats['player_score']}-{stats['opponent_score']} draw against a {difficulty}-tier opponent shows you're evenly matched. Small improvements will push you over the edge.",
                "type": "tip",
            })

        # Shot conversion
        if stats["shots"] > 0:
            rate = stats["shot_conversion_rate"]
            if rate >= 0.5:
                insights.append({"title": "Clinical finishing", "detail": f"You converted {rate*100:.0f}% of your {stats['shots']} shots into goals. That's elite-level efficiency — keep it up.", "type": "positive"})
            elif rate >= 0.2:
                insights.append({"title": "Shot conversion average", "detail": f"You scored on {rate*100:.0f}% of {stats['shots']} shots. Try aiming for corners and waiting for better openings to improve this.", "type": "tip"})
            else:
                insights.append({"title": "Low shot conversion", "detail": f"Only {rate*100:.0f}% of your {stats['shots']} shots found the net. Focus on shot placement — aim away from where the opponent is positioned.", "type": "warning"})

        # Saves
        if stats["saves"] > 0:
            if stats["saves"] >= stats.get("goals_conceded", 0):
                insights.append({"title": "Solid defense", "detail": f"You made {stats['saves']} saves this match. Your goalkeeping kept you in the game.", "type": "positive"})
        elif stats.get("goals_conceded", 0) > 2:
            insights.append({"title": "Defensive gaps", "detail": f"You conceded {stats['goals_conceded']} goals with {stats['saves']} saves. Work on positioning yourself between the ball and your goal.", "type": "warning"})

        # Boost management
        if stats["boost_pickups"] > 0:
            bpm = stats["boost_pickups"] / max(stats["duration_seconds"] / 60, 0.5)
            if bpm > 8:
                insights.append({"title": "Good boost control", "detail": f"You collected {stats['boost_pickups']} boost pads ({bpm:.1f}/min). Strong boost management keeps your options open.", "type": "positive"})
            else:
                insights.append({"title": "Collect more boost", "detail": f"Only {stats['boost_pickups']} boost pickups ({bpm:.1f}/min). Grab small pads on rotation — they add up fast.", "type": "tip"})

        # Ensure at least 3 insights
        if len(insights) < 3:
            insights.append({
                "title": "Keep practicing",
                "detail": f"You played a {mode} session at {difficulty} difficulty for {stats['duration_seconds']:.0f} seconds. Consistency is key — play regularly to build muscle memory.",
                "type": "tip",
            })

        # Drill recommendation based on biggest weakness
        drill_map = {
            "defense": {"name": "Shadow Defense Drill", "focus": f"Defensive positioning — you conceded {stats.get('goals_conceded', 0)} goals this match"},
            "shooting": {"name": "Power Shot Angles", "focus": f"Shot accuracy — your conversion rate was {stats['shot_conversion_rate']*100:.0f}%"},
            "possession": {"name": "Pressure Keepaway", "focus": f"Ball control under pressure from {opponent_style} opponents"},
            "50/50s": {"name": "Challenge Timing Drill", "focus": f"50/50 positioning and recovery after challenges"},
        }

        # Pick drill based on weakness
        if stats["shot_conversion_rate"] < 0.3 and stats["shots"] > 0:
            drill_key = "shooting"
        elif stats.get("goals_conceded", 0) > stats.get("goals_scored", 0):
            drill_key = "defense"
        else:
            drill_key = mode

        drill = drill_map.get(drill_key, drill_map["defense"])

        return {
            "insights": insights[:5],
            "recommended_drill": {
                "name": drill["name"],
                "mode": drill_key,
                "difficulty": difficulty,
                "duration_min": 5,
                "focus": drill["focus"],
            },
            "summary": f"{'Victory' if stats['result'] == 'win' else 'Defeat' if stats['result'] == 'loss' else 'Draw'} against a {difficulty}-tier {opponent_style} opponent ({stats['player_score']}-{stats['opponent_score']}). You recorded {stats['shots']} shots, {stats['saves']} saves, and {stats['boost_pickups']} boost pickups across {stats['duration_seconds']:.0f} seconds of play.",
        }