// Re-export all types from the web app types
// In a production setup, this would be generated from the OpenAPI spec
export type {
  UserRole, RunStatus, ModelTag, SessionMode, Difficulty, OpponentStyle,
  User, AuthResponse, Model, TrainingRun, TrainingRunDetail, Checkpoint,
  EvalSuite, EvalResult, EvalCompare, TrainingSession, SessionEvent,
  SessionSummary, SessionInsight, DrillRecommendation, Artifact,
} from '../../apps/web/src/types';
