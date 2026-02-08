const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(body.detail || "Request failed", res.status);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────
export const auth = {
  register: (email: string, password: string, role: string = "player") =>
    request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    }),
  login: (email: string, password: string) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  logout: () => request("/api/auth/logout", { method: "POST" }),
  me: () => request("/api/auth/me"),
};

// ─── Models ───────────────────────────────────────────────────────
export const models = {
  list: () => request("/api/models"),
  create: (data: { name: string; version: string; tag?: string }) =>
    request("/api/models", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Record<string, unknown>) =>
    request(`/api/models/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  promote: (id: string) =>
    request(`/api/models/${id}/promote`, { method: "POST" }),
};

// ─── Training Runs ────────────────────────────────────────────────
export const trainingRuns = {
  list: () => request("/api/training-runs"),
  get: (id: string) => request(`/api/training-runs/${id}`),
  start: (data: { model_id: string; config_json?: Record<string, unknown> }) =>
    request("/api/training-runs/start", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  stop: (id: string) =>
    request(`/api/training-runs/${id}/stop`, { method: "POST" }),
  checkpoints: (id: string) => request(`/api/training-runs/${id}/checkpoints`),
  stream: (id: string) =>
    new EventSource(`${API_BASE}/api/stream/training-runs/${id}`),
};

// ─── Evals ────────────────────────────────────────────────────────
export const evals = {
  suites: () => request("/api/eval-suites"),
  createSuite: (data: {
    name: string;
    definition_json?: Record<string, unknown>;
  }) =>
    request("/api/eval-suites", { method: "POST", body: JSON.stringify(data) }),
  run: (data: { checkpoint_id: string; suite_id: string }) =>
    request("/api/evals/run", { method: "POST", body: JSON.stringify(data) }),
  get: (id: string) => request(`/api/evals/${id}`),
  compare: (baseId: string, candidateId: string) =>
    request(
      `/api/evals/compare?base_checkpoint_id=${baseId}&candidate_checkpoint_id=${candidateId}`,
    ),
  stream: (id: string) => new EventSource(`${API_BASE}/api/stream/evals/${id}`),
};

// ─── Sessions ─────────────────────────────────────────────────────
export const sessions = {
  list: () => request("/api/sessions"),
  get: (id: string) => request(`/api/sessions/${id}`),
  start: (data: { mode: string; difficulty: string; opponent_style: string }) =>
    request("/api/sessions/start", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  addEvent: (
    id: string,
    data: {
      t_ms: number;
      type: string;
      payload_json?: Record<string, unknown>;
    },
  ) =>
    request(`/api/sessions/${id}/event`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  end: (id: string, data: { score_json: Record<string, number> }) =>
    request(`/api/sessions/${id}/end`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  summary: (id: string) => request(`/api/sessions/${id}/summary`),
};

// ─── Artifacts ────────────────────────────────────────────────────
export const artifacts = {
  list: () => request("/api/artifacts"),
  downloadUrl: (id: string) => `${API_BASE}/api/artifacts/${id}/download`,
};

// ─── Training Control ────────────────────────────────────────────
export const trainingControl = {
  checkpoints: () => request("/api/training/checkpoints"),
  defaults: () => request("/api/training/defaults"),
  launch: (data: {
    mode: string;
    checkpoint_path?: string | null;
    rewards: Record<string, number>;
    hyperparameters: Record<string, number | boolean>;
    training: Record<string, number | boolean>;
    run_id?: string | null;
  }) =>
    request("/api/training/launch", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  activeConfig: () => request("/api/training/active-config"),
  status: () => request("/api/training/status"),
};

export { ApiError };
