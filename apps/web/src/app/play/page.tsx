"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { match, trainingControl } from "@/lib/api";
import { Card, HUDPanel, HeroCard } from "@/components/ui/Card";
import { SectionHeader, DifficultyBadge, Badge } from "@/components/ui/Badge";
import { DifficultySlider } from "@/components/ui/Controls";
import {
  Shield,
  Target,
  TrendingUp,
  Swords,
  Play,
  Users,
  ArrowRight,
  Loader2,
  Gamepad2,
  AlertTriangle,
  CheckCircle,
  Monitor,
  Download,
  Wifi,
  WifiOff,
  Clock,
} from "lucide-react";
import { cn, difficultyColor } from "@/lib/utils";

const MODES = [
  {
    value: "defense",
    label: "Defense",
    icon: Shield,
    emoji: "🛡️",
    color: "#3B82F6",
    desc: "Shadow defense, rotations, recovery",
    tips: "Track the ball carrier · Rotate back post · Recover fast",
  },
  {
    value: "shooting",
    label: "Shooting",
    icon: Target,
    emoji: "🎯",
    color: "#EF4444",
    desc: "Shot placement, power shots, redirects",
    tips: "Aim corners · Time your flips · Read the bounce",
  },
  {
    value: "possession",
    label: "Possession",
    icon: TrendingUp,
    emoji: "⚽",
    color: "#22C55E",
    desc: "Ball control, dribbling, boost management",
    tips: "Keep the ball close · Manage boost · Shield the ball",
  },
  {
    value: "50/50s",
    label: "50/50s",
    icon: Swords,
    emoji: "⚔️",
    color: "#F59E0B",
    desc: "Challenge timing, positioning, recoveries",
    tips: "Nose to ball · Read their flip · Recover after",
  },
];

const STYLES = [
  {
    value: "passive",
    label: "Passive",
    emoji: "🐢",
    desc: "Patient, waits for mistakes",
    detail: "Great for practicing control and setup plays",
  },
  {
    value: "aggro",
    label: "Aggro",
    emoji: "🔥",
    desc: "High pressure, fast challenges",
    detail: "Tests your speed and decision-making",
  },
  {
    value: "counter",
    label: "Counter",
    emoji: "🧠",
    desc: "Baits, fakes, punishes",
    detail: "Tests patience and game sense",
  },
];

type PageState = "setup" | "waiting_agent" | "match_live";

