"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trainingRuns, trainingControl, models as modelsApi } from "@/lib/api";
import { Card, HUDPanel } from "@/components/ui/Card";
import {
  StatusDot,
  SectionHeader,
  ModelTagBadge,
  Badge,
} from "@/components/ui/Badge";
import {
  formatNumber,
  formatDate,
  formatDuration,
  statusColor,
  cn,
} from "@/lib/utils";
import {
  Eye,
  Plus,
  X,
  Play,
  Square,
  Cpu,
  Rocket,
  ChevronDown,
  ChevronRight,
  Swords,
  Users,
  User,
  Sliders,
  Zap,
  Target,
  Shield,
  Flame,
  Sparkles,
  HardDrive,
  RotateCcw,
  Check,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import type { TrainingRun, Model } from "@/types";

export default function AdminRunsPage() {
  const queryClient = useQueryClient();
  const [showNewRun, setShowNewRun] = useState(false);

  const { data: runs } = useQuery({
    queryKey: ["training-runs"],
    queryFn: () => trainingRuns.list() as Promise<TrainingRun[]>,
  });
  const { data: modelList } = useQuery({
    queryKey: ["models"],
    queryFn: () => modelsApi.list() as Promise<Model[]>,
  });

  const stopMutation = useMutation({
    mutationFn: async (id: string) => {
      await trainingControl.stop();
      return trainingRuns.stop(id);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["training-runs"] }),
  });

  const modelMap = new Map(modelList?.map((m) => [m.id, m]) || []);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-black tracking-tight">
            Training Runs
          </h1>
          <p className="text-sm text-dom-muted mt-1">
            Configure, launch, and monitor training runs with full control over
            rewards and hyperparameters.
          </p>
        </div>
        <button onClick={() => setShowNewRun(true)} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Run
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {(["running", "completed", "failed", "queued"] as const).map(
          (status) => {
            const count = runs?.filter((r) => r.status === status).length || 0;
            const emojis: Record<string, string> = {
              running: "🏃",
              completed: "✅",
              failed: "❌",
              queued: "⏳",
            };
            return (
              <Card key={status} className="flex items-center gap-3 py-3">
                <span className="text-xl">{emojis[status]}</span>
                <div>
                  <div className="text-xl font-display font-bold text-dom-heading">
                    {count}
                  </div>
                  <div className="text-xs text-dom-muted capitalize">
                    {status}
                  </div>
                </div>
              </Card>
            );
          },
        )}
      </div>

      {/* Runs Table */}
      <Card className="overflow-hidden !p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dom-border bg-dom-elevated/30">
                {[
                  "Status",
                  "Model",
                  "Steps",
                  "Reward",
                  "Entropy",
                  "π Loss",
                  "Duration",
                  "Started",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className={`py-3 px-4 text-xs font-semibold text-dom-muted uppercase tracking-wider ${h === "Status" || h === "Model" || h === "" ? "text-left" : "text-right"}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs?.map((run) => {
                const model = modelMap.get(run.model_id);
                const isRunning = run.status === "running";
                return (
                  <tr
                    key={run.id}
                    className="border-b border-dom-border/30 hover:bg-dom-elevated/30 transition-colors group"
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <StatusDot status={run.status} />
                        <span
                          className={cn(
                            "text-sm capitalize font-medium",
                            statusColor(run.status),
                          )}
                        >
                          {run.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="text-dom-heading font-medium">
                            {model?.name || "—"}
                          </div>
                          <div className="text-xs text-dom-muted font-mono">
                            {model?.version}
                          </div>
                        </div>
                        {model && <ModelTagBadge tag={model.tag} />}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-dom-text">
                      {run.steps.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-dom-text">
                      {formatNumber(run.avg_reward)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-dom-text">
                      {formatNumber(run.entropy)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-dom-text">
                      {formatNumber(run.loss_pi, 3)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-dom-muted">
                      {formatDuration(run.started_at, run.ended_at)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-dom-muted text-xs">
                      {formatDate(run.started_at)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/admin/runs/${run.id}`}>
                          <button
                            className="btn-ghost !p-1.5"
                            title="View live logs"
                          >
                            <Eye className="w-4 h-4 text-dom-accent" />
                          </button>
                        </Link>
                        {isRunning && (
                          <button
                            onClick={() => stopMutation.mutate(run.id)}
                            className="btn-ghost !p-1.5"
                            title="Stop run"
                            disabled={stopMutation.isPending}
                          >
                            <Square className="w-4 h-4 text-dom-red" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {(!runs || runs.length === 0) && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-dom-muted">
                    No training runs yet. Click "New Run" to start one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* New Run Modal */}
      {showNewRun && (
        <TrainingControlPanel
          models={modelList || []}
          onClose={() => setShowNewRun(false)}
          onCreated={() => {
            setShowNewRun(false);
            queryClient.invalidateQueries({ queryKey: ["training-runs"] });
          }}
        />
      )}
    </div>
  );
}

// ─── Training Control Panel ──────────────────────────────────────────

interface Checkpoint {
  path: string;
  step: number;
  run: string;
  size_mb: number;
}

function TrainingControlPanel({
  models,
  onClose,
  onCreated,
}: {
  models: Model[];
  onClose: () => void;
  onCreated: () => void;
}) {
  // Sections
  const [activeSection, setActiveSection] = useState<
    "mode" | "checkpoint" | "rewards" | "hyperparameters"
  >("mode");

  // Mode
  const [mode, setMode] = useState<string>("1v1");

  // Checkpoint
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<string | null>(
    null,
  );
  const [loadingCheckpoints, setLoadingCheckpoints] = useState(true);

  // Rewards
  const [rewards, setRewards] = useState({
    goal: 20.0,
    touch: 2.0,
    velocity_ball_to_goal: 2.0,
    velocity_player_to_ball: 1.0,
    speed: 1.0,
    boost_penalty: 2.0,
    ball_toward_own_goal: 4,
    bad_touch_toward_own_goal: 6,
    demo: 0.0,
    aerial: 0.0,
  });

  // Hyperparameters
  const [hyper, setHyper] = useState({
    policy_lr: 5e-4,
    critic_lr: 5e-4,
    n_proc: 16,
    ppo_batch_size: 50000,
    ts_per_iteration: 50000,
    ppo_epochs: 3,
    ppo_ent_coef: 0.01,
    gamma: 0.99,
    tick_skip: 8,
  });

  // Training
  const [training, setTraining] = useState({
    save_every_ts: 5000000,
    timestep_limit: 10000000000,
    timeout_seconds: 15,
    log_to_wandb: false,
  });

  // Model selection
  const [selectedModelId, setSelectedModelId] = useState<string>(
    models[0]?.id || "",
  );

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    status: string;
    pid?: number;
    config?: any;
    error?: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  // Load checkpoints
  useEffect(() => {
    trainingControl
      .checkpoints()
      .then((data: any) => {
        setCheckpoints(data);
        setLoadingCheckpoints(false);
      })
      .catch(() => setLoadingCheckpoints(false));
  }, []);

  const handleLaunch = async () => {
    setError("");
    setSubmitting(true);
    try {
      const res: any = await trainingControl.launch({
        mode,
        checkpoint_path: selectedCheckpoint,
        rewards,
        hyperparameters: hyper,
        training,
        run_id: null,
      });
      if (res.error) {
        setError(res.error);
      } else {
        setResult(res);
      }
    } catch (err: any) {
      setError(err.message || "Failed to start training");
    }
    setSubmitting(false);
  };

  const modeIcons = { "1v1": User, "2v2": Users, "3v3": Users };
  const modeDescriptions: Record<string, string> = {
    "1v1": "Fastest learning. Best for basic mechanics.",
    "2v2": "Balanced. Learns rotation and passing.",
    "3v3": "Full game. Slow learning, needs 1B+ steps.",
  };

  const rewardMeta: Record<
    string,
    { icon: any; color: string; description: string }
  > = {
    goal: {
      icon: Target,
      color: "#22C55E",
      description: "Reward for scoring goals",
    },
    touch: {
      icon: Zap,
      color: "#00D4FF",
      description: "Reward for touching the ball",
    },
    velocity_ball_to_goal: {
      icon: Rocket,
      color: "#F59E0B",
      description: "Ball moving toward opponent goal",
    },
    velocity_player_to_ball: {
      icon: ChevronRight,
      color: "#A855F7",
      description: "Driving toward the ball",
    },
    speed: {
      icon: Flame,
      color: "#EF4444",
      description: "Reward for moving fast",
    },
    boost_penalty: {
      icon: AlertCircle,
      color: "#6B7280",
      description: "Penalty for wasting boost",
    },
    ball_toward_own_goal: {
      icon: Shield,
      color: "#F97316",
      description: "Penalty when ball moves toward own goal",
    },
    bad_touch_toward_own_goal: {
      icon: AlertCircle,
      color: "#DC2626",
      description: "Penalty for touching ball toward own goal",
    },
    demo: {
      icon: Swords,
      color: "#DC2626",
      description: "Reward for demolishing opponents",
    },
    aerial: {
      icon: Sparkles,
      color: "#8B5CF6",
      description: "Reward for aerial play",
    },
  };

  const sections = [
    { id: "mode" as const, label: "Game Mode", icon: Swords },
    { id: "checkpoint" as const, label: "Checkpoint", icon: HardDrive },
    { id: "rewards" as const, label: "Reward Shaping", icon: Target },
    { id: "hyperparameters" as const, label: "Hyperparameters", icon: Sliders },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-dom-surface border border-dom-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl animate-slide-up flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dom-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-dom-accent/20 to-blue-600/20 flex items-center justify-center border border-dom-accent/20">
              <Rocket className="w-5 h-5 text-dom-accent" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-dom-heading">
                Training Control Panel
              </h2>
              <p className="text-xs text-dom-muted">
                Configure mode, rewards, and hyperparameters
              </p>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost !p-1.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b border-dom-border flex-shrink-0 px-6">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-[1px]",
                activeSection === s.id
                  ? "border-dom-accent text-dom-accent"
                  : "border-transparent text-dom-muted hover:text-dom-text",
              )}
            >
              <s.icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          {/* ── Mode Section ── */}
          {activeSection === "mode" && (
            <div className="space-y-4">
              <p className="text-sm text-dom-muted">
                Choose the game format. 1v1 learns fastest and is recommended
                for initial training.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {(["1v1", "2v2", "3v3"] as const).map((m) => {
                  const Icon = modeIcons[m];
                  return (
                    <div
                      key={m}
                      onClick={() => setMode(m)}
                      className={cn(
                        "p-5 rounded-xl border cursor-pointer transition-all text-center",
                        mode === m
                          ? "border-dom-accent/50 bg-dom-accent/5 shadow-md"
                          : "border-dom-border hover:border-dom-accent/20 hover:bg-dom-elevated/50",
                      )}
                    >
                      <div
                        className={cn(
                          "w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center",
                          mode === m
                            ? "bg-dom-accent/20 border border-dom-accent/30"
                            : "bg-dom-elevated border border-dom-border",
                        )}
                      >
                        <Icon
                          className={cn(
                            "w-6 h-6",
                            mode === m ? "text-dom-accent" : "text-dom-muted",
                          )}
                        />
                      </div>
                      <div className="font-display font-bold text-xl text-dom-heading">
                        {m}
                      </div>
                      <div className="text-xs text-dom-muted mt-1">
                        {modeDescriptions[m]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Checkpoint Section ── */}
          {activeSection === "checkpoint" && (
            <div className="space-y-4">
              <p className="text-sm text-dom-muted">
                Resume from an existing checkpoint or start fresh. Starting
                fresh is recommended when changing modes.
              </p>

              {/* Fresh start option */}
              <div
                onClick={() => setSelectedCheckpoint(null)}
                className={cn(
                  "p-4 rounded-xl border cursor-pointer transition-all flex items-center gap-4",
                  !selectedCheckpoint
                    ? "border-dom-accent/50 bg-dom-accent/5"
                    : "border-dom-border hover:border-dom-accent/20",
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    !selectedCheckpoint
                      ? "bg-dom-accent/20"
                      : "bg-dom-elevated",
                  )}
                >
                  <Sparkles
                    className={cn(
                      "w-5 h-5",
                      !selectedCheckpoint
                        ? "text-dom-accent"
                        : "text-dom-muted",
                    )}
                  />
                </div>
                <div>
                  <div className="font-semibold text-dom-heading">
                    Start Fresh
                  </div>
                  <div className="text-xs text-dom-muted">
                    Begin training from scratch with random weights
                  </div>
                </div>
              </div>

              {/* Checkpoint list */}
              {loadingCheckpoints ? (
                <div className="text-center py-8 text-dom-muted text-sm animate-pulse">
                  Loading checkpoints...
                </div>
              ) : checkpoints.length === 0 ? (
                <div className="text-center py-8 text-dom-muted text-sm">
                  No checkpoints found. Train first to create checkpoints.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {checkpoints.map((cp) => (
                    <div
                      key={cp.path}
                      onClick={() => setSelectedCheckpoint(cp.path)}
                      className={cn(
                        "p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between",
                        selectedCheckpoint === cp.path
                          ? "border-dom-accent/50 bg-dom-accent/5"
                          : "border-dom-border hover:border-dom-accent/20",
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <HardDrive
                          className={cn(
                            "w-4 h-4",
                            selectedCheckpoint === cp.path
                              ? "text-dom-accent"
                              : "text-dom-muted",
                          )}
                        />
                        <div>
                          <div className="text-sm font-semibold text-dom-heading">
                            Step {cp.step.toLocaleString()}
                          </div>
                          <div className="text-xs text-dom-muted font-mono">
                            {cp.run}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-dom-muted">
                        {cp.size_mb} MB
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Rewards Section ── */}
          {activeSection === "rewards" && (
            <div className="space-y-4">
              <p className="text-sm text-dom-muted">
                Adjust reward weights to shape bot behavior. Higher weights make
                the bot prioritize that behavior more.
              </p>
              <div className="space-y-3">
                {Object.entries(rewards).map(([key, value]) => {
                  const meta = rewardMeta[key];
                  const Icon = meta?.icon || Target;
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-4 p-3 rounded-xl bg-dom-elevated/30 border border-dom-border/50"
                    >
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: `${meta?.color || "#6B7280"}15`,
                          border: `1px solid ${meta?.color || "#6B7280"}30`,
                        }}
                      >
                        <Icon
                          className="w-4 h-4"
                          style={{ color: meta?.color }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium text-dom-heading capitalize">
                              {key.replace(/_/g, " ")}
                            </span>
                            <div className="text-xs text-dom-muted">
                              {meta?.description}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={0}
                              max={
                                key === "goal" ? 50 : key === "speed" ? 5 : 20
                              }
                              step={
                                key === "speed" || key === "boost_penalty"
                                  ? 0.1
                                  : 0.5
                              }
                              value={value}
                              onChange={(e) =>
                                setRewards({
                                  ...rewards,
                                  [key]: parseFloat(e.target.value),
                                })
                              }
                              className="w-28 accent-[var(--accent-color)]"
                              style={
                                {
                                  "--accent-color": meta?.color || "#00D4FF",
                                } as any
                              }
                            />
                            <input
                              type="number"
                              value={value}
                              onChange={(e) =>
                                setRewards({
                                  ...rewards,
                                  [key]: parseFloat(e.target.value) || 0,
                                })
                              }
                              step={0.1}
                              className="w-16 px-2 py-1 rounded-lg bg-dom-base border border-dom-border text-sm font-mono text-dom-heading text-center"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Presets */}
              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs text-dom-muted">Presets:</span>
                <button
                  onClick={() =>
                    setRewards({
                      goal: 10,
                      touch: 3,
                      velocity_ball_to_goal: 5,
                      velocity_player_to_ball: 1,
                      speed: 0.1,
                      boost_penalty: 0,
                      ball_toward_own_goal: 4,
                      bad_touch_toward_own_goal: 6,
                      demo: 0,
                      aerial: 0,
                    })
                  }
                  className="px-3 py-1 rounded-lg bg-dom-elevated border border-dom-border text-xs text-dom-muted hover:text-dom-text transition-colors"
                >
                  ⚽ Ball Chaser
                </button>
                <button
                  onClick={() =>
                    setRewards({
                      goal: 15,
                      touch: 1,
                      velocity_ball_to_goal: 8,
                      velocity_player_to_ball: 0.5,
                      speed: 0,
                      boost_penalty: 0.5,
                      ball_toward_own_goal: 4,
                      bad_touch_toward_own_goal: 6,
                      demo: 0,
                      aerial: 0,
                    })
                  }
                  className="px-3 py-1 rounded-lg bg-dom-elevated border border-dom-border text-xs text-dom-muted hover:text-dom-text transition-colors"
                >
                  🎯 Shooter
                </button>
                <button
                  onClick={() =>
                    setRewards({
                      goal: 5,
                      touch: 5,
                      velocity_ball_to_goal: 3,
                      velocity_player_to_ball: 3,
                      speed: 0.5,
                      boost_penalty: 0,
                      ball_toward_own_goal: 4,
                      bad_touch_toward_own_goal: 6,
                      demo: 5,
                      aerial: 0,
                    })
                  }
                  className="px-3 py-1 rounded-lg bg-dom-elevated border border-dom-border text-xs text-dom-muted hover:text-dom-text transition-colors"
                >
                  💥 Aggressive
                </button>
                <button
                  onClick={() =>
                    setRewards({
                      goal: 10,
                      touch: 2,
                      velocity_ball_to_goal: 3,
                      velocity_player_to_ball: 1,
                      speed: 0.1,
                      boost_penalty: 0,
                      ball_toward_own_goal: 4,
                      bad_touch_toward_own_goal: 6,
                      demo: 0,
                      aerial: 5,
                    })
                  }
                  className="px-3 py-1 rounded-lg bg-dom-elevated border border-dom-border text-xs text-dom-muted hover:text-dom-text transition-colors"
                >
                  ✨ Freestyler
                </button>
              </div>
            </div>
          )}

          {/* ── Hyperparameters Section ── */}
          {activeSection === "hyperparameters" && (
            <div className="space-y-4">
              <p className="text-sm text-dom-muted">
                Advanced settings. The defaults work well for most cases. Only
                change these if you know what you're doing.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    {
                      key: "policy_lr",
                      label: "Policy LR",
                      type: "number",
                      step: 0.0001,
                      description: "Learning rate for policy network",
                    },
                    {
                      key: "critic_lr",
                      label: "Critic LR",
                      type: "number",
                      step: 0.0001,
                      description: "Learning rate for value network",
                    },
                    {
                      key: "n_proc",
                      label: "Parallel Envs",
                      type: "number",
                      step: 1,
                      description: "CPU workers (more = faster)",
                    },
                    {
                      key: "ppo_batch_size",
                      label: "Batch Size",
                      type: "number",
                      step: 1000,
                      description: "Samples per PPO update",
                    },
                    {
                      key: "ts_per_iteration",
                      label: "Steps/Iteration",
                      type: "number",
                      step: 1000,
                      description: "Steps collected per loop",
                    },
                    {
                      key: "ppo_epochs",
                      label: "PPO Epochs",
                      type: "number",
                      step: 1,
                      description: "Gradient passes per batch",
                    },
                    {
                      key: "ppo_ent_coef",
                      label: "Entropy Coef",
                      type: "number",
                      step: 0.001,
                      description: "Exploration bonus (higher = more random)",
                    },
                    {
                      key: "gamma",
                      label: "Discount (γ)",
                      type: "number",
                      step: 0.001,
                      description: "Future reward discount",
                    },
                    {
                      key: "tick_skip",
                      label: "Tick Skip",
                      type: "number",
                      step: 1,
                      description: "Physics frames between actions",
                    },
                  ] as const
                ).map(({ key, label, step: inputStep, description }) => (
                  <div
                    key={key}
                    className="p-3 rounded-xl bg-dom-elevated/30 border border-dom-border/50 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-dom-muted">
                        {label}
                      </label>
                      <input
                        type="number"
                        value={(hyper as any)[key]}
                        onChange={(e) =>
                          setHyper({
                            ...hyper,
                            [key]: parseFloat(e.target.value) || 0,
                          })
                        }
                        step={inputStep}
                        className="w-28 px-2 py-1 rounded-lg bg-dom-base border border-dom-border text-sm font-mono text-dom-heading text-right"
                      />
                    </div>
                    <div className="text-[10px] text-dom-muted">
                      {description}
                    </div>
                  </div>
                ))}
              </div>

              {/* Training settings */}
              <div className="border-t border-dom-border pt-4 mt-4">
                <div className="text-xs font-semibold text-dom-muted uppercase tracking-wider mb-3">
                  Training Settings
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-dom-elevated/30 border border-dom-border/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-dom-muted">
                        Save Every
                      </label>
                      <input
                        type="number"
                        value={training.save_every_ts}
                        onChange={(e) =>
                          setTraining({
                            ...training,
                            save_every_ts: parseInt(e.target.value) || 5000000,
                          })
                        }
                        step={1000000}
                        className="w-28 px-2 py-1 rounded-lg bg-dom-base border border-dom-border text-sm font-mono text-dom-heading text-right"
                      />
                    </div>
                    <div className="text-[10px] text-dom-muted">
                      Steps between checkpoint saves
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-dom-elevated/30 border border-dom-border/50 space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-dom-muted">
                        No-Touch Timeout
                      </label>
                      <input
                        type="number"
                        value={training.timeout_seconds}
                        onChange={(e) =>
                          setTraining({
                            ...training,
                            timeout_seconds: parseInt(e.target.value) || 15,
                          })
                        }
                        step={5}
                        className="w-28 px-2 py-1 rounded-lg bg-dom-base border border-dom-border text-sm font-mono text-dom-heading text-right"
                      />
                    </div>
                    <div className="text-[10px] text-dom-muted">
                      Reset after N seconds without ball touch
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-dom-border p-6 flex-shrink-0 bg-dom-elevated/30">
          {result ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-dom-green text-sm font-semibold">
                <Check className="w-4 h-4" />
                Training started! PID: {result.pid} — Go to a Training Run to
                see live metrics.
              </div>
              <div className="flex justify-end">
                <button onClick={onCreated} className="btn-secondary">
                  Done
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="text-xs text-dom-muted space-y-0.5">
                <div>
                  Mode: <strong className="text-dom-text">{mode}</strong>
                </div>
                <div>
                  Checkpoint:{" "}
                  <strong className="text-dom-text">
                    {selectedCheckpoint
                      ? `Step ${checkpoints.find((c) => c.path === selectedCheckpoint)?.step.toLocaleString()}`
                      : "Fresh start"}
                  </strong>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={onClose} className="btn-secondary">
                  Cancel
                </button>
                <button
                  onClick={handleLaunch}
                  disabled={submitting}
                  className="btn-primary"
                >
                  <Rocket className="w-4 h-4" />
                  {submitting ? "Starting..." : "Start Training"}
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className="mt-3 text-sm text-dom-red bg-dom-red/10 border border-dom-red/20 rounded-lg px-4 py-2">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
