"""initial

Revision ID: 001
Revises:
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users
    op.create_table(
        'users',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False, index=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('role', sa.Enum('player', 'admin', name='userrole'), nullable=False, server_default='player'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Models
    op.create_table(
        'models',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('version', sa.String(100), nullable=False),
        sa.Column('params_count', sa.Integer, nullable=True),
        sa.Column('git_sha', sa.String(40), nullable=True),
        sa.Column('tag', sa.Enum('stable', 'candidate', 'baseline', name='modeltag'), nullable=False, server_default='candidate'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Training runs
    op.create_table(
        'training_runs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('model_id', UUID(as_uuid=True), sa.ForeignKey('models.id'), nullable=False),
        sa.Column('status', sa.Enum('queued', 'running', 'stopped', 'completed', 'failed', name='runstatus'), nullable=False, server_default='queued'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('config_json', sa.JSON, server_default='{}'),
        sa.Column('steps', sa.Integer, server_default='0'),
        sa.Column('avg_reward', sa.Float, nullable=True),
        sa.Column('entropy', sa.Float, nullable=True),
        sa.Column('loss_pi', sa.Float, nullable=True),
        sa.Column('loss_v', sa.Float, nullable=True),
    )

    # Checkpoints
    op.create_table(
        'checkpoints',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('run_id', UUID(as_uuid=True), sa.ForeignKey('training_runs.id'), nullable=False),
        sa.Column('step', sa.Integer, nullable=False),
        sa.Column('artifact_path', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Eval suites
    op.create_table(
        'eval_suites',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False, unique=True),
        sa.Column('definition_json', sa.JSON, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Eval results
    op.create_table(
        'eval_results',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('checkpoint_id', UUID(as_uuid=True), sa.ForeignKey('checkpoints.id'), nullable=False),
        sa.Column('suite_id', UUID(as_uuid=True), sa.ForeignKey('eval_suites.id'), nullable=False),
        sa.Column('win_rate', sa.Float, nullable=True),
        sa.Column('goals_for', sa.Float, nullable=True),
        sa.Column('goals_against', sa.Float, nullable=True),
        sa.Column('kickoff_loss_rate', sa.Float, nullable=True),
        sa.Column('concede_open_net_rate', sa.Float, nullable=True),
        sa.Column('own_goal_rate', sa.Float, nullable=True),
        sa.Column('avg_shot_quality', sa.Float, nullable=True),
        sa.Column('last_man_overcommit_rate', sa.Float, nullable=True),
        sa.Column('boost_starve_rate', sa.Float, nullable=True),
        sa.Column('passed_gates', sa.Boolean, server_default='false'),
        sa.Column('deltas_json', sa.JSON, server_default='{}'),
        sa.Column('status', sa.String(50), server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Training sessions
    op.create_table(
        'training_sessions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('mode', sa.String(50), nullable=False),
        sa.Column('difficulty', sa.String(50), nullable=False),
        sa.Column('opponent_style', sa.String(50), nullable=False),
        sa.Column('opponent_model_id', UUID(as_uuid=True), sa.ForeignKey('models.id'), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('score_json', sa.JSON, server_default='{}'),
        sa.Column('summary_json', sa.JSON, server_default='{}'),
    )

    # Session events
    op.create_table(
        'session_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('session_id', UUID(as_uuid=True), sa.ForeignKey('training_sessions.id'), nullable=False),
        sa.Column('t_ms', sa.Integer, nullable=False),
        sa.Column('type', sa.String(100), nullable=False),
        sa.Column('payload_json', sa.JSON, server_default='{}'),
    )

    # Artifacts
    op.create_table(
        'artifacts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('kind', sa.String(100), nullable=False),
        sa.Column('path', sa.String(500), nullable=False),
        sa.Column('metadata_json', sa.JSON, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('artifacts')
    op.drop_table('session_events')
    op.drop_table('training_sessions')
    op.drop_table('eval_results')
    op.drop_table('eval_suites')
    op.drop_table('checkpoints')
    op.drop_table('training_runs')
    op.drop_table('models')
    op.drop_table('users')
    op.execute("DROP TYPE IF EXISTS userrole")
    op.execute("DROP TYPE IF EXISTS modeltag")
    op.execute("DROP TYPE IF EXISTS runstatus")
