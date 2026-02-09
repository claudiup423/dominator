const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ─── Token management (for Bearer auth through proxy) ─────────────
let _accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (_accessToken) {
    headers["Authorization"] = `Bearer ${_accessToken}`;
  }

  const res = await fetch(url, {
    credentials: "include",
    ...options,
    headers,
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

// ─── Match (launches actual Rocket League via agent) ──────────────
export const match = {
  start: (data: {
    mode?: string;
    difficulty: string;
    opponent_style: string;
    checkpoint_path?: string | null;
  }) =>
    request("/api/match/start", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  stop: () => request("/api/match/stop", { method: "POST" }),
  status: () => request("/api/match/status"),
};

// ─── Artifacts ────────────────────────────────────────────────────
export const artifacts = {
  list: () => request("/api/artifacts"),
  downloadUrl: (id: string) => `${API_BASE}/api/artifacts/${id}/download`,
};

// ─── Deploy (agent + model management) ────────────────────────────
// Note: uploads go direct to API (not through Next.js proxy) because
// the proxy doesn't handle multipart/form-data well for large files.
const DIRECT_API = process.env.NEXT_PUBLIC_API_URL || "";

export const deploy = {
  agentInfo: () => request("/api/download/agent/info"),
  modelInfo: () => request("/api/download/model/info"),
  buildAgent: () => request("/api/download/agent/build", { method: "POST" }),
  uploadAgent: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const headers: Record<string, string> = {};
    if (_accessToken) headers["Authorization"] = `Bearer ${_accessToken}`;
    return fetch(`${DIRECT_API}/api/download/agent/upload`, {
      method: "POST",
      body: form,
      headers,
    }).then(async (r) => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({ detail: "Upload failed" }));
        throw new ApiError(body.detail || "Upload failed", r.status);
      }
      return r.json();
    });
  },
  uploadModel: (file: File, version?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (version) form.append("version", version);
    const headers: Record<string, string> = {};
    if (_accessToken) headers["Authorization"] = `Bearer ${_accessToken}`;
    return fetch(`${DIRECT_API}/api/download/model/upload`, {
      method: "POST",
      body: form,
      headers,
    }).then(async (r) => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({ detail: "Upload failed" }));
        throw new ApiError(body.detail || "Upload failed", r.status);
      }
      return r.json();
    });
  },
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
  stop: () => request("/api/training/stop", { method: "POST" }),

  evalResults: () => request("/api/training/evals"),
  evalLatest: () => request("/api/training/evals/latest"),
  evalElo: () => request("/api/training/evals/elo"),
  evalTiers: () => request("/api/training/evals/tiers"),
  evalRegressions: () => request("/api/training/evals/regressions"),
};

export { ApiError };
