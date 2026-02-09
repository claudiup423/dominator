"""
Match management endpoints — cloud-hosted, agent-polling architecture.

Flow:
1. Player clicks "Launch Match" on website
2. API creates a session + a pending MatchCommand in the DB
3. Player's DominanceBot.exe agent polls GET /api/agent/poll
4. Agent picks up the command, launches RLBotServer + RL locally
5. Agent streams events back via POST /api/agent/event
6. Match ends → agent calls POST /api/agent/complete → LLM coaching runs

Two sets of endpoints:
- /api/match/*   → called by the web frontend (authenticated as user)
- /api/agent/*   → called by the desktop agent (authenticated via agent token)
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, text
from datetime import datetime, timezone
from uuid import UUID
import os

from app.db.session import get_db
from app.db.models import TrainingSession, SessionEvent, User
from app.middleware.auth import get_current_user

router = APIRouter(tags=["match"])


# ── Models ─────────────────────────────────────────────────────────

class StartMatchRequest(BaseModel):
    mode: str = "1v1"
    difficulty: str = "gold"
    opponent_style: str = "passive"
    checkpoint_path: Optional[str] = None


class MatchStatusResponse(BaseModel):
    active: bool
    session_id: Optional[str] = None
    started_at: Optional[str] = None
    config: dict = {}
    agent_connected: bool = False


class AgentEventRequest(BaseModel):
    session_id: str
    t_ms: int
    type: str
    payload_json: dict = {}


class AgentCompleteRequest(BaseModel):
    session_id: str
    player_score: int
    opponent_score: int


# ── Helpers ────────────────────────────────────────────────────────

async def _verify_agent_token(
    x_agent_token: str = Header(..., alias="X-Agent-Token"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Verify the agent token. The agent uses the user's access token
    so we can identify which user the agent belongs to.
    """
    from app.core.security import decode_token

    payload = decode_token(x_agent_token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid agent token")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def _get_pending_session(user_id: UUID, db: AsyncSession) -> Optional[TrainingSession]:
    """Find a session that's been created but not yet picked up by the agent."""
    from sqlalchemy import text
    result = await db.execute(
        select(TrainingSession).where(
            and_(
                TrainingSession.user_id == user_id,
                TrainingSession.ended_at.is_(None),
                text("summary_json->>'status' = 'pending_agent'"),
            )
        ).order_by(TrainingSession.started_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


async def _get_active_session(user_id: UUID, db: AsyncSession) -> Optional[TrainingSession]:
    """Find an active (in-progress) session."""
    result = await db.execute(
        select(TrainingSession).where(
            and_(
                TrainingSession.user_id == user_id,
                TrainingSession.ended_at.is_(None),
            )
        ).order_by(TrainingSession.started_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


async def _get_stopping_session(user_id: UUID, db: AsyncSession) -> Optional[TrainingSession]:
    """Find a session that the website has asked to stop (within last 60 seconds)."""
    from sqlalchemy import text
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=60)
    result = await db.execute(
        select(TrainingSession).where(
            and_(
                TrainingSession.user_id == user_id,
                text("summary_json->>'status' = 'stopping'"),
                TrainingSession.ended_at >= cutoff,
            )
        ).order_by(TrainingSession.started_at.desc()).limit(1)
    )
    return result.scalar_one_or_none()


# ══════════════════════════════════════════════════════════════════
# WEB FRONTEND ENDPOINTS (called by browser)
# ══════════════════════════════════════════════════════════════════

@router.post("/api/match/start")
async def api_start_match(
    body: StartMatchRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Player clicks "Launch Match" on website.
    Creates a session with status=pending_agent — the agent will pick it up.
    """
    # Check for existing active session
    active = await _get_active_session(user.id, db)
    if active:
        # If it's been stuck for more than 5 minutes, auto-cancel it
        if active.started_at:
            age = (datetime.now(timezone.utc) - active.started_at).total_seconds()
            if age > 300:  # 5 minutes
                active.ended_at = datetime.now(timezone.utc)
                if not active.score_json or active.score_json == {}:
                    active.score_json = {"player": 0, "opponent": 0}
                active.summary_json = {**(active.summary_json or {}), "status": "cancelled"}
                await db.commit()
                # Continue to create the new session
            else:
                raise HTTPException(
                    status_code=409,
                    detail=f"A match is already active (session: {active.id}). End it first.",
                )
        else:
            raise HTTPException(
                status_code=409,
                detail=f"A match is already active (session: {active.id}). End it first.",
            )

    # Clean up any old stuck "stopping" sessions for this user
    stale_result = await db.execute(
        select(TrainingSession).where(
            and_(
                TrainingSession.user_id == user.id,
                text("summary_json->>'status' = 'stopping'"),
            )
        )
    )
    for stale in stale_result.scalars().all():
        s = stale.summary_json or {}
        stale.summary_json = {**s, "status": "cancelled"}
        if not stale.ended_at:
            stale.ended_at = datetime.now(timezone.utc)
        if not stale.score_json or stale.score_json == {}:
            stale.score_json = {"player": 0, "opponent": 0}
    await db.commit()

    # Create session -- marked as waiting for the agent to pick up
    session = TrainingSession(
        user_id=user.id,
        mode=body.mode,
        difficulty=body.difficulty,
        opponent_style=body.opponent_style,
        summary_json={
            "status": "pending_agent",
            "checkpoint_path": body.checkpoint_path,
        },
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return {
        "status": "pending_agent",
        "session_id": str(session.id),
        "message": "Match queued — waiting for DominanceBot agent on your PC to pick it up.",
    }


@router.post("/api/match/stop")
async def api_stop_match(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Stop the current match. Sets status to stopping so agent can report final score.
    Also sets ended_at so the session doesn't get stuck forever."""
    session = await _get_active_session(user.id, db)
    if not session:
        raise HTTPException(status_code=404, detail="No active match")

    # Clean up any old stuck "stopping" sessions for this user
    stale_result = await db.execute(
        select(TrainingSession).where(
            and_(
                TrainingSession.user_id == user.id,
                TrainingSession.id != session.id,
                text("summary_json->>'status' = 'stopping'"),
            )
        )
    )
    for stale in stale_result.scalars().all():
        s = stale.summary_json or {}
        stale.summary_json = {**s, "status": "cancelled"}
        if not stale.ended_at:
            stale.ended_at = datetime.now(timezone.utc)
        if not stale.score_json or stale.score_json == {}:
            stale.score_json = {"player": 0, "opponent": 0}

    summary = session.summary_json or {}
    session.summary_json = {**summary, "status": "stopping"}
    session.ended_at = datetime.now(timezone.utc)
    if not session.score_json or session.score_json == {}:
        session.score_json = {"player": 0, "opponent": 0}
    await db.commit()

    return {"status": "stopping", "session_id": str(session.id)}


@router.get("/api/match/status", response_model=MatchStatusResponse)
async def api_match_status(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Check if there's an active match."""
    session = await _get_active_session(user.id, db)
    if not session:
        return MatchStatusResponse(active=False)

    summary = session.summary_json or {}
    return MatchStatusResponse(
        active=True,
        session_id=str(session.id),
        started_at=session.started_at.isoformat() if session.started_at else None,
        config={
            "mode": session.mode,
            "difficulty": session.difficulty,
            "opponent_style": session.opponent_style,
        },
        agent_connected=summary.get("status") in ("agent_picked_up", "in_progress", "stopping"),
    )


# ══════════════════════════════════════════════════════════════════
# AGENT ENDPOINTS (called by DominanceBot.exe on player's PC)
# ══════════════════════════════════════════════════════════════════

@router.get("/api/agent/poll")
async def agent_poll(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_verify_agent_token),
):
    """
    Agent polls this every 2-3 seconds.
    Returns a match command if the player clicked "Launch Match" on the website.
    """
    import logging
    logger = logging.getLogger("match.poll")

    session = await _get_pending_session(user.id, db)

    if not session:
        # Also check if there's a session being stopped by the website
        stopping = await _get_stopping_session(user.id, db)
        if stopping:
            logger.info(f"Returning stop_match for session {stopping.id}")
            return {"command": "stop_match", "session_id": str(stopping.id)}
        return {"command": "idle"}

    # Mark as picked up
    summary = session.summary_json or {}
    checkpoint_path = summary.get("checkpoint_path")
    session.summary_json = {**summary, "status": "agent_picked_up"}
    await db.commit()

    return {
        "command": "start_match",
        "session_id": str(session.id),
        "config": {
            "mode": session.mode,
            "difficulty": session.difficulty,
            "opponent_style": session.opponent_style,
            "checkpoint_path": checkpoint_path,
        },
    }


@router.post("/api/agent/heartbeat")
async def agent_heartbeat(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_verify_agent_token),
):
    """Agent sends this periodically to confirm it's still connected."""
    session = await _get_active_session(user.id, db)
    if session:
        summary = session.summary_json or {}
        current_status = summary.get("status", "")
        # Don't overwrite "stopping" — the website wants the match to end
        if current_status != "stopping":
            summary["status"] = "in_progress"
        summary["last_heartbeat"] = datetime.now(timezone.utc).isoformat()
        session.summary_json = summary
        await db.commit()

    return {"status": "ok"}


@router.post("/api/agent/event")
async def agent_event(
    body: AgentEventRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_verify_agent_token),
):
    """Agent reports a game event (goal, save, demo, boost, etc.)."""
    # Verify session belongs to user
    result = await db.execute(
        select(TrainingSession).where(
            and_(
                TrainingSession.id == UUID(body.session_id),
                TrainingSession.user_id == user.id,
            )
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    event = SessionEvent(
        session_id=session.id,
        t_ms=body.t_ms,
        type=body.type,
        payload_json=body.payload_json,
    )
    db.add(event)
    await db.commit()

    return {"status": "ok", "event_id": str(event.id)}


@router.post("/api/agent/complete")
async def agent_complete(
    body: AgentCompleteRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(_verify_agent_token),
):
    """Agent reports match is over. Triggers LLM coaching analysis."""
    result = await db.execute(
        select(TrainingSession).where(
            and_(
                TrainingSession.id == UUID(body.session_id),
                TrainingSession.user_id == user.id,
            )
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Always update score and ended_at, even if website already clicked stop
    session.ended_at = datetime.now(timezone.utc)
    session.score_json = {
        "player": body.player_score,
        "opponent": body.opponent_score,
    }

    # Run LLM coaching analysis
    try:
        from app.services.coach import CoachService

        # Load events
        events_result = await db.execute(
            select(SessionEvent)
            .where(SessionEvent.session_id == session.id)
            .order_by(SessionEvent.t_ms)
        )
        events = events_result.scalars().all()

        coach = CoachService()
        duration_s = (session.ended_at - session.started_at).total_seconds() if session.started_at else 300
        analysis = await coach.analyze_match(
            events=[{"t_ms": e.t_ms, "type": e.type, "payload_json": e.payload_json} for e in events],
            score=session.score_json,
            mode=session.mode,
            difficulty=session.difficulty,
            opponent_style=session.opponent_style,
            duration_s=duration_s,
        )
        session.summary_json = {**analysis, "status": "completed"}
    except Exception as e:
        session.summary_json = {"status": "completed", "error": str(e)}

    await db.commit()

    return {
        "status": "completed",
        "session_id": str(session.id),
        "score": session.score_json,
    }