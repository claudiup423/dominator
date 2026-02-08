from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
from datetime import datetime, timezone
import random

from app.db.session import get_db
from app.db.models import TrainingSession, SessionEvent, User
from app.schemas import (
    SessionStartRequest, SessionEndRequest, SessionEventCreate,
    SessionResponse, SessionEventResponse, SessionSummary,
)
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


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
    result = await db.execute(select(TrainingSession).where(TrainingSession.id == session_id, TrainingSession.user_id == user.id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.ended_at = datetime.now(timezone.utc)
    session.score_json = body.score_json

    # Generate summary
    session.summary_json = _generate_summary(session.mode, session.difficulty, body.score_json)

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
    summary = session.summary_json or _generate_summary(session.mode, session.difficulty, session.score_json)

    return SessionSummary(
        session=SessionResponse.model_validate(session),
        events=events,
        insights=summary.get("insights", []),
        recommended_drill=summary.get("recommended_drill", {}),
    )


def _generate_summary(mode: str, difficulty: str, score_json: dict) -> dict:
    insight_pool = {
        "defense": [
            {"title": "Shadow defense improved", "detail": "You tracked the ball carrier 23% more effectively than last session.", "type": "positive"},
            {"title": "Last-man overcommits", "detail": "3 instances where you challenged too early as last defender.", "type": "warning"},
            {"title": "Recovery speed", "detail": "Average recovery time to net: 2.1s — faster than your baseline.", "type": "positive"},
        ],
        "shooting": [
            {"title": "Shot placement elite", "detail": "78% of shots targeted corners — well above Diamond average.", "type": "positive"},
            {"title": "Power shot timing", "detail": "You delayed power shots by ~200ms on average. Try pre-jumping.", "type": "tip"},
            {"title": "Open net conversion", "detail": "Converted 4/5 open net chances — strong finishing.", "type": "positive"},
        ],
        "possession": [
            {"title": "Boost management solid", "detail": "Maintained 40+ boost 72% of the time in this session.", "type": "positive"},
            {"title": "50/50 win rate up", "detail": "Won 65% of contested possessions — above your average.", "type": "positive"},
            {"title": "Ball control under pressure", "detail": "Lost possession 2x when pressured from behind. Work on awareness.", "type": "warning"},
        ],
        "50/50s": [
            {"title": "Challenge timing improved", "detail": "Your first-touch challenge was 150ms faster than last session.", "type": "positive"},
            {"title": "Post-challenge positioning", "detail": "After winning 50/50s you recovered to a defensive position 80% of the time.", "type": "positive"},
            {"title": "Flip direction reads", "detail": "Opponent faked left 3 times — you fell for it twice. Study flip patterns.", "type": "tip"},
        ],
    }

    drills = {
        "defense": {"name": "Shadow Defense Drill", "mode": "defense", "difficulty": difficulty, "duration_min": 5, "focus": "tracking and patience"},
        "shooting": {"name": "Power Shot Angles", "mode": "shooting", "difficulty": difficulty, "duration_min": 5, "focus": "pre-jump timing"},
        "possession": {"name": "Pressure Keepaway", "mode": "possession", "difficulty": difficulty, "duration_min": 5, "focus": "awareness under pressure"},
        "50/50s": {"name": "Challenge Timing Drill", "mode": "50/50s", "difficulty": difficulty, "duration_min": 5, "focus": "read and react"},
    }

    mode_key = mode if mode in insight_pool else "defense"
    insights = random.sample(insight_pool[mode_key], min(3, len(insight_pool[mode_key])))

    return {
        "insights": insights,
        "recommended_drill": drills.get(mode_key, drills["defense"]),
        "score": score_json,
    }