export default function PlayPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState("defense");
  const [difficulty, setDifficulty] = useState("gold");
  const [opponentStyle, setOpponentStyle] = useState("passive");
  const [pageState, setPageState] = useState<PageState>("setup");

  // Poll match status
  const { data: matchStatus } = useQuery({
    queryKey: ["match-status"],
    queryFn: () =>
      match.status() as Promise<{
        active: boolean;
        session_id?: string;
        agent_connected?: boolean;
        config?: Record<string, string>;
      }>,
    refetchInterval: 3000,
  });

  // Track active session ID for auto-navigation
  const activeSessionRef = React.useRef<string | null>(null);

  // Sync page state with server state
  useEffect(() => {
    if (!matchStatus) return;

    if (matchStatus.active && matchStatus.session_id) {
      // Track the active session
      activeSessionRef.current = matchStatus.session_id;
      if (matchStatus.agent_connected) {
        setPageState("match_live");
      } else {
        setPageState("waiting_agent");
      }
    } else if (
      !matchStatus.active &&
      activeSessionRef.current &&
      pageState === "match_live"
    ) {
      // Match was active but now isn't — agent completed it!
      const sid = activeSessionRef.current;
      activeSessionRef.current = null;
      setPageState("setup");
      router.push(`/session/${sid}/summary`);
    }
  }, [matchStatus, pageState, router]);

  // Start match mutation
  const startMatch = useMutation({
    mutationFn: () =>
      match.start({
        mode: "1v1",
        difficulty,
        opponent_style: opponentStyle,
      }),
    onSuccess: () => {
      setPageState("waiting_agent");
      queryClient.invalidateQueries({ queryKey: ["match-status"] });
    },
  });

  // Stop match mutation
  const stopMatch = useMutation({
    mutationFn: () => match.stop(),
    onSuccess: async (data: any) => {
      if (data?.session_id) {
        setPageState("setup");
        queryClient.invalidateQueries({ queryKey: ["match-status"] });
        // Give agent 3 seconds to report final score before showing summary
        await new Promise((r) => setTimeout(r, 3000));
        router.push(`/session/${data.session_id}/summary`);
      } else {
        setPageState("setup");
        queryClient.invalidateQueries({ queryKey: ["match-status"] });
      }
    },
  });

  const selectedMode = MODES.find((m) => m.value === mode)!;

  // ── Match Live State ──────────────────────────────────────────
  if (pageState === "match_live" && matchStatus?.active) {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-display font-black tracking-tight">
            Match In Progress
          </h1>
          <p className="text-sm text-dom-muted mt-1">
            Play your match in Rocket League. Events are being tracked
            automatically.
          </p>
        </div>

        <HUDPanel accent="#22C55E" className="!p-8">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-dom-green/10 flex items-center justify-center border-2 border-dom-green/30">
              <Gamepad2 className="w-10 h-10 text-dom-green" />
            </div>
            <div>
              <div className="text-2xl font-display font-black text-dom-heading">
                Match is Live
              </div>
              <div className="text-sm text-dom-muted mt-2">
                Your agent is connected and tracking gameplay events.
                <br />
                When the match ends, your coaching analysis will be ready
                automatically.
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Badge variant="success">
                <CheckCircle className="w-3 h-3 mr-1" /> Agent Connected
              </Badge>
              <Badge variant="default">
                <Wifi className="w-3 h-3 mr-1" /> Tracking Events
              </Badge>
            </div>
          </div>
        </HUDPanel>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => stopMatch.mutate()}
            className="btn-danger px-8 py-3"
            disabled={stopMatch.isPending}
          >
            {stopMatch.isPending ? "Ending..." : "End Match & Get Analysis"}
          </button>
        </div>
      </div>
    );
  }

  // ── Waiting for Agent State ───────────────────────────────────
  if (pageState === "waiting_agent") {
    return (
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-display font-black tracking-tight">
            Waiting for Agent
          </h1>
          <p className="text-sm text-dom-muted mt-1">
            Make sure DominanceBot is running on your PC.
          </p>
        </div>

        <HeroCard>
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-dom-accent/10 flex items-center justify-center border-2 border-dom-accent/30">
              <Monitor className="w-10 h-10 text-dom-accent animate-pulse" />
            </div>
            <div>
              <div className="text-2xl font-display font-black text-dom-heading">
                Match Queued
              </div>
              <div className="text-sm text-dom-muted mt-2 max-w-md mx-auto">
                Your match is ready. The DominanceBot agent on your PC will pick
                it up and launch Rocket League automatically.
              </div>
            </div>

            {/* Match config summary */}
            <div className="bg-dom-elevated/50 rounded-xl p-4 max-w-md mx-auto text-left space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{selectedMode.emoji}</span>
                <span className="text-sm font-display font-bold text-dom-heading capitalize">
                  {mode}
                </span>
                <span className="text-dom-muted">·</span>
                <DifficultyBadge difficulty={difficulty} />
                <span className="text-dom-muted">·</span>
                <span className="text-xs text-dom-muted capitalize">
                  {opponentStyle}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              <Badge variant="accent">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Waiting for
                agent
              </Badge>
            </div>

            {/* Help section */}
            <div className="bg-dom-base/50 rounded-xl p-5 max-w-md mx-auto text-left space-y-3">
              <div className="text-xs font-semibold text-dom-heading">
                Don't have the agent yet?
              </div>
              <div className="text-xs text-dom-muted">
                1. Download{" "}
                <span className="text-dom-accent font-medium">
                  DominanceBot.exe
                </span>{" "}
                from the link below
              </div>
              <div className="text-xs text-dom-muted">
                2. Double-click to run it — log in with your account
              </div>
              <div className="text-xs text-dom-muted">
                3. It will automatically pick up this match and launch Rocket
                League
              </div>
              <a
                href="/api/download/agent"
                className="inline-flex items-center gap-2 text-xs text-dom-accent hover:underline mt-2"
              >
                <Download className="w-3.5 h-3.5" />
                Download DominanceBot Agent
              </a>
            </div>
          </div>
        </HeroCard>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => {
              stopMatch.mutate();
              setPageState("setup");
            }}
            className="btn-secondary"
          >
            Cancel Match
          </button>
        </div>
      </div>
    );
  }

  // ── Setup State (default) ─────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight">
          Play vs AI
        </h1>
        <p className="text-sm text-dom-muted mt-1">
          Configure your match and launch. Rocket League will open on your PC
          with the bot loaded.
        </p>
      </div>

      {/* Error Banner */}
      {startMatch.isError && (
        <div className="bg-dom-red/5 border border-dom-red/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-dom-red flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-dom-red text-sm">
              Failed to start match
            </div>
            <div className="text-xs text-dom-red/80 mt-1">
              {(startMatch.error as any)?.message || "Unknown error"}
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Mode */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-dom-accent/20 flex items-center justify-center text-xs font-bold text-dom-accent">
            1
          </div>
          <SectionHeader className="!mb-0">Training Focus</SectionHeader>
        </div>
        <div className="grid grid-cols-2 gap-4 stagger">
          {MODES.map((m) => (
            <div
              key={m.value}
              onClick={() => setMode(m.value)}
              className={cn(
                "mode-card p-5 animate-slide-up",
                mode === m.value && "selected",
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{
                    background: `${m.color}12`,
                    border: `1px solid ${m.color}30`,
                  }}
                >
                  {m.emoji}
                </div>
                {mode === m.value && (
                  <div className="w-5 h-5 rounded-full bg-dom-accent flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-dom-base"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <div className="font-display font-bold text-dom-heading text-lg">
                {m.label}
              </div>
              <div className="text-xs text-dom-muted mt-1 leading-relaxed">
                {m.desc}
              </div>
              {mode === m.value && (
                <div className="mt-3 pt-3 border-t border-dom-border/50">
                  <div className="text-[10px] text-dom-accent uppercase tracking-wider font-semibold">
                    Tips
                  </div>
                  <div className="text-xs text-dom-muted mt-1">{m.tips}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 2: Difficulty */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-dom-accent/20 flex items-center justify-center text-xs font-bold text-dom-accent">
            2
          </div>
          <SectionHeader className="!mb-0">Difficulty</SectionHeader>
        </div>
        <Card className="!p-6">
          <DifficultySlider value={difficulty} onChange={setDifficulty} />
        </Card>
      </div>

      {/* Step 3: Opponent Style */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-dom-accent/20 flex items-center justify-center text-xs font-bold text-dom-accent">
            3
          </div>
          <SectionHeader className="!mb-0">Opponent Style</SectionHeader>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {STYLES.map((s) => (
            <div
              key={s.value}
              onClick={() => setOpponentStyle(s.value)}
              className={cn(
                "style-card",
                opponentStyle === s.value && "selected",
              )}
            >
              <div className="text-3xl mb-3">{s.emoji}</div>
              <div className="font-display font-bold text-dom-heading">
                {s.label}
              </div>
              <div className="text-xs text-dom-muted mt-1">{s.desc}</div>
              {opponentStyle === s.value && (
                <div className="mt-3 pt-2 border-t border-dom-border/50 text-[10px] text-dom-accent">
                  {s.detail}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Launch */}
      <HUDPanel accent={difficultyColor(difficulty)} className="!p-7">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="text-xs text-dom-muted uppercase tracking-wider font-semibold">
              Ready to Play
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-2xl">{selectedMode.emoji}</span>
              <span className="text-lg font-display font-bold text-dom-heading capitalize">
                {mode}
              </span>
              <span className="text-dom-muted">·</span>
              <DifficultyBadge difficulty={difficulty} />
              <span className="text-dom-muted">·</span>
              <span className="text-sm text-dom-text capitalize flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-dom-muted" />
                {opponentStyle}
              </span>
            </div>
            <div className="text-xs text-dom-muted mt-1">
              Make sure DominanceBot is running on your PC
            </div>
          </div>
          <button
            onClick={() => startMatch.mutate()}
            disabled={startMatch.isPending}
            className="btn-primary-xl group"
          >
            {startMatch.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Play className="w-5 h-5" />
            )}
            {startMatch.isPending ? "Starting..." : "Launch Match"}
            {!startMatch.isPending && (
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            )}
          </button>
        </div>
      </HUDPanel>

      {/* How it works */}
      <Card className="text-xs text-dom-muted space-y-3 border-dom-border/50">
        <div className="font-semibold text-dom-text text-sm">How it works</div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-dom-accent/10 flex items-center justify-center">
              <Download className="w-4 h-4 text-dom-accent" />
            </div>
            <div className="font-medium text-dom-text">1. Get the Agent</div>
            <div>
              <a
                href="/api/download/agent"
                className="text-dom-accent font-medium hover:underline"
              >
                Download DominanceBot.exe
              </a>{" "}
              and run it on your PC. Log in once — it stays connected.
            </div>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-dom-green/10 flex items-center justify-center">
              <Play className="w-4 h-4 text-dom-green" />
            </div>
            <div className="font-medium text-dom-text">2. Launch Match</div>
            <div>
              Click Launch Match here — the agent picks it up and opens Rocket
              League with the bot loaded.
            </div>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-dom-purple/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-dom-purple" />
            </div>
            <div className="font-medium text-dom-text">3. Get Coached</div>
            <div>
              After the match, AI analyzes your gameplay and gives specific,
              actionable coaching tips.
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
