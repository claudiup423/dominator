export type UserRole = 'player' | 'admin';
export type RunStatus = 'queued' | 'running' | 'stopped' | 'completed' | 'failed';
export type ModelTag = 'stable' | 'candidate' | 'baseline';
export type SessionMode = 'defense' | 'shooting' | 'possession' | '50/50s';
export type Difficulty = 'bronze' | 'silver' | 'gold' | 'plat' | 'diamond' | 'champ' | 'demon';
export type OpponentStyle = 'passive' | 'aggro' | 'counter';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Model {
  id: string;
  name: string;
  version: string;
  params_count: number | null;
  git_sha: string | null;
  tag: ModelTag;
  created_at: string;
}

export interface TrainingRun {
  id: string;
  model_id: string;
  status: RunStatus;
  started_at: string | null;
  ended_at: string | null;
  config_json: Record<string, unknown>;
  steps: number;
  avg_reward: number | null;
  entropy: number | null;
  loss_pi: number | null;
  loss_v: number | null;
}

export interface TrainingRunDetail extends TrainingRun {
  model: Model | null;
  checkpoints: Checkpoint[];
}

export interface Checkpoint {
  id: string;
  run_id: string;
  step: number;
  artifact_path: string | null;
  created_at: string;
}

export interface EvalSuite {
  id: string;
  name: string;
  definition_json: Record<string, unknown>;
  created_at: string;
}

export interface EvalResult {
  id: string;
  checkpoint_id: string;
  suite_id: string;
  win_rate: number | null;
  goals_for: number | null;
  goals_against: number | null;
  kickoff_loss_rate: number | null;
  concede_open_net_rate: number | null;
  own_goal_rate: number | null;
  avg_shot_quality: number | null;
  last_man_overcommit_rate: number | null;
  boost_starve_rate: number | null;
  passed_gates: boolean;
  deltas_json: Record<string, number>;
  status: string;
  created_at: string;
}

export interface EvalCompare {
  base: EvalResult;
  candidate: EvalResult;
  deltas: Record<string, number>;
}

export interface TrainingSession {
  id: string;
  user_id: string;
  mode: string;
  difficulty: string;
  opponent_style: string;
  opponent_model_id: string | null;
  started_at: string;
  ended_at: string | null;
  score_json: Record<string, number>;
  summary_json: Record<string, unknown>;
}

export interface SessionEvent {
  id: string;
  session_id: string;
  t_ms: number;
  type: string;
  payload_json: Record<string, unknown>;
}

export interface SessionSummary {
  session: TrainingSession;
  events: SessionEvent[];
  insights: SessionInsight[];
  recommended_drill: DrillRecommendation;
}

export interface SessionInsight {
  title: string;
  detail: string;
  type: 'positive' | 'warning' | 'tip';
}

export interface DrillRecommendation {
  name: string;
  mode: string;
  difficulty: string;
  duration_min: number;
  focus: string;
}

export interface Artifact {
  id: string;
  kind: string;
  path: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
}
