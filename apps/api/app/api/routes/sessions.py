from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
from datetime import datetime, timezone
import logging

from app.db.session import get_db
from app.db.models import TrainingSession, SessionEvent, User
from app.schemas import (
    SessionStartRequest, SessionEndRequest, SessionEventCreate,
    SessionResponse, SessionEventResponse, SessionSummary,
)
from app.middleware.auth import get_current_user
from app.core.config import get_settings
from app.services.coach import CoachService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


def _get_coach() -> CoachService:
    settings = get_settings()
    return CoachService(base_url=settings.OLLAMA_URL, model=settings.OLLAMA_MODEL)


@router.post("/start", response_model=SessionResponse, status_code=201)
async def start_session(body: SessionStartRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    session = TrainingSession(
        user_id=user.id,
        mode=body.mode.value,
        difficulty=body.difficulty.value,
        opponent_style=body.opponent_style.value,
        opponent_model_id=body.opponent_model_id,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return SessionResponse.model_validate(session)


@router.post("/{session_id}/event", response_model=SessionEventResponse, status_code=201)
async def add_event(session_id: UUID, body: SessionEventCreate, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(select(TrainingSession).where(TrainingSession.id == session_id, TrainingSession.user_id == user.id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    event = SessionEvent(
        session_id=session_id,
        t_ms=body.t_ms,
        type=body.type,
        payload_json=body.payload_json,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return SessionEventResponse.model_validate(event)


@router.post("/{session_id}/end", response_model=SessionResponse)
async def end_session(session_id: UUID, body: SessionEndRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(TrainingSession)
        .options(selectinload(TrainingSession.events))
        .where(TrainingSession.id == session_id, TrainingSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.ended_at = datetime.now(timezone.utc)
    session.score_json = body.score_json

    # Compute duration
    duration_seconds = 0.0
    if session.started_at:
        duration_seconds = (session.ended_at - session.started_at).total_seconds()

    # Gather event dicts for analysis
    event_dicts = [{"t_ms": e.t_ms, "type": e.type, "payload_json": e.payload_json} for e in session.events]

    # Generate coaching summary via LLM (or fallback)
    coach = _get_coach()
    coaching = await coach.analyze_match(
        events=event_dicts,
        score=body.score_json,
        mode=session.mode,
        difficulty=session.difficulty,
        opponent_style=session.opponent_style,
        duration_seconds=duration_seconds,
    )

    if coaching is None:
        logger.info("LLM unavailable, using rule-based fallback for session %s", session_id)
        coaching = coach.generate_fallback(
            events=event_dicts,
            score=body.score_json,
            mode=session.mode,
            difficulty=session.difficulty,
            opponent_style=session.opponent_style,
            duration_seconds=duration_seconds,
        )

    session.summary_json = coaching

    await db.commit()
    await db.refresh(session)
    return SessionResponse.model_validate(session)


@router.get("", response_model=List[SessionResponse])
async def list_sessions(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(TrainingSession)
        .where(TrainingSession.user_id == user.id)
        .order_by(TrainingSession.started_at.desc())
        .limit(50)
    )
    return [SessionResponse.model_validate(s) for s in result.scalars().all()]


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(session_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(TrainingSession).where(TrainingSession.id == session_id, TrainingSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionResponse.model_validate(session)


@router.get("/{session_id}/summary", response_model=SessionSummary)
async def get_summary(session_id: UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    result = await db.execute(
        select(TrainingSession)
        .options(selectinload(TrainingSession.events))
        .where(TrainingSession.id == session_id, TrainingSession.user_id == user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    events = [SessionEventResponse.model_validate(e) for e in session.events]

    # If summary already generated (from end_session), use it
    # Otherwise regenerate (for sessions ended without the new flow)
    summary = session.summary_json
    if not summary or "insights" not in summary:
        duration_seconds = 0.0
        if session.started_at and session.ended_at:
            duration_seconds = (session.ended_at - session.started_at).total_seconds()

        event_dicts = [{"t_ms": e.t_ms, "type": e.type, "payload_json": e.payload_json} for e in session.events]

        coach = _get_coach()
        summary = await coach.analyze_match(
            events=event_dicts,
            score=session.score_json or {},
            mode=session.mode,
            difficulty=session.difficulty,
            opponent_style=session.opponent_style,
            duration_seconds=duration_seconds,
        )

        if summary is None:
            summary = coach.generate_fallback(
                events=event_dicts,
                score=session.score_json or {},
                mode=session.mode,
                difficulty=session.difficulty,
                opponent_style=session.opponent_style,
                duration_seconds=duration_seconds,
            )

        # Cache it
        session.summary_json = summary
        await db.commit()

    return SessionSummary(
        session=SessionResponse.model_validate(session),
        events=events,
        insights=summary.get("insights", []),
        recommended_drill=summary.get("recommended_drill", {}),
    )