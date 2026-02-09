"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { trainingControl } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { SectionHeader, Badge } from "@/components/ui/Badge";
import { formatDate, cn } from "@/lib/utils";
import {
  Shield,
  Swords,
  Crown,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Zap,
  Activity,
  BarChart3,
  RefreshCw,
} from "lucide-react";

interface TierResult {
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winrate: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  avg_game_length_seconds: number;
  kickoff_goals_conceded: number;
}

interface EvalResult {
  checkpoint_step: number;
  checkpoint_path: string;
  suite: string;
  timestamp: string;
  elapsed_seconds: number;
  games_per_opponent: number;
  rating_before: number;
  rating_after: number;
  results: Record<string, TierResult>;
  regression: boolean;
  reasons: string[];
}

interface EloState {
  dominance_rating: number;
  k_factor: number;
  history: { step: number; rating: number; timestamp: string }[];
  tier_ratings: Record<string, number>;
}

interface TierConfig {
  games_per_opponent: number;
  tiers: Record<
    string,
    {
      type: string;
      path?: string;
      description?: string;
      fixed_elo?: number;
      ready?: boolean;
      metadata?: {
        source?: string;
        promoted_at?: string;
        description?: string;
      };
    }
  >;
}

const tierMeta: Record<
  string,
  { icon: any; color: string; label: string; bg: string }
> = {
  baseline: {
    icon: Shield,
    color: "#6B7280",
    label: "Baseline",
    bg: "from-gray-500/10 to-gray-600/5",
  },
  slater_tier: {
    icon: Swords,
    color: "#F59E0B",
    label: "Slater Tier",
    bg: "from-amber-500/10 to-orange-600/5",
  },
  nexto_tier: {
    icon: Crown,
    color: "#8B5CF6",
    label: "Nexto Tier",
    bg: "from-violet-500/10 to-purple-600/5",
  },
};

