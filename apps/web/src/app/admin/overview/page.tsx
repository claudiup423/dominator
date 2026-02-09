"use client";

import { useQuery } from "@tanstack/react-query";
import { models as modelsApi, trainingRuns, trainingControl } from "@/lib/api";
import { Card, GlowCard } from "@/components/ui/Card";
import {
  ModelTagBadge,
  StatusDot,
  HealthIndicator,
  SectionHeader,
  Badge,
} from "@/components/ui/Badge";
import { formatNumber, formatDate, cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Cpu,
  TrendingUp,
  TrendingDown,
  Shield,
  CheckCircle,
  XCircle,
  Minus,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import type { Model, TrainingRun } from "@/types";

// ─── Types for eval data ─────────────────────────────────────────
interface EvalResult {
  checkpoint_step: number;
  rating_before: number;
  rating_after: number;
  timestamp: string;
  regression: boolean;
  reasons: string[];
  results: Record<
    string,
    {
      winrate: number;
      goals_for: number;
      goals_against: number;
      goal_diff: number;
    }
  >;
}

interface EloState {
  dominance_rating: number;
  history: { step: number; rating: number; timestamp: string }[];
}

// ─── Sparkline (pure SVG, no recharts) ───────────────────────────
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
  const uid = `spark-ov-${color.replace("#", "")}`;
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

// ─── Area Chart (pure SVG, replaces recharts) ────────────────────
function AreaChartSVG({
  data,
  xKey,
  yKey,
  color,
  height = 240,
  yDomain,
  yFormat,
  baselineKey,
}: {
  data: { [k: string]: any }[];
  xKey: string;
  yKey: string;
  color: string;
  height?: number;
  yDomain?: [number, number];
  yFormat?: (v: number) => string;
  baselineKey?: string;
}) {
  if (!data || data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-dom-muted text-sm"
        style={{ height }}
      >
        Not enough data points yet
      </div>
    );
  }

  const W = 600,
    H = height;
  const PAD = { top: 16, right: 16, bottom: 32, left: 52 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const values = data.map((d) => d[yKey] as number);
  const minY = yDomain
    ? yDomain[0]
    : Math.floor(Math.min(...values) * 10) / 10 - 0.05;
  const maxY = yDomain
    ? yDomain[1]
    : Math.ceil(Math.max(...values) * 10) / 10 + 0.05;
  const rangeY = maxY - minY || 1;

  const xScale = (i: number) =>
    PAD.left + (i / Math.max(data.length - 1, 1)) * plotW;
  const yScale = (v: number) => PAD.top + plotH - ((v - minY) / rangeY) * plotH;

  const line = data
    .map(
      (d, i) =>
        `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(d[yKey]).toFixed(1)}`,
    )
    .join(" ");
  const area = `${line} L ${xScale(data.length - 1).toFixed(1)} ${yScale(minY).toFixed(1)} L ${xScale(0).toFixed(1)} ${yScale(minY).toFixed(1)} Z`;

  // Y-axis ticks
  const yTicks: number[] = [];
  const tickCount = 5;
  for (let i = 0; i <= tickCount; i++) {
    yTicks.push(minY + (rangeY / tickCount) * i);
  }

  // X-axis labels (show ~5 evenly spaced)
  const xLabelCount = Math.min(5, data.length);
  const xLabels: number[] = [];
  for (let i = 0; i < xLabelCount; i++) {
    xLabels.push(
      Math.round((i / Math.max(xLabelCount - 1, 1)) * (data.length - 1)),
    );
  }

  const gradId = `areaGrad-${color.replace("#", "")}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            y1={yScale(v)}
            x2={W - PAD.right}
            y2={yScale(v)}
            stroke="currentColor"
            className="text-dom-border"
            strokeDasharray="4 4"
            strokeWidth={0.5}
          />
          <text
            x={PAD.left - 8}
            y={yScale(v) + 3}
            textAnchor="end"
            className="text-dom-muted"
            fontSize={10}
            fill="currentColor"
          >
            {yFormat ? yFormat(v) : v.toFixed(2)}
          </text>
        </g>
      ))}

      {/* Baseline */}
      {baselineKey && data[0]?.[baselineKey] != null && (
        <line
          x1={PAD.left}
          y1={yScale(data[0][baselineKey])}
          x2={W - PAD.right}
          y2={yScale(data[0][baselineKey])}
          stroke="currentColor"
          className="text-dom-muted"
          strokeDasharray="3 5"
          strokeWidth={0.8}
          opacity={0.5}
        />
      )}

      {/* Area + Line */}
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots */}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={xScale(i)}
          cy={yScale(d[yKey])}
          r={data.length > 30 ? 1.5 : 3}
          fill={color}
          opacity={data.length > 30 ? 0.6 : 1}
        >
          <title>
            {d[xKey]}:{" "}
            {typeof d[yKey] === "number"
              ? yFormat
                ? yFormat(d[yKey])
                : d[yKey].toFixed(3)
              : d[yKey]}
          </title>
        </circle>
      ))}

      {/* X-axis labels */}
      {xLabels.map((i) => (
        <text
          key={i}
          x={xScale(i)}
          y={H - 6}
          textAnchor="middle"
          className="text-dom-muted"
          fontSize={9}
          fill="currentColor"
        >
          {data[i]?.[xKey] ?? ""}
        </text>
      ))}
    </svg>
  );
}

// ─── Trend Indicator ─────────────────────────────────────────────
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
        <Minus className="w-3 h-3" /> Flat
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

// ─── Main ────────────────────────────────────────────────────────
export default function AdminOverview() {
  const { data: modelList } = useQuery({
    queryKey: ["models"],
    queryFn: () => modelsApi.list() as Promise<Model[]>,
  });
  const { data: runs } = useQuery({
    queryKey: ["training-runs"],
    queryFn: () => trainingRuns.list() as Promise<TrainingRun[]>,
    refetchInterval: 10000,
  });
  const { data: evalResults } = useQuery({
    queryKey: ["eval-results"],
    queryFn: () => trainingControl.evalResults() as Promise<EvalResult[]>,
    refetchInterval: 30000,
  });
  const { data: eloState } = useQuery({
    queryKey: ["eval-elo"],
    queryFn: () => trainingControl.evalElo() as Promise<EloState>,
    refetchInterval: 30000,
  });

  const stableModel = modelList?.find((m) => m.tag === "stable");
  const candidates = modelList?.filter((m) => m.tag === "candidate") || [];
  const runningRuns = runs?.filter((r) => r.status === "running") || [];
  const failedRuns = runs?.filter((r) => r.status === "failed") || [];
  const completedRuns = runs?.filter((r) => r.status === "completed") || [];

  // ─── Derive chart data from REAL sources ─────────────────────

  // Win Rate Trend: from eval results (baseline winrate per checkpoint)
  const evalTrend = (evalResults || [])
    .slice()
    .sort((a, b) => a.checkpoint_step - b.checkpoint_step)
    .map((ev) => {
      const baselineWr = ev.results?.baseline?.winrate;
      const avgWr =
        Object.values(ev.results || {}).reduce(
          (sum, r) => sum + (r.winrate || 0),
          0,
        ) / Math.max(Object.keys(ev.results || {}).length, 1);
      return {
        name: `${(ev.checkpoint_step / 1e6).toFixed(1)}M`,
        winRate: avgWr,
        baseline: 0.5,
      };
    });

  // Reward Curve: from actual training runs sorted by start time
  const rewardTrend = (runs || [])
    .filter((r) => r.avg_reward != null && r.steps > 0)
    .sort((a, b) => (a.started_at || "").localeCompare(b.started_at || ""))
    .map((r) => ({
      step:
        r.steps >= 1e6
          ? `${(r.steps / 1e6).toFixed(1)}M`
          : `${(r.steps / 1e3).toFixed(0)}k`,
      reward: r.avg_reward!,
    }));

  // Elo trend sparkline data
  const eloSparkData = (eloState?.history || []).map((h) => h.rating);

  // Latest eval for quick stat
  const latestEval =
    evalResults && evalResults.length > 0
      ? evalResults.reduce((a, b) =>
          a.checkpoint_step > b.checkpoint_step ? a : b,
        )
      : null;

  const regressionCount = (evalResults || []).filter(
    (e) => e.regression,
  ).length;

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight">
          Command Center Overview
        </h1>
        <p className="text-sm text-dom-muted mt-1">
          Model health, training progress, and evaluation trends — all from live
          data.
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-3 gap-4 stagger">
        <GlowCard color="#22C55E" className="animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-dom-muted uppercase tracking-wider font-semibold">
              Stable Model
            </span>
            <HealthIndicator status={stableModel ? "healthy" : "warning"} />
          </div>
          {stableModel ? (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Cpu className="w-4 h-4 text-dom-green" />
                <span className="text-lg font-display font-bold text-dom-heading">
                  {stableModel.name}
                </span>
              </div>
              <div className="text-sm text-dom-muted font-mono">
                {stableModel.version}
              </div>
              <div className="flex items-center gap-2 mt-3">
                <ModelTagBadge tag="stable" />
                {stableModel.params_count && (
                  <span className="text-xs text-dom-muted">
                    {(stableModel.params_count / 1e6).toFixed(1)}M params
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-dom-muted">
              No stable model deployed
            </div>
          )}
        </GlowCard>

        <GlowCard color="#00D4FF" className="animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-dom-muted uppercase tracking-wider font-semibold">
              Active Runs
            </span>
            <StatusDot
              status={runningRuns.length > 0 ? "running" : "stopped"}
            />
          </div>
          <div className="flex items-end gap-3">
            <div className="text-5xl font-display font-black text-dom-accent stat-glow">
              {runningRuns.length}
            </div>
            <div className="pb-2">
              <div className="text-sm text-dom-text font-medium">
                {runs?.length || 0} total
              </div>
              <div className="text-xs text-dom-muted">
                {completedRuns.length} completed · {failedRuns.length} failed
              </div>
            </div>
          </div>
        </GlowCard>

        <GlowCard color="#A855F7" className="animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-dom-muted uppercase tracking-wider font-semibold">
              Candidates
            </span>
            {candidates.length > 0 && (
              <Badge variant="accent">{candidates.length} pending</Badge>
            )}
          </div>
          <div className="flex items-end gap-3">
            <div className="text-5xl font-display font-black text-dom-purple">
              {candidates.length}
            </div>
            <div className="pb-2">
              <div className="text-sm text-dom-text font-medium">
                Awaiting eval
              </div>
              {candidates.length > 0 && (
                <Link
                  href="/admin/evals"
                  className="text-xs text-dom-accent hover:underline"
                >
                  Run evaluation →
                </Link>
              )}
            </div>
          </div>
        </GlowCard>
      </div>

      {/* Elo Summary Row */}
      {eloState && (
        <div className="grid grid-cols-4 gap-3">
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-dom-accent/5 to-blue-600/5" />
            <div className="relative">
              <div className="text-xs text-dom-muted uppercase tracking-wider font-semibold mb-1">
                Elo Rating
              </div>
              <div className="text-3xl font-display font-black text-dom-heading">
                {eloState.dominance_rating?.toFixed(0) || "1000"}
              </div>
              {eloSparkData.length > 1 && (
                <div className="mt-2">
                  <Sparkline
                    data={eloSparkData}
                    color="#00D4FF"
                    width={100}
                    height={24}
                  />
                </div>
              )}
            </div>
          </Card>
          <Card>
            <div className="text-xs text-dom-muted uppercase tracking-wider font-semibold mb-1">
              Evals Run
            </div>
            <div className="text-3xl font-display font-bold text-dom-heading">
              {evalResults?.length || 0}
            </div>
            <div className="text-xs text-dom-muted mt-1">total evaluations</div>
          </Card>
          <Card>
            <div className="text-xs text-dom-muted uppercase tracking-wider font-semibold mb-1">
              Latest Eval
            </div>
            <div className="text-lg font-display font-bold text-dom-heading">
              {latestEval
                ? `Step ${(latestEval.checkpoint_step / 1e6).toFixed(1)}M`
                : "—"}
            </div>
            {latestEval && (
              <div
                className={cn(
                  "text-xs font-semibold mt-1 flex items-center gap-1",
                  latestEval.rating_after >= latestEval.rating_before
                    ? "text-dom-green"
                    : "text-dom-red",
                )}
              >
                {latestEval.rating_after >= latestEval.rating_before ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {latestEval.rating_after >= latestEval.rating_before ? "+" : ""}
                {(latestEval.rating_after - latestEval.rating_before).toFixed(
                  1,
                )}{" "}
                Elo
              </div>
            )}
          </Card>
          <Card className={regressionCount > 0 ? "border-dom-red/20" : ""}>
            <div className="text-xs text-dom-muted uppercase tracking-wider font-semibold mb-1">
              Regressions
            </div>
            <div
              className={cn(
                "text-3xl font-display font-bold",
                regressionCount > 0 ? "text-dom-red" : "text-dom-green",
              )}
            >
              {regressionCount}
            </div>
            <div className="text-xs text-dom-muted mt-1">
              {regressionCount === 0
                ? "All evals healthy"
                : `${regressionCount} detected`}
            </div>
          </Card>
        </div>
      )}

      {/* Charts — Real Data */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <SectionHeader>Win Rate Trend (Eval Results)</SectionHeader>
          <Card className="!p-4">
            {evalTrend.length >= 2 ? (
              <AreaChartSVG
                data={evalTrend}
                xKey="name"
                yKey="winRate"
                color="#00D4FF"
                height={240}
                yDomain={[0, 1]}
                yFormat={(v) => `${(v * 100).toFixed(0)}%`}
                baselineKey="baseline"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-12">
                <RefreshCw className="w-8 h-8 text-dom-muted/30 mb-3" />
                <div className="text-sm text-dom-muted">
                  Need at least 2 eval results to show win rate trend.
                </div>
                <Link
                  href="/admin/evals"
                  className="text-xs text-dom-accent hover:underline mt-2"
                >
                  Go to Evaluations →
                </Link>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-3">
          <SectionHeader>Reward Curve (Training Runs)</SectionHeader>
          <Card className="!p-4">
            {rewardTrend.length >= 2 ? (
              <AreaChartSVG
                data={rewardTrend}
                xKey="step"
                yKey="reward"
                color="#22C55E"
                height={240}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-12">
                <RefreshCw className="w-8 h-8 text-dom-muted/30 mb-3" />
                <div className="text-sm text-dom-muted">
                  Need at least 2 completed runs to show reward curve.
                </div>
                <Link
                  href="/admin/runs"
                  className="text-xs text-dom-accent hover:underline mt-2"
                >
                  Go to Training Runs →
                </Link>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Elo History Chart */}
      {eloState && eloState.history && eloState.history.length >= 2 && (
        <div className="space-y-3">
          <SectionHeader>Elo Rating Over Time</SectionHeader>
          <Card className="!p-4">
            <AreaChartSVG
              data={eloState.history.map((h) => ({
                name: `${(h.step / 1e6).toFixed(1)}M`,
                rating: h.rating,
              }))}
              xKey="name"
              yKey="rating"
              color="#A855F7"
              height={200}
            />
          </Card>
        </div>
      )}

      {/* Regression Alerts */}
      <div className="space-y-3">
        <SectionHeader>Regression Alerts</SectionHeader>

        {/* From eval regressions */}
        {evalResults && evalResults.filter((e) => e.regression).length > 0 ? (
          <div className="space-y-2">
            {evalResults
              .filter((e) => e.regression)
              .slice(0, 5)
              .map((ev) => (
                <Card
                  key={ev.checkpoint_step}
                  className="flex items-start gap-4 border-dom-red/20"
                >
                  <div className="w-10 h-10 rounded-xl bg-dom-red/10 flex items-center justify-center flex-shrink-0 border border-dom-red/20">
                    <AlertTriangle className="w-5 h-5 text-dom-red" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-dom-heading">
                        Regression at Step {ev.checkpoint_step.toLocaleString()}
                      </div>
                      <span className="text-xs text-dom-muted">
                        {formatDate(ev.timestamp)}
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {ev.reasons.map((r, i) => (
                        <div key={i} className="text-xs text-dom-red/80">
                          • {r}
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-dom-muted mt-1.5">
                      Elo: {ev.rating_before.toFixed(0)} →{" "}
                      {ev.rating_after.toFixed(0)}
                      <span className="text-dom-red ml-1 font-semibold">
                        ({(ev.rating_after - ev.rating_before).toFixed(1)})
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
          </div>
        ) : failedRuns.length > 0 ? (
          <div className="space-y-2">
            {failedRuns.map((run) => (
              <Card
                key={run.id}
                className="flex items-center gap-4 border-dom-red/20"
              >
                <div className="text-2xl">🚨</div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-dom-heading">
                    Training Run Failed
                  </div>
                  <div className="text-xs text-dom-muted mt-0.5">
                    {run.steps.toLocaleString()} steps · Reward:{" "}
                    {formatNumber(run.avg_reward)} · {formatDate(run.ended_at)}
                  </div>
                </div>
                <span className="text-xs font-bold text-dom-red uppercase">
                  Failed
                </span>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-dom-green/10 flex items-center justify-center border border-dom-green/20">
              <CheckCircle className="w-4 h-4 text-dom-green" />
            </div>
            <span className="text-sm text-dom-muted">
              All systems nominal. No regressions detected.
            </span>
          </Card>
        )}
      </div>
    </div>
  );
}
