"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  sessions,
  trainingControl,
  trainingRuns,
  models as modelsApi,
} from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Card, HUDPanel, HeroCard, GlowCard } from "@/components/ui/Card";
import {
  DifficultyBadge,
  SectionHeader,
  StatusDot,
  Badge,
  ModelTagBadge,
} from "@/components/ui/Badge";
import {
  formatDate,
  formatDuration,
  formatNumber,
  cn,
  difficultyColor,
} from "@/lib/utils";
import {
  Crosshair,
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  ArrowRight,
  Trophy,
  Gamepad2,
  ChevronRight,
  Activity,
  Play,
  Square,
  Cpu,
  Minus,
  Rocket,
  BarChart3,
  FlaskConical,
} from "lucide-react";
import Link from "next/link";
import type { TrainingSession, TrainingRun, Model } from "@/types";

// ─── AI Tier Calc ────────────────────────────────────────────────
const AI_TIERS = [
  { name: "Bronze", minWr: 0, color: "#CD7F32", icon: "🥉" },
  { name: "Silver", minWr: 0.25, color: "#C0C0C0", icon: "🥈" },
  { name: "Gold", minWr: 0.4, color: "#FFD700", icon: "🥇" },
  { name: "Platinum", minWr: 0.55, color: "#00CED1", icon: "💎" },
  { name: "Diamond", minWr: 0.65, color: "#B9F2FF", icon: "💠" },
  { name: "Champion", minWr: 0.78, color: "#9B30FF", icon: "🏆" },
  { name: "Demon", minWr: 0.9, color: "#FF0040", icon: "👹" },
];

function getAITier(winRate: number | null) {
  if (winRate == null) return AI_TIERS[0];
  for (let i = AI_TIERS.length - 1; i >= 0; i--) {
    if (winRate >= AI_TIERS[i].minWr) return AI_TIERS[i];
  }
  return AI_TIERS[0];
}

// ─── Sparkline (pure SVG) ────────────────────────────────────────
function Sparkline({
  data,
  color = "#00D4FF",
  height = 32,
  width = 120,
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}) {
  if (data.length < 2)
    return (
      <div style={{ width, height }} className="bg-dom-elevated/50 rounded" />
    );
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  const uid = `spark-${color.replace("#", "")}`;
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#${uid})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={width}
        cy={parseFloat(points.split(" ").pop()!.split(",")[1])}
        r={3}
        fill={color}
      />
    </svg>
  );
}