export default function AdminEvalsPage() {
  const [expandedEval, setExpandedEval] = useState<number | null>(null);

  const { data: evalResults, isLoading: loadingEvals } = useQuery({
    queryKey: ["eval-results"],
    queryFn: () => trainingControl.evalResults() as Promise<EvalResult[]>,
    refetchInterval: 30000,
  });
  const { data: latestEval } = useQuery({
    queryKey: ["eval-latest"],
    queryFn: () => trainingControl.evalLatest() as Promise<EvalResult | null>,
    refetchInterval: 15000,
  });
  const { data: eloState } = useQuery({
    queryKey: ["eval-elo"],
    queryFn: () => trainingControl.evalElo() as Promise<EloState>,
    refetchInterval: 30000,
  });
  const { data: tierConfig } = useQuery({
    queryKey: ["eval-tiers"],
    queryFn: () => trainingControl.evalTiers() as Promise<TierConfig>,
  });

  const hasData = latestEval && latestEval.checkpoint_step;
  const eloHistory = eloState?.history || [];

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight">
          Evaluation Results
        </h1>
        <p className="text-sm text-dom-muted mt-1">
          Frozen-tier self-play evaluation &mdash; track DominanceBot&apos;s
          true playing strength against frozen opponent checkpoints.
        </p>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-dom-accent/5 to-blue-600/5" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-dom-accent" />
              <span className="text-xs text-dom-muted font-semibold uppercase tracking-wider">
                Elo Rating
              </span>
            </div>
            <div className="text-3xl font-display font-black text-dom-heading">
              {eloState?.dominance_rating?.toFixed(0) || "1000"}
            </div>
            {latestEval && hasData && (
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
                )}
              </div>
            )}
          </div>
        </Card>

        <Card className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-dom-elevated flex items-center justify-center border border-dom-border">
            <BarChart3 className="w-5 h-5 text-dom-muted" />
          </div>
          <div>
            <div className="text-2xl font-display font-bold text-dom-heading">
              {evalResults?.length || 0}
            </div>
            <div className="text-xs text-dom-muted">Evaluations Run</div>
          </div>
        </Card>

        <Card
          className={cn(
            "flex items-center gap-3",
            latestEval?.regression
              ? "border-dom-red/30"
              : hasData
                ? "border-dom-green/20"
                : "",
          )}
        >
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center border",
              latestEval?.regression
                ? "bg-dom-red/10 border-dom-red/20"
                : hasData
                  ? "bg-dom-green/10 border-dom-green/20"
                  : "bg-dom-elevated border-dom-border",
            )}
          >
            {latestEval?.regression ? (
              <AlertTriangle className="w-5 h-5 text-dom-red" />
            ) : hasData ? (
              <CheckCircle className="w-5 h-5 text-dom-green" />
            ) : (
              <Shield className="w-5 h-5 text-dom-muted" />
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-dom-heading">
              {latestEval?.regression
                ? "Regression"
                : hasData
                  ? "Healthy"
                  : "No Data"}
            </div>
            <div className="text-xs text-dom-muted">
              {latestEval?.regression
                ? `${latestEval.reasons.length} issue(s)`
                : hasData
                  ? "All gates passed"
                  : "Run eval to start"}
            </div>
          </div>
        </Card>

        <Card className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-dom-elevated flex items-center justify-center border border-dom-border">
            <Zap className="w-5 h-5 text-dom-muted" />
          </div>
          <div>
            <div className="text-sm font-display font-bold text-dom-heading">
              {hasData
                ? latestEval!.checkpoint_step.toLocaleString()
                : "\u2014"}
            </div>
            <div className="text-xs text-dom-muted">Latest Eval Step</div>
          </div>
        </Card>
      </div>

      {/* Regression Alert */}
      {latestEval?.regression && (
        <div className="bg-dom-red/5 border border-dom-red/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-dom-red flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-dom-red text-sm">
              Regression Detected at Step{" "}
              {latestEval.checkpoint_step.toLocaleString()}
            </div>
            <div className="mt-1 space-y-1">
              {latestEval.reasons.map((r, i) => (
                <div key={i} className="text-xs text-dom-red/80">
                  &bull; {r}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Elo History */}
      {eloHistory.length > 1 && (
        <div className="space-y-3">
          <SectionHeader>Elo Rating History</SectionHeader>
          <Card className="!p-0 overflow-hidden">
            <EloGraph history={eloHistory} />
          </Card>
        </div>
      )}

      {/* Latest Tier Results */}
      {hasData && (
        <div className="space-y-3">
          <SectionHeader>
            Latest Results &mdash; Step{" "}
            {latestEval!.checkpoint_step.toLocaleString()}
          </SectionHeader>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(latestEval!.results).map(([tierName, result]) => (
              <TierResultCard
                key={tierName}
                tierName={tierName}
                meta={tierMeta[tierName] || tierMeta.baseline}
                result={result}
              />
            ))}
          </div>
        </div>
      )}

      {/* Frozen Tier Status */}
      <div className="space-y-3">
        <SectionHeader>Frozen Opponent Tiers</SectionHeader>
        <div className="grid grid-cols-3 gap-3">
          {tierConfig &&
            Object.entries(tierConfig.tiers || {}).map(([name, tier]) => {
              const meta = tierMeta[name] || tierMeta.baseline;
              const Icon = meta.icon;
              return (
                <Card
                  key={name}
                  className={cn(
                    "relative overflow-hidden",
                    tier.ready
                      ? "border-dom-border"
                      : "border-dom-border/50 opacity-60",
                  )}
                >
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-br",
                      meta.bg,
                    )}
                  />
                  <div className="relative flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `${meta.color}15`,
                        border: `1px solid ${meta.color}30`,
                      }}
                    >
                      <Icon className="w-5 h-5" style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-dom-heading text-sm">
                          {meta.label}
                        </span>
                        <Badge variant={tier.ready ? "success" : "warning"}>
                          {tier.ready ? "Ready" : "Empty"}
                        </Badge>
                      </div>
                      <div className="text-xs text-dom-muted mt-0.5">
                        {tier.description}
                      </div>
                      <div className="text-[10px] text-dom-muted mt-1 font-mono">
                        {tier.type === "scripted"
                          ? "Scripted ball-chaser"
                          : tier.metadata?.source
                            ? `From: ${tier.metadata.source.split("/").slice(-2).join("/")}`
                            : tier.path || "No checkpoint set"}
                      </div>
                      {tier.fixed_elo && (
                        <div className="text-[10px] text-dom-muted mt-0.5">
                          Fixed Elo: {tier.fixed_elo}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          {!tierConfig && (
            <Card className="col-span-3 py-8 text-center text-dom-muted text-sm">
              <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin opacity-30" />
              Loading tier configuration...
            </Card>
          )}
        </div>
      </div>

      {/* Eval History Table */}
      <div className="space-y-3">
        <SectionHeader>Evaluation History</SectionHeader>
        {loadingEvals ? (
          <Card className="py-12 text-center text-dom-muted text-sm">
            Loading evaluation history...
          </Card>
        ) : !evalResults || evalResults.length === 0 ? (
          <Card className="py-12 text-center">
            <div className="text-dom-muted text-sm">
              No evaluation results yet.
            </div>
            <div className="text-dom-muted text-xs mt-2 max-w-md mx-auto">
              Evaluations run automatically after each checkpoint save. You can
              also run manually:
              <code className="block mt-2 bg-dom-elevated rounded-lg p-3 text-dom-text text-left font-mono">
                python eval.py --checkpoint data/checkpoints/run/STEP --games 50
              </code>
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden !p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dom-border bg-dom-elevated/30">
                    {[
                      "",
                      "Step",
                      "Elo",
                      "\u0394",
                      "Baseline",
                      "Slater",
                      "Nexto",
                      "Status",
                      "Time",
                    ].map((h) => (
                      <th
                        key={h}
                        className={cn(
                          "py-3 px-4 text-xs font-semibold text-dom-muted uppercase tracking-wider",
                          h === "" || h === "Status"
                            ? "text-left"
                            : "text-right",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {evalResults.map((ev, idx) => {
                    const eloDelta = ev.rating_after - ev.rating_before;
                    const isExpanded = expandedEval === idx;
                    return (
                      <HistoryRow
                        key={ev.checkpoint_step}
                        ev={ev}
                        eloDelta={eloDelta}
                        isExpanded={isExpanded}
                        onToggle={() =>
                          setExpandedEval(isExpanded ? null : idx)
                        }
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Sub Components ──────────────────────────────────────────────────

function HistoryRow({
  ev,
  eloDelta,
  isExpanded,
  onToggle,
}: {
  ev: EvalResult;
  eloDelta: number;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={cn(
          "border-b border-dom-border/30 hover:bg-dom-elevated/30 transition-colors cursor-pointer",
          ev.regression && "bg-dom-red/[0.02]",
        )}
      >
        <td className="py-3 px-4 w-8">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-dom-muted" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-dom-muted" />
          )}
        </td>
        <td className="py-3 px-4 text-right font-mono text-dom-heading font-medium">
          {ev.checkpoint_step.toLocaleString()}
        </td>
        <td className="py-3 px-4 text-right font-mono text-dom-text">
          {ev.rating_after.toFixed(0)}
        </td>
        <td className="py-3 px-4 text-right">
          <span
            className={cn(
              "font-mono font-semibold text-xs",
              eloDelta > 0
                ? "text-dom-green"
                : eloDelta < 0
                  ? "text-dom-red"
                  : "text-dom-muted",
            )}
          >
            {eloDelta > 0 ? "+" : ""}
            {eloDelta.toFixed(1)}
          </span>
        </td>
        <td className="py-3 px-4 text-right">
          <WinrateCell value={ev.results?.baseline?.winrate} />
        </td>
        <td className="py-3 px-4 text-right">
          <WinrateCell value={ev.results?.slater_tier?.winrate} />
        </td>
        <td className="py-3 px-4 text-right">
          <WinrateCell value={ev.results?.nexto_tier?.winrate} />
        </td>
        <td className="py-3 px-4">
          {ev.regression ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-dom-red">
              <XCircle className="w-3 h-3" />
              Regression
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-dom-green">
              <CheckCircle className="w-3 h-3" />
              OK
            </span>
          )}
        </td>
        <td className="py-3 px-4 text-right text-xs text-dom-muted">
          {formatDate(ev.timestamp)}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td
            colSpan={9}
            className="bg-dom-elevated/20 px-8 py-4 border-b border-dom-border/30"
          >
            <EvalDetail ev={ev} />
          </td>
        </tr>
      )}
    </>
  );
}

function WinrateCell({ value }: { value?: number }) {
  if (value == null)
    return <span className="text-dom-muted text-xs">&mdash;</span>;
  const pct = (value * 100).toFixed(0);
  return (
    <span
      className={cn(
        "font-mono text-xs font-semibold",
        value >= 0.7
          ? "text-dom-green"
          : value >= 0.4
            ? "text-dom-accent"
            : "text-dom-red",
      )}
    >
      {pct}%
    </span>
  );
}

function TierResultCard({
  tierName,
  meta,
  result,
}: {
  tierName: string;
  meta: { icon: any; color: string; label: string; bg: string };
  result: TierResult;
}) {
  const Icon = meta.icon;
  const winPct = (result.winrate * 100).toFixed(0);
  return (
    <Card className="relative overflow-hidden">
      <div className={cn("absolute inset-0 bg-gradient-to-br", meta.bg)} />
      <div className="relative space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{
                background: `${meta.color}15`,
                border: `1px solid ${meta.color}30`,
              }}
            >
              <Icon className="w-4 h-4" style={{ color: meta.color }} />
            </div>
            <div>
              <div className="text-sm font-semibold text-dom-heading">
                {meta.label}
              </div>
              <div className="text-[10px] text-dom-muted">
                {result.games} games played
              </div>
            </div>
          </div>
          <div className="text-right">
            <div
              className="text-2xl font-display font-black"
              style={{ color: meta.color }}
            >
              {winPct}%
            </div>
            <div className="text-[10px] text-dom-muted">win rate</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex h-2.5 rounded-full overflow-hidden bg-dom-elevated">
            {result.wins > 0 && (
              <div
                className="bg-dom-green transition-all"
                style={{ width: `${(result.wins / result.games) * 100}%` }}
              />
            )}
            {result.draws > 0 && (
              <div
                className="bg-dom-muted/40 transition-all"
                style={{ width: `${(result.draws / result.games) * 100}%` }}
              />
            )}
            {result.losses > 0 && (
              <div
                className="bg-dom-red transition-all"
                style={{ width: `${(result.losses / result.games) * 100}%` }}
              />
            )}
          </div>
          <div className="flex justify-between text-[10px] text-dom-muted">
            <span className="text-dom-green">{result.wins}W</span>
            <span>{result.draws}D</span>
            <span className="text-dom-red">{result.losses}L</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatMini label="Goals For" value={result.goals_for} />
          <StatMini label="Goals Against" value={result.goals_against} />
          <StatMini
            label="Goal Diff"
            value={result.goal_diff}
            signed
            goodPositive
          />
          <StatMini
            label="Avg Length"
            value={`${result.avg_game_length_seconds.toFixed(0)}s`}
          />
        </div>
      </div>
    </Card>
  );
}

function StatMini({
  label,
  value,
  signed,
  goodPositive,
}: {
  label: string;
  value: number | string;
  signed?: boolean;
  goodPositive?: boolean;
}) {
  const num = typeof value === "number" ? value : 0;
  const display =
    typeof value === "string"
      ? value
      : signed
        ? `${num >= 0 ? "+" : ""}${num}`
        : String(num);
  return (
    <div className="bg-dom-elevated/40 rounded-lg px-2.5 py-1.5">
      <div className="text-[10px] text-dom-muted">{label}</div>
      <div
        className={cn(
          "text-sm font-mono font-semibold",
          signed && goodPositive
            ? num > 0
              ? "text-dom-green"
              : num < 0
                ? "text-dom-red"
                : "text-dom-muted"
            : "text-dom-heading",
        )}
      >
        {display}
      </div>
    </div>
  );
}

function EvalDetail({ ev }: { ev: EvalResult }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-dom-muted">Suite:</span>{" "}
          <span className="text-dom-text font-medium">{ev.suite}</span>
        </div>
        <div>
          <span className="text-dom-muted">Games/Tier:</span>{" "}
          <span className="text-dom-text font-medium">
            {ev.games_per_opponent}
          </span>
        </div>
        <div>
          <span className="text-dom-muted">Eval Time:</span>{" "}
          <span className="text-dom-text font-medium">
            {ev.elapsed_seconds.toFixed(0)}s
          </span>
        </div>
        <div>
          <span className="text-dom-muted">Path:</span>{" "}
          <span className="text-dom-text font-mono text-[10px]">
            {ev.checkpoint_path?.split("/").slice(-2).join("/")}
          </span>
        </div>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="text-dom-muted">
            <th className="text-left py-1 font-semibold">Tier</th>
            <th className="text-right py-1 font-semibold">W</th>
            <th className="text-right py-1 font-semibold">D</th>
            <th className="text-right py-1 font-semibold">L</th>
            <th className="text-right py-1 font-semibold">WR%</th>
            <th className="text-right py-1 font-semibold">GF</th>
            <th className="text-right py-1 font-semibold">GA</th>
            <th className="text-right py-1 font-semibold">GD</th>
            <th className="text-right py-1 font-semibold">Avg Len</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(ev.results).map(([name, r]) => (
            <tr
              key={name}
              className="border-t border-dom-border/20 text-dom-text"
            >
              <td className="py-1.5 font-medium capitalize">
                {tierMeta[name]?.label || name}
              </td>
              <td className="py-1.5 text-right font-mono text-dom-green">
                {r.wins}
              </td>
              <td className="py-1.5 text-right font-mono">{r.draws}</td>
              <td className="py-1.5 text-right font-mono text-dom-red">
                {r.losses}
              </td>
              <td className="py-1.5 text-right font-mono font-semibold">
                {(r.winrate * 100).toFixed(0)}%
              </td>
              <td className="py-1.5 text-right font-mono">{r.goals_for}</td>
              <td className="py-1.5 text-right font-mono">{r.goals_against}</td>
              <td
                className={cn(
                  "py-1.5 text-right font-mono font-semibold",
                  r.goal_diff > 0
                    ? "text-dom-green"
                    : r.goal_diff < 0
                      ? "text-dom-red"
                      : "",
                )}
              >
                {r.goal_diff > 0 ? "+" : ""}
                {r.goal_diff}
              </td>
              <td className="py-1.5 text-right font-mono">
                {r.avg_game_length_seconds.toFixed(0)}s
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {ev.regression && ev.reasons.length > 0 && (
        <div className="bg-dom-red/5 border border-dom-red/15 rounded-lg p-3 space-y-1">
          <div className="text-xs font-semibold text-dom-red flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Regression Reasons
          </div>
          {ev.reasons.map((r, i) => (
            <div key={i} className="text-[11px] text-dom-red/80">
              &bull; {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Elo Graph (pure SVG) ────────────────────────────────────────────

function EloGraph({
  history,
}: {
  history: { step: number; rating: number; timestamp: string }[];
}) {
  if (history.length < 2) return null;

  const W = 800,
    H = 200;
  const PAD = { top: 20, right: 20, bottom: 30, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const ratings = history.map((h) => h.rating);
  const minR = Math.floor(Math.min(...ratings) / 50) * 50 - 50;
  const maxR = Math.ceil(Math.max(...ratings) / 50) * 50 + 50;
  const rangeR = maxR - minR || 1;

  const xScale = (i: number) =>
    PAD.left + (i / Math.max(history.length - 1, 1)) * plotW;
  const yScale = (r: number) => PAD.top + plotH - ((r - minR) / rangeR) * plotH;

  const line = history
    .map((h, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(h.rating)}`)
    .join(" ");
  const area = `${line} L ${xScale(history.length - 1)} ${yScale(minR)} L ${xScale(0)} ${yScale(minR)} Z`;

  const yTicks: number[] = [];
  const tickStep = Math.max(Math.ceil(rangeR / 4 / 50) * 50, 50);
  for (let r = minR; r <= maxR; r += tickStep) yTicks.push(r);

  return (
    <div className="p-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {yTicks.map((r) => (
          <g key={r}>
            <line
              x1={PAD.left}
              y1={yScale(r)}
              x2={W - PAD.right}
              y2={yScale(r)}
              stroke="currentColor"
              className="text-dom-border"
              strokeDasharray="4 4"
              strokeWidth={0.5}
            />
            <text
              x={PAD.left - 8}
              y={yScale(r) + 3}
              textAnchor="end"
              className="text-dom-muted"
              fontSize={10}
              fill="currentColor"
            >
              {r}
            </text>
          </g>
        ))}
        <line
          x1={PAD.left}
          y1={yScale(1000)}
          x2={W - PAD.right}
          y2={yScale(1000)}
          stroke="currentColor"
          className="text-dom-muted"
          strokeDasharray="2 3"
          strokeWidth={0.8}
          opacity={0.5}
        />
        <defs>
          <linearGradient id="eloGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#eloGrad)" />
        <path
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {history.map((h, i) => (
          <circle
            key={i}
            cx={xScale(i)}
            cy={yScale(h.rating)}
            r={3}
            fill="var(--accent)"
            stroke="var(--surface)"
            strokeWidth={2}
          >
            <title>
              Step {h.step.toLocaleString()} — Elo {h.rating.toFixed(0)}
            </title>
          </circle>
        ))}
        {[0, Math.floor(history.length / 2), history.length - 1]
          .filter((v, i, a) => a.indexOf(v) === i)
          .map((i) => (
            <text
              key={i}
              x={xScale(i)}
              y={H - 5}
              textAnchor="middle"
              className="text-dom-muted"
              fontSize={9}
              fill="currentColor"
            >
              {(history[i].step / 1e6).toFixed(0)}M
            </text>
          ))}
      </svg>
    </div>
  );
}
