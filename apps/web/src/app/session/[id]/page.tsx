"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { sessions } from "@/lib/api";
import { Card, HUDPanel, HeroCard, GlowCard } from "@/components/ui/Card";
import { DifficultyBadge, SectionHeader, Badge } from "@/components/ui/Badge";
import { formatDate, formatDuration, cn } from "@/lib/utils";
import {
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  Download,
  Trophy,
  XCircle,
  Target,
  Shield,
  Swords,
  TrendingUp,
  Zap,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import type { SessionSummary, SessionInsight } from "@/types";

const MODE_EMOJI: Record<string, string> = {
  defense: "🛡️",
  shooting: "🎯",
  possession: "⚽",
  "50/50s": "⚔️",
};

const MODE_ICONS: Record<string, any> = {
  defense: Shield,
  shooting: Target,
  possession: TrendingUp,
  "50/50s": Swords,
};

export default function SummaryPage() {
  const params = useParams();
  const sessionId = params.id as string;

  const {
    data: summary,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["session-summary", sessionId],
    queryFn: () =>
      sessions.summary(sessionId) as Promise<
        SessionSummary & { summary?: string }
      >,
  });

  if (isLoading || !summary) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse space-y-6">
        <div className="h-10 w-64 bg-dom-surface rounded" />
        <div className="h-48 bg-dom-surface rounded-2xl" />
        <div className="h-32 bg-dom-surface rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-dom-surface rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-dom-surface rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto mt-16 text-center">
        <div className="text-4xl mb-4">😵</div>
        <h2 className="text-xl font-display font-bold text-dom-heading">
          Session Not Found
        </h2>
        <p className="text-sm text-dom-muted mt-2">
          This session may not exist or you don&apos;t have access to it.
        </p>
        <Link href="/" className="btn-primary mt-4 inline-flex">
          Go Home
        </Link>
      </div>
    );
  }

  const { session, insights, recommended_drill, events } = summary;
  const coachSummary = (summary as any).summary as string | undefined;
  const playerScore = session.score_json?.player ?? 0;
  const opponentScore = session.score_json?.opponent ?? 0;
  const isWin = playerScore > opponentScore;
  const isDraw = playerScore === opponentScore;

  // Compute quick stats from events
  const shots = events.filter((e) => e.type === "shot").length;
  const saves = events.filter((e) => e.type === "save").length;
  const boosts = events.filter((e) => e.type === "boost_pickup").length;
  const aerials = events.filter((e) => e.type === "aerial").length;
  const demos = events.filter((e) => e.type === "demo").length;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">{MODE_EMOJI[session.mode] || "⚡"}</span>
            <h1 className="text-2xl font-display font-black">Match Analysis</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-dom-muted">
            <span className="capitalize">{session.mode}</span>
            <span>·</span>
            <DifficultyBadge difficulty={session.difficulty} />
            <span>·</span>
            <span>vs {session.opponent_style}</span>
            <span>·</span>
            <span>{formatDate(session.started_at)}</span>
            <span>·</span>
            <span>{formatDuration(session.started_at, session.ended_at)}</span>
          </div>
        </div>
        <button
          onClick={() => {
            const blob = new Blob([JSON.stringify(summary, null, 2)], {
              type: "application/json",
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `session_${sessionId}.json`;
            a.click();
          }}
          className="btn-secondary"
        >
          <Download className="w-4 h-4" /> Export
        </button>
      </div>

      {/* Score Card */}
      <HeroCard>
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            {isWin ? (
              <>
                <Trophy className="w-6 h-6 text-dom-green" />
                <span className="text-lg font-bold text-dom-green">
                  Victory!
                </span>
              </>
            ) : isDraw ? (
              <span className="text-lg font-bold text-dom-yellow">Draw</span>
            ) : (
              <>
                <XCircle className="w-6 h-6 text-dom-red" />
                <span className="text-lg font-bold text-dom-red">Defeat</span>
              </>
            )}
          </div>
          <div className="text-7xl font-display font-black tracking-tighter">
            <span
              className={
                isWin ? "text-dom-accent stat-glow" : "text-dom-heading"
              }
            >
              {playerScore}
            </span>
            <span className="text-dom-muted mx-6 text-4xl">–</span>
            <span
              className={
                !isWin && !isDraw ? "text-dom-red" : "text-dom-heading"
              }
            >
              {opponentScore}
            </span>
          </div>
          <div className="text-sm text-dom-muted">
            vs{" "}
            <span className="capitalize font-medium text-dom-text">
              {session.opponent_style}
            </span>{" "}
            opponent at{" "}
            <span className="capitalize font-medium text-dom-text">
              {session.difficulty}
            </span>{" "}
            difficulty
          </div>
        </div>
      </HeroCard>

      {/* Match Stats */}
      <div className="grid grid-cols-5 gap-3">
        <StatCard label="Shots" value={shots} icon="🎯" />
        <StatCard label="Saves" value={saves} icon="🧤" />
        <StatCard label="Boosts" value={boosts} icon="⚡" />
        <StatCard label="Aerials" value={aerials} icon="🚀" />
        <StatCard label="Demos" value={demos} icon="💥" />
      </div>

      {/* AI Coach Summary */}
      {coachSummary && (
        <div className="space-y-3">
          <SectionHeader>🤖 Coach Analysis</SectionHeader>
          <Card className="border-dom-accent/20">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-dom-accent/10 flex items-center justify-center border border-dom-accent/20 flex-shrink-0">
                <BarChart3 className="w-5 h-5 text-dom-accent" />
              </div>
              <p className="text-sm text-dom-text leading-relaxed">
                {coachSummary}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Key Insights */}
      <div className="space-y-4">
        <SectionHeader>Key Insights</SectionHeader>
        <div className="space-y-3 stagger">
          {insights.map((insight, i) => (
            <InsightCard key={i} insight={insight} index={i} />
          ))}
          {insights.length === 0 && (
            <Card className="text-center py-8 text-dom-muted text-sm">
              No insights available for this session.
            </Card>
          )}
        </div>
      </div>

      {/* Session Timeline */}
      {events.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <SectionHeader className="!mb-0">Match Timeline</SectionHeader>
            <span className="text-xs text-dom-muted">
              {events.length} events
            </span>
          </div>
          <Card className="max-h-64 overflow-y-auto !p-4">
            <div className="space-y-1">
              {events.slice(0, 50).map((evt, i) => {
                const eventEmojis: Record<string, string> = {
                  goal_scored: "⚽",
                  goal_conceded: "😤",
                  save: "🧤",
                  shot: "🎯",
                  boost_pickup: "⚡",
                  demo: "💥",
                  bookmark: "🔖",
                  aerial: "🚀",
                  clear: "🦶",
                };
                const isGoal =
                  evt.type === "goal_scored" || evt.type === "goal_conceded";
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center gap-3 text-xs py-1.5 px-2 rounded-lg hover:bg-dom-elevated/50",
                      isGoal && "bg-dom-elevated/30 font-medium",
                    )}
                  >
                    <span className="text-dom-muted font-mono w-14">
                      {Math.floor(evt.t_ms / 60000)}:
                      {String(Math.floor((evt.t_ms % 60000) / 1000)).padStart(
                        2,
                        "0",
                      )}
                    </span>
                    <span>{eventEmojis[evt.type] || "•"}</span>
                    <span
                      className={cn(
                        "capitalize text-dom-text",
                        isGoal &&
                          (evt.type === "goal_scored"
                            ? "text-dom-green"
                            : "text-dom-red"),
                      )}
                    >
                      {evt.type.replace(/_/g, " ")}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Recommended Drill */}
      {recommended_drill && recommended_drill.name && (
        <div className="space-y-4">
          <SectionHeader>What To Practice Next</SectionHeader>
          <Link href="/train">
            <GlowCard
              color="#00D4FF"
              className="cursor-pointer hover:-translate-y-0.5 transition-transform"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-dom-accent/10 flex items-center justify-center border border-dom-accent/20">
                    <Zap className="w-7 h-7 text-dom-accent" />
                  </div>
                  <div>
                    <div className="font-display font-bold text-dom-heading text-lg">
                      {recommended_drill.name}
                    </div>
                    <div className="text-sm text-dom-muted mt-0.5">
                      {recommended_drill.duration_min} min ·{" "}
                      <span className="capitalize">
                        {recommended_drill.mode}
                      </span>
                    </div>
                    {recommended_drill.focus && (
                      <div className="text-xs text-dom-accent mt-1.5 leading-relaxed max-w-md">
                        <span className="font-semibold">Why: </span>
                        {recommended_drill.focus}
                      </div>
                    )}
                  </div>
                </div>
                <button className="btn-primary">
                  Start <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </GlowCard>
          </Link>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-center gap-4 pb-8">
        <Link href="/train" className="btn-secondary">
          Play Again
        </Link>
        <Link
          href="/"
          className="btn-ghost text-sm text-dom-muted hover:text-dom-text"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: string;
}) {
  return (
    <Card className="text-center py-3 px-2">
      <div className="text-lg mb-1">{icon}</div>
      <div className="text-xl font-display font-black text-dom-heading">
        {value}
      </div>
      <div className="text-[10px] text-dom-muted uppercase tracking-wider mt-0.5">
        {label}
      </div>
    </Card>
  );
}

function InsightCard({
  insight,
  index,
}: {
  insight: SessionInsight;
  index: number;
}) {
  const config = {
    positive: {
      icon: CheckCircle,
      color: "text-dom-green",
      bg: "bg-dom-green/10",
      border: "border-dom-green/20",
      label: "Strength",
      emoji: "✅",
    },
    warning: {
      icon: AlertTriangle,
      color: "text-dom-yellow",
      bg: "bg-dom-yellow/10",
      border: "border-dom-yellow/20",
      label: "Needs Work",
      emoji: "⚠️",
    },
    tip: {
      icon: Lightbulb,
      color: "text-dom-accent",
      bg: "bg-dom-accent/10",
      border: "border-dom-accent/20",
      label: "Tip",
      emoji: "💡",
    },
  };
  const c = config[insight.type] || config.tip;
  const Icon = c.icon;

  return (
    <Card className={`border ${c.border} animate-slide-up`}>
      <div className="flex items-start gap-4">
        <div
          className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border",
            c.bg,
            c.border,
          )}
        >
          <Icon className={cn("w-5 h-5", c.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-display font-bold text-dom-heading">
              {insight.title}
            </span>
            <Badge
              variant={
                insight.type === "positive"
                  ? "success"
                  : insight.type === "warning"
                    ? "warning"
                    : "accent"
              }
            >
              {c.label}
            </Badge>
          </div>
          <p className="text-sm text-dom-muted leading-relaxed">
            {insight.detail}
          </p>
        </div>
      </div>
    </Card>
  );
}
