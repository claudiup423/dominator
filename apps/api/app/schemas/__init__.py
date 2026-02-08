from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import datetime
from uuid import UUID
from enum import Enum


# ─── Enums ────────────────────────────────────────────────────────
class UserRole(str, Enum):
    player = "player"
    admin = "admin"

class RunStatus(str, Enum):
    queued = "queued"
    running = "running"
    stopped = "stopped"
    completed = "completed"
    failed = "failed"

class ModelTag(str, Enum):
    stable = "stable"
    candidate = "candidate"
    baseline = "baseline"

class SessionMode(str, Enum):
    defense = "defense"
    shooting = "shooting"
    possession = "possession"
    fifties = "50/50s"

class Difficulty(str, Enum):
    bronze = "bronze"
    silver = "silver"
    gold = "gold"
    plat = "plat"
    diamond = "diamond"
    champ = "champ"
    demon = "demon"

class OpponentStyle(str, Enum):
    passive = "passive"
    aggro = "aggro"
    counter = "counter"


# ─── Auth ─────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    role: UserRole = UserRole.player

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"

class UserResponse(BaseModel):
    id: UUID
    email: str
    role: UserRole
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Models ───────────────────────────────────────────────────────
class ModelCreate(BaseModel):
    name: str
    version: str
    params_count: Optional[int] = None
    git_sha: Optional[str] = None
    tag: ModelTag = ModelTag.candidate

class ModelUpdate(BaseModel):
    tag: Optional[ModelTag] = None
    name: Optional[str] = None

class ModelResponse(BaseModel):
    id: UUID
    name: str
    version: str
    params_count: Optional[int]
    git_sha: Optional[str]
    tag: ModelTag
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Training Runs ────────────────────────────────────────────────
class TrainingRunCreate(BaseModel):
    model_id: UUID
    config_json: dict = {}

class TrainingRunResponse(BaseModel):
    id: UUID
    model_id: UUID
    status: RunStatus
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    config_json: dict
    steps: int
    avg_reward: Optional[float]
    entropy: Optional[float]
    loss_pi: Optional[float]
    loss_v: Optional[float]

    class Config:
        from_attributes = True

class TrainingRunDetail(TrainingRunResponse):
    model: Optional[ModelResponse] = None
    checkpoints: List["CheckpointResponse"] = []


# ─── Checkpoints ──────────────────────────────────────────────────
class CheckpointResponse(BaseModel):
    id: UUID
    run_id: UUID
    step: int
    artifact_path: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Eval Suites ──────────────────────────────────────────────────
class EvalSuiteCreate(BaseModel):
    name: str
    definition_json: dict = {}

class EvalSuiteResponse(BaseModel):
    id: UUID
    name: str
    definition_json: dict
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Eval Results ─────────────────────────────────────────────────
class EvalRunRequest(BaseModel):
    checkpoint_id: UUID
    suite_id: UUID

class EvalResultResponse(BaseModel):
    id: UUID
    checkpoint_id: UUID
    suite_id: UUID
    win_rate: Optional[float]
    goals_for: Optional[float]
    goals_against: Optional[float]
    kickoff_loss_rate: Optional[float]
    concede_open_net_rate: Optional[float]
    own_goal_rate: Optional[float]
    avg_shot_quality: Optional[float]
    last_man_overcommit_rate: Optional[float]
    boost_starve_rate: Optional[float]
    passed_gates: bool
    deltas_json: dict
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class EvalCompareResponse(BaseModel):
    base: EvalResultResponse
    candidate: EvalResultResponse
    deltas: dict


# ─── Sessions ─────────────────────────────────────────────────────
class SessionStartRequest(BaseModel):
    mode: SessionMode
    difficulty: Difficulty
    opponent_style: OpponentStyle
    opponent_model_id: Optional[UUID] = None

class SessionEventCreate(BaseModel):
    t_ms: int
    type: str
    payload_json: dict = {}

class SessionEndRequest(BaseModel):
    score_json: dict = {}

class SessionResponse(BaseModel):
    id: UUID
    user_id: UUID
    mode: str
    difficulty: str
    opponent_style: str
    opponent_model_id: Optional[UUID]
    started_at: datetime
    ended_at: Optional[datetime]
    score_json: dict
    summary_json: dict

    class Config:
        from_attributes = True

class SessionEventResponse(BaseModel):
    id: UUID
    session_id: UUID
    t_ms: int
    type: str
    payload_json: dict

    class Config:
        from_attributes = True

class SessionSummary(BaseModel):
    session: SessionResponse
    events: List[SessionEventResponse]
    insights: List[dict]
    recommended_drill: dict


# ─── Artifacts ────────────────────────────────────────────────────
class ArtifactResponse(BaseModel):
    id: UUID
    kind: str
    path: str
    metadata_json: dict
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Generic ──────────────────────────────────────────────────────
class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    per_page: int