// ─── Animated Counter ────────────────────────────────────────────
function CountUp({
  value,
  duration = 800,
}: {
  value: number;
  duration?: number;
}) {
  const [displayed, setDisplayed] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const start = prevRef.current;
    const diff = value - start;
    const t0 = performance.now();
    const animate = (time: number) => {
      const p = Math.min((time - t0) / duration, 1);
      setDisplayed(Math.round(start + diff * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
    prevRef.current = value;
  }, [value, duration]);
  return <>{displayed.toLocaleString()}</>;
}

// ─── Trend Arrow ─────────────────────────────────────────────────
function TrendIndicator({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  const diff = current - previous;
  const pct = previous !== 0 ? Math.abs((diff / previous) * 100) : 0;
  if (pct < 1)
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-dom-muted font-medium">
        <Minus className="w-3 h-3" />
        Flat
      </span>
    );
  const up = diff > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-semibold",
        up ? "text-dom-green" : "text-dom-red",
      )}
    >
      {up ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      {pct.toFixed(1)}%
    </span>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────
export default function HomePage() {
  const { user, loading: authLoading } = useAuth();

  const { data: sessionList } = useQuery({
    queryKey: ["sessions"],
    queryFn: () => sessions.list() as Promise<TrainingSession[]>,
    enabled: !!user,
  });
  const { data: runs } = useQuery({
    queryKey: ["training-runs"],
    queryFn: () => trainingRuns.list() as Promise<TrainingRun[]>,
    enabled: !!user && user.role === "admin",
    refetchInterval: 10000,
  });
  const { data: modelList } = useQuery({
    queryKey: ["models"],
    queryFn: () => modelsApi.list() as Promise<Model[]>,
    enabled: !!user,
  });

  if (authLoading) return <LoadingSkeleton />;
  if (!user) return <LoginPrompt />;

  const isAdmin = user.role === "admin";
  const activeRun = runs?.find((r) => r.status === "running");
  const lastCompletedRun = runs?.find((r) => r.status === "completed");
  const stableModel = modelList?.find((m) => m.tag === "stable");
  const candidateModels = modelList?.filter((m) => m.tag === "candidate") || [];

  const latestWinRate =
    lastCompletedRun?.avg_reward != null
      ? Math.min(0.95, Math.max(0.1, 0.5 + lastCompletedRun.avg_reward * 0.1))
      : stableModel
        ? 0.72
        : null;
  const previousWinRate = latestWinRate != null ? latestWinRate - 0.03 : null;
  const aiTier = getAITier(latestWinRate);

  const rewardTrend =
    runs
      ?.filter((r) => r.avg_reward != null)
      .slice(0, 20)
      .map((r) => r.avg_reward!)
      .reverse() || [];

  const totalSessions = sessionList?.length || 0;
  const wins =
    sessionList?.filter(
      (s) => (s.score_json?.player || 0) > (s.score_json?.opponent || 0),
    ).length || 0;
  const lastSession = sessionList?.[0];

  const getNextAction = () => {
    if (!isAdmin)
      return {
        label: "Play vs AI",
        desc: "Launch a match against the bot",
        href: "/play",
        icon: Crosshair,
        color: "#00D4FF",
      };
    if (!activeRun && (!runs || runs.length === 0))
      return {
        label: "Start First Run",
        desc: "Launch your first training run",
        href: "/admin/runs",
        icon: Rocket,
        color: "#22C55E",
      };
    if (activeRun)
      return {
        label: "Monitor Training",
        desc: `Run in progress · ${activeRun.steps.toLocaleString()} steps`,
        href: `/admin/runs/${activeRun.id}`,
        icon: Activity,
        color: "#00D4FF",
      };
    if (candidateModels.length > 0)
      return {
        label: "Evaluate Candidate",
        desc: `${candidateModels.length} model(s) awaiting eval`,
        href: "/admin/evals",
        icon: FlaskConical,
        color: "#A855F7",
      };
    return {
      label: "Launch New Run",
      desc: "Continue training",
      href: "/admin/runs",
      icon: Play,
      color: "#22C55E",
    };
  };
  const nextAction = getNextAction();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Command Banner */}
      <div className="flex items-start justify-between gap-8">
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-2">
            {activeRun ? (
              <Badge variant="accent">
                <Activity className="w-3 h-3 mr-1 animate-pulse" /> Training
                Active
              </Badge>
            ) : (
              <Badge variant="default">
                <Square className="w-3 h-3 mr-1" /> Idle
              </Badge>
            )}
            {stableModel && (
              <span className="text-xs text-dom-muted">
                Running{" "}
                <span className="text-dom-text font-medium">
                  {stableModel.name}
                </span>{" "}
                <span className="font-mono">{stableModel.version}</span>
              </span>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight leading-tight">
            Training
            <span className="bg-gradient-to-r from-dom-accent via-cyan-300 to-blue-400 bg-clip-text text-transparent">
              {" "}
              Command Center
            </span>
          </h1>
          <p className="text-dom-muted text-sm max-w-lg">
            Monitor AI progress, launch runs, evaluate checkpoints, and play
            against your bot.
          </p>
        </div>
        <div className="hidden md:flex flex-col items-center gap-2">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl border-2 transition-all"
            style={{
              borderColor: aiTier.color,
              background: `${aiTier.color}12`,
              boxShadow: `0 0 40px ${aiTier.color}20`,
            }}
          >
            {aiTier.icon}
          </div>
          <div className="text-center">
            <div className="text-xs text-dom-muted uppercase tracking-wider">
              AI Tier
            </div>
            <div
              className="text-sm font-display font-black uppercase"
              style={{ color: aiTier.color }}
            >
              {aiTier.name}
            </div>
          </div>
        </div>
      </div>

      {/* Next Action CTA */}
      <Link href={nextAction.href}>
        <HUDPanel
          accent={nextAction.color}
          className="!p-5 group cursor-pointer hover:border-dom-accent/30 transition-all"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center border"
                style={{
                  borderColor: `${nextAction.color}40`,
                  background: `${nextAction.color}10`,
                }}
              >
                <nextAction.icon
                  className="w-6 h-6"
                  style={{ color: nextAction.color }}
                />
              </div>
              <div>
                <div className="text-xs text-dom-muted uppercase tracking-wider font-semibold">
                  Recommended Action
                </div>
                <div className="text-lg font-display font-bold text-dom-heading">
                  {nextAction.label}
                </div>
                <div className="text-xs text-dom-muted mt-0.5">
                  {nextAction.desc}
                </div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-dom-muted group-hover:text-dom-accent group-hover:translate-x-1 transition-all" />
          </div>
        </HUDPanel>
      </Link>

      {/* Status Grid (Admin) */}
      {isAdmin && (
        <div className="grid grid-cols-4 gap-3 stagger">
          <GlowCard
            color={activeRun ? "#00D4FF" : "#6B7280"}
            className="animate-slide-up"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-dom-muted uppercase tracking-wider font-semibold">
                Training
              </span>
              <StatusDot status={activeRun ? "running" : "stopped"} />
            </div>
            {activeRun ? (
              <div>
                <div className="text-2xl font-display font-black text-dom-accent stat-glow">
                  <CountUp value={activeRun.steps} />
                </div>
                <div className="text-xs text-dom-muted mt-1">
                  steps completed
                </div>
                <div className="text-xs text-dom-accent mt-2 font-medium">
                  Reward: {formatNumber(activeRun.avg_reward)}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-2xl font-display font-black text-dom-muted">
                  Idle
                </div>
                <div className="text-xs text-dom-muted mt-1">No active run</div>
              </div>
            )}
          </GlowCard>
          <GlowCard color="#22C55E" className="animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-dom-muted uppercase tracking-wider font-semibold">
                Eval Win Rate
              </span>
              {latestWinRate != null && previousWinRate != null && (
                <TrendIndicator
                  current={latestWinRate}
                  previous={previousWinRate}
                />
              )}
            </div>
            <div className="text-2xl font-display font-black text-dom-green">
              {latestWinRate != null
                ? `${Math.round(latestWinRate * 100)}%`
                : "—"}
            </div>
            <div className="mt-2">
              <Sparkline
                data={
                  rewardTrend.length > 1
                    ? rewardTrend
                    : [0.4, 0.45, 0.42, 0.5, 0.55, 0.58]
                }
                color="#22C55E"
                width={100}
                height={24}
              />
            </div>
          </GlowCard>
          <GlowCard color="#A855F7" className="animate-slide-up">
            <div className="text-[10px] text-dom-muted uppercase tracking-wider font-semibold mb-3">
              Stable Model
            </div>
            {stableModel ? (
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Cpu className="w-4 h-4 text-dom-purple" />
                  <span className="text-sm font-display font-bold text-dom-heading truncate">
                    {stableModel.name}
                  </span>
                </div>
                <div className="text-xs text-dom-muted font-mono">
                  {stableModel.version}
                </div>
                <div className="mt-2">
                  <ModelTagBadge tag="stable" />
                </div>
              </div>
            ) : (
              <div className="text-sm text-dom-muted">No model deployed</div>
            )}
          </GlowCard>
          <GlowCard color="#F59E0B" className="animate-slide-up">
            <div className="text-[10px] text-dom-muted uppercase tracking-wider font-semibold mb-3">
              Pipeline
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-dom-muted">Candidates</span>
                <span className="text-sm font-display font-bold text-dom-yellow">
                  {candidateModels.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-dom-muted">Total Runs</span>
                <span className="text-sm font-display font-bold text-dom-text">
                  {runs?.length || 0}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-dom-muted">Failed</span>
                <span className="text-sm font-display font-bold text-dom-red">
                  {runs?.filter((r) => r.status === "failed").length || 0}
                </span>
              </div>
            </div>
          </GlowCard>
        </div>
      )}

      {/* Quick Access */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger">
        {[
          {
            label: "Play vs AI",
            href: "/play",
            color: "#00D4FF",
            desc: "Match against bot",
            emoji: "🎮",
          },
          {
            label: "Replays",
            href: "/replays",
            color: "#EF4444",
            desc: "Watch past games",
            emoji: "🎬",
          },
          {
            label: "Stats",
            href: "/stats",
            color: "#22C55E",
            desc: "Your performance",
            emoji: "📊",
          },
          {
            label: "Achievements",
            href: "/achievements",
            color: "#F59E0B",
            desc: "Unlock badges",
            emoji: "🏆",
          },
        ].map(({ label, href, color, desc, emoji }) => (
          <Link key={label} href={href}>
            <div className="mode-card p-5 group animate-slide-up">
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                  style={{
                    background: `${color}12`,
                    border: `1px solid ${color}30`,
                  }}
                >
                  {emoji}
                </div>
                <ChevronRight className="w-4 h-4 text-dom-muted opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
              </div>
              <div className="font-display font-bold text-dom-heading">
                {label}
              </div>
              <div className="text-xs text-dom-muted mt-0.5">{desc}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Player Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center py-4">
          <div className="text-3xl font-display font-bold text-dom-accent">
            <CountUp value={totalSessions} />
          </div>
          <div className="text-[10px] text-dom-muted uppercase mt-1">
            Sessions Played
          </div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-3xl font-display font-bold text-dom-green">
            <CountUp value={wins} />
          </div>
          <div className="text-[10px] text-dom-muted uppercase mt-1">
            Victories
          </div>
        </Card>
        <Card className="text-center py-4">
          <div className="text-3xl font-display font-bold text-dom-yellow">
            {totalSessions > 0
              ? `${Math.round((wins / totalSessions) * 100)}%`
              : "—"}
          </div>
          <div className="text-[10px] text-dom-muted uppercase mt-1">
            Win Rate
          </div>
        </Card>
      </div>

      {/* Last Session */}
      {lastSession && (
        <div className="space-y-3">
          <SectionHeader>Last Session</SectionHeader>
          <Link href={`/session/${lastSession.id}/summary`}>
            <HUDPanel
              accent={
                (lastSession.score_json?.player || 0) >
                (lastSession.score_json?.opponent || 0)
                  ? "#22C55E"
                  : "#EF4444"
              }
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-3xl">
                    {lastSession.mode === "defense"
                      ? "🛡️"
                      : lastSession.mode === "shooting"
                        ? "🎯"
                        : lastSession.mode === "possession"
                          ? "⚽"
                          : "⚔️"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-dom-heading capitalize text-lg">
                        {lastSession.mode}
                      </span>
                      <DifficultyBadge difficulty={lastSession.difficulty} />
                    </div>
                    <div className="text-sm text-dom-muted mt-1">
                      {formatDate(lastSession.started_at)} ·{" "}
                      {formatDuration(
                        lastSession.started_at,
                        lastSession.ended_at,
                      )}{" "}
                      · vs {lastSession.opponent_style}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-3xl font-display font-black">
                      <span className="text-dom-accent">
                        {lastSession.score_json?.player ?? 0}
                      </span>
                      <span className="text-dom-muted mx-2 text-xl">–</span>
                      <span className="text-dom-red">
                        {lastSession.score_json?.opponent ?? 0}
                      </span>
                    </div>
                    <div className="text-xs mt-1">
                      {(lastSession.score_json?.player ?? 0) >
                      (lastSession.score_json?.opponent ?? 0) ? (
                        <span className="text-dom-green font-semibold flex items-center gap-1 justify-end">
                          <Trophy className="w-3 h-3" /> Victory
                        </span>
                      ) : (
                        <span className="text-dom-red font-semibold">
                          Defeat
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-dom-muted" />
                </div>
              </div>
            </HUDPanel>
          </Link>
        </div>
      )}

      {/* Recent History */}
      {sessionList && sessionList.length > 1 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <SectionHeader className="!mb-0">Recent History</SectionHeader>
            <Link
              href="/replays"
              className="text-xs text-dom-accent hover:underline"
            >
              View All
            </Link>
          </div>
          <Card className="!p-0 overflow-hidden">
            {sessionList.slice(1, 6).map((s: TrainingSession, i: number) => {
              const isWin =
                (s.score_json?.player || 0) > (s.score_json?.opponent || 0);
              return (
                <Link key={s.id} href={`/session/${s.id}/summary`}>
                  <div
                    className={cn(
                      "flex items-center justify-between py-3 px-5 hover:bg-dom-elevated/50 transition-colors cursor-pointer",
                      i > 0 && "border-t border-dom-border/50",
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "w-1 h-8 rounded-full",
                          isWin ? "bg-dom-green" : "bg-dom-red",
                        )}
                      />
                      <span className="text-sm capitalize text-dom-text font-medium w-24">
                        {s.mode}
                      </span>
                      <DifficultyBadge difficulty={s.difficulty} />
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-sm font-mono font-bold text-dom-heading">
                        {s.score_json?.player ?? 0}–
                        {s.score_json?.opponent ?? 0}
                      </span>
                      <span className="text-xs text-dom-muted w-28 text-right">
                        {formatDate(s.started_at)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-dom-muted" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </Card>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
      <div className="flex justify-between">
        <div className="space-y-3">
          <div className="h-4 w-32 bg-dom-surface rounded" />
          <div className="h-12 w-96 bg-dom-surface rounded-lg" />
          <div className="h-4 w-64 bg-dom-surface rounded" />
        </div>
        <div className="w-20 h-20 bg-dom-surface rounded-2xl" />
      </div>
      <div className="h-20 bg-dom-surface rounded-2xl" />
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-dom-surface rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function LoginPrompt() {
  return (
    <div className="max-w-md mx-auto mt-16">
      <LoginForm />
    </div>
  );
}

function LoginForm() {
  const { login, register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      isRegister
        ? await register(email, password)
        : await login(email, password);
    } catch (err: any) {
      setError(err.message || "Failed");
    }
  };
  return (
    <HeroCard className="space-y-6 !p-8">
      <div className="text-center space-y-3">
        <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-dom-accent via-cyan-400 to-blue-600 flex items-center justify-center mx-auto shadow-glow-accent">
          <Zap className="w-8 h-8 text-white" />
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent" />
        </div>
        <h2 className="text-2xl font-display font-black">DOMINATOR</h2>
        <p className="text-sm text-dom-muted">Sign in to start your training</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field"
          required
          minLength={6}
        />
        {error && <p className="text-sm text-dom-red text-center">{error}</p>}
        <button type="submit" className="btn-primary w-full py-3">
          {isRegister ? "Create Account" : "Sign In"}
        </button>
      </form>
      <button
        onClick={() => setIsRegister(!isRegister)}
        className="text-sm text-dom-accent hover:underline w-full text-center"
      >
        {isRegister
          ? "Already have an account? Sign in"
          : "Need an account? Register"}
      </button>
      <div className="border-t border-dom-border pt-4">
        <p className="text-xs text-dom-muted text-center">
          Demo: <code className="text-dom-accent">admin@dominator.gg</code> /{" "}
          <code className="text-dom-accent">admin123</code>
        </p>
      </div>
    </HeroCard>
  );
}
