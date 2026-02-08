import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON, Enum as SAEnum
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.session import Base
import enum


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return uuid.uuid4()


class UserRole(str, enum.Enum):
    player = "player"
    admin = "admin"


class RunStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    stopped = "stopped"
    completed = "completed"
    failed = "failed"


class ModelTag(str, enum.Enum):
    stable = "stable"
    candidate = "candidate"
    baseline = "baseline"


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.player, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    sessions = relationship("TrainingSession", back_populates="user")


class Model(Base):
    __tablename__ = "models"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name = Column(String(255), nullable=False)
    version = Column(String(100), nullable=False)
    params_count = Column(Integer, nullable=True)
    git_sha = Column(String(40), nullable=True)
    tag = Column(SAEnum(ModelTag), default=ModelTag.candidate, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    training_runs = relationship("TrainingRun", back_populates="model")


class TrainingRun(Base):
    __tablename__ = "training_runs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    model_id = Column(UUID(as_uuid=True), ForeignKey("models.id"), nullable=False)
    status = Column(SAEnum(RunStatus), default=RunStatus.queued, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    config_json = Column(JSON, default=dict)
    steps = Column(Integer, default=0)
    avg_reward = Column(Float, nullable=True)
    entropy = Column(Float, nullable=True)
    loss_pi = Column(Float, nullable=True)
    loss_v = Column(Float, nullable=True)
    model = relationship("Model", back_populates="training_runs")
    checkpoints = relationship("Checkpoint", back_populates="run", order_by="Checkpoint.step")


class Checkpoint(Base):
    __tablename__ = "checkpoints"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    run_id = Column(UUID(as_uuid=True), ForeignKey("training_runs.id"), nullable=False)
    step = Column(Integer, nullable=False)
    artifact_path = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    run = relationship("TrainingRun", back_populates="checkpoints")
    eval_results = relationship("EvalResult", back_populates="checkpoint")


class EvalSuite(Base):
    __tablename__ = "eval_suites"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    name = Column(String(255), nullable=False, unique=True)
    definition_json = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class EvalResult(Base):
    __tablename__ = "eval_results"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    checkpoint_id = Column(UUID(as_uuid=True), ForeignKey("checkpoints.id"), nullable=False)
    suite_id = Column(UUID(as_uuid=True), ForeignKey("eval_suites.id"), nullable=False)
    win_rate = Column(Float, nullable=True)
    goals_for = Column(Float, nullable=True)
    goals_against = Column(Float, nullable=True)
    kickoff_loss_rate = Column(Float, nullable=True)
    concede_open_net_rate = Column(Float, nullable=True)
    own_goal_rate = Column(Float, nullable=True)
    avg_shot_quality = Column(Float, nullable=True)
    last_man_overcommit_rate = Column(Float, nullable=True)
    boost_starve_rate = Column(Float, nullable=True)
    passed_gates = Column(Boolean, default=False)
    deltas_json = Column(JSON, default=dict)
    status = Column(String(50), default="pending")
    created_at = Column(DateTime(timezone=True), default=utcnow)
    checkpoint = relationship("Checkpoint", back_populates="eval_results")
    suite = relationship("EvalSuite")


class TrainingSession(Base):
    __tablename__ = "training_sessions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    mode = Column(String(50), nullable=False)
    difficulty = Column(String(50), nullable=False)
    opponent_style = Column(String(50), nullable=False)
    opponent_model_id = Column(UUID(as_uuid=True), ForeignKey("models.id"), nullable=True)
    started_at = Column(DateTime(timezone=True), default=utcnow)
    ended_at = Column(DateTime(timezone=True), nullable=True)
    score_json = Column(JSON, default=dict)
    summary_json = Column(JSON, default=dict)
    user = relationship("User", back_populates="sessions")
    events = relationship("SessionEvent", back_populates="session", order_by="SessionEvent.t_ms")


class SessionEvent(Base):
    __tablename__ = "session_events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    session_id = Column(UUID(as_uuid=True), ForeignKey("training_sessions.id"), nullable=False)
    t_ms = Column(Integer, nullable=False)
    type = Column(String(100), nullable=False)
    payload_json = Column(JSON, default=dict)
    session = relationship("TrainingSession", back_populates="events")


class Artifact(Base):
    __tablename__ = "artifacts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=new_uuid)
    kind = Column(String(100), nullable=False)
    path = Column(String(500), nullable=False)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)
