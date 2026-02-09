"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deploy } from "@/lib/api";
import { Card, HUDPanel } from "@/components/ui/Card";
import { SectionHeader, Badge } from "@/components/ui/Badge";
import {
  Package,
  Upload,
  Download,
  Hammer,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Bot,
  Cpu,
  Clock,
  HardDrive,
  Hash,
  RefreshCw,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString();
}

export default function DeployPage() {
  const queryClient = useQueryClient();
  const modelFileRef = useRef<HTMLInputElement>(null);
  const agentFileRef = useRef<HTMLInputElement>(null);
  const [modelVersion, setModelVersion] = useState("");
  const [buildLog, setBuildLog] = useState("");

  // Fetch current info
  const { data: agentInfo, isLoading: agentLoading } = useQuery({
    queryKey: ["agent-info"],
    queryFn: () => deploy.agentInfo() as Promise<any>,
  });

  const { data: modelInfo, isLoading: modelLoading } = useQuery({
    queryKey: ["model-info"],
    queryFn: () => deploy.modelInfo() as Promise<any>,
  });

  // Build agent mutation
  const buildAgent = useMutation({
    mutationFn: () => deploy.buildAgent() as Promise<any>,
    onSuccess: (data) => {
      if (data.status === "built") {
        setBuildLog("Agent built successfully!");
      } else {
        setBuildLog(
          `Build failed: ${data.detail || data.stderr || "Unknown error"}`,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["agent-info"] });
    },
    onError: (err: any) => {
      setBuildLog(`Build error: ${err.message}`);
    },
  });

  // Upload model mutation
  const uploadModel = useMutation({
    mutationFn: (file: File) =>
      deploy.uploadModel(file, modelVersion || undefined) as Promise<any>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["model-info"] });
      setModelVersion("");
      if (modelFileRef.current) modelFileRef.current.value = "";
    },
  });

  // Upload agent mutation
  const uploadAgent = useMutation({
    mutationFn: (file: File) => deploy.uploadAgent(file) as Promise<any>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-info"] });
      if (agentFileRef.current) agentFileRef.current.value = "";
    },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-display font-black tracking-tight">
          Deploy
        </h1>
        <p className="text-sm text-dom-muted mt-1">
          Build and manage the player agent and bot model. Players automatically
          get the latest version.
        </p>
      </div>

      {/* ── Bot Model ────────────────────────────────────────────── */}
      <div className="space-y-4">
        <SectionHeader>
          <Cpu className="w-4 h-4 inline mr-2" />
          Bot Model
        </SectionHeader>

        <HUDPanel
          accent={modelInfo?.available ? "#22C55E" : "#F59E0B"}
          className="!p-6"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {modelInfo?.available ? (
                  <Badge variant="success">
                    <CheckCircle className="w-3 h-3 mr-1" /> Live
                  </Badge>
                ) : (
                  <Badge variant="warning">
                    <AlertTriangle className="w-3 h-3 mr-1" /> Not uploaded
                  </Badge>
                )}
                <span className="text-sm font-display font-bold text-dom-heading">
                  {modelInfo?.version || "—"}
                </span>
              </div>

              {modelInfo?.available && (
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-dom-muted">
                    <HardDrive className="w-3 h-3" />
                    {formatBytes(modelInfo?.size_bytes || 0)}
                  </div>
                  <div className="flex items-center gap-1.5 text-dom-muted">
                    <Hash className="w-3 h-3" />
                    {modelInfo?.hash?.slice(0, 12)}...
                  </div>
                  <div className="flex items-center gap-1.5 text-dom-muted">
                    <Clock className="w-3 h-3" />
                    {formatDate(modelInfo?.uploaded_at)}
                  </div>
                </div>
              )}

              <div className="text-xs text-dom-muted">
                {modelInfo?.available
                  ? "Players will automatically download this model before their next match."
                  : "Upload a trained model (.pt file) so players can play against it."}
              </div>

              {modelInfo?.available && (
                <a
                  href="/api/download/model"
                  className="inline-flex items-center gap-2 text-xs text-dom-accent hover:underline mt-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Current Model
                </a>
              )}
            </div>
          </div>

          {/* Upload form */}
          <div className="mt-5 pt-5 border-t border-dom-border/30 space-y-3">
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] text-dom-muted uppercase tracking-wider font-semibold">
                  Model File (.pt, .onnx, .zip)
                </label>
                <input
                  ref={modelFileRef}
                  type="file"
                  accept=".pt,.onnx,.zip,.pth"
                  className="block w-full text-xs text-dom-text file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-dom-accent/10 file:text-dom-accent hover:file:bg-dom-accent/20 file:cursor-pointer"
                />
              </div>
              <div className="w-32 space-y-1">
                <label className="text-[10px] text-dom-muted uppercase tracking-wider font-semibold">
                  Version
                </label>
                <input
                  type="text"
                  value={modelVersion}
                  onChange={(e) => setModelVersion(e.target.value)}
                  placeholder="v2.1"
                  className="w-full px-3 py-2 text-xs rounded-lg bg-dom-elevated border border-dom-border text-dom-text placeholder:text-dom-muted/50"
                />
              </div>
              <button
                onClick={() => {
                  const file = modelFileRef.current?.files?.[0];
                  if (!file) {
                    alert("Please select a model file first");
                    return;
                  }
                  uploadModel.mutate(file);
                }}
                disabled={uploadModel.isPending}
                className="btn-primary flex items-center gap-2 px-5 py-2"
              >
                {uploadModel.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {uploadModel.isPending ? "Uploading..." : "Upload Model"}
              </button>
            </div>
            {uploadModel.isSuccess && (
              <div className="text-xs text-dom-green flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Model uploaded — players
                will get it on their next match
              </div>
            )}
            {uploadModel.isError && (
              <div className="text-xs text-dom-red flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />{" "}
                {(uploadModel.error as any)?.message || "Upload failed"}
              </div>
            )}
          </div>
        </HUDPanel>
      </div>

      {/* ── Desktop Agent ────────────────────────────────────────── */}
      <div className="space-y-4">
        <SectionHeader>
          <Bot className="w-4 h-4 inline mr-2" />
          Desktop Agent
        </SectionHeader>

        <HUDPanel
          accent={agentInfo?.available ? "#22C55E" : "#F59E0B"}
          className="!p-6"
        >
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {agentInfo?.available ? (
                  <Badge variant="success">
                    <CheckCircle className="w-3 h-3 mr-1" /> Available
                  </Badge>
                ) : (
                  <Badge variant="warning">
                    <AlertTriangle className="w-3 h-3 mr-1" /> Not built
                  </Badge>
                )}
                <span className="text-sm font-display font-bold text-dom-heading">
                  {agentInfo?.version || "—"}
                </span>
              </div>

              {agentInfo?.available && (
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-dom-muted">
                    <HardDrive className="w-3 h-3" />
                    {formatBytes(agentInfo?.size_bytes || 0)}
                  </div>
                  <div className="flex items-center gap-1.5 text-dom-muted">
                    <Hash className="w-3 h-3" />
                    {agentInfo?.hash?.slice(0, 12)}...
                  </div>
                  <div className="flex items-center gap-1.5 text-dom-muted">
                    <Clock className="w-3 h-3" />
                    {formatDate(agentInfo?.uploaded_at)}
                  </div>
                </div>
              )}

              <div className="text-xs text-dom-muted">
                Players download this .exe and run it on their PC. It
                auto-connects and launches matches.
              </div>

              {agentInfo?.available && (
                <a
                  href="/api/download/agent"
                  className="inline-flex items-center gap-2 text-xs text-dom-accent hover:underline mt-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download Current Build
                </a>
              )}
            </div>
          </div>

          {/* Build + Upload */}
          <div className="mt-5 pt-5 border-t border-dom-border/30 space-y-4">
            {/* Option 1: Build from source */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setBuildLog("");
                  buildAgent.mutate();
                }}
                disabled={buildAgent.isPending}
                className="btn-primary flex items-center gap-2 px-5 py-2"
              >
                {buildAgent.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Hammer className="w-3.5 h-3.5" />
                )}
                {buildAgent.isPending
                  ? "Building... (may take a few minutes)"
                  : "Build Agent from Source"}
              </button>
              <span className="text-[10px] text-dom-muted">
                Runs PyInstaller on agent.py → produces DominanceBot.exe
              </span>
            </div>

            {buildLog && (
              <div
                className={`text-xs p-3 rounded-lg ${
                  buildLog.includes("successfully")
                    ? "bg-dom-green/5 text-dom-green border border-dom-green/20"
                    : "bg-dom-red/5 text-dom-red border border-dom-red/20"
                }`}
              >
                <pre className="whitespace-pre-wrap font-mono text-[10px]">
                  {buildLog}
                </pre>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 text-[10px] text-dom-muted uppercase tracking-wider">
              <div className="flex-1 border-t border-dom-border/30" />
              or upload manually
              <div className="flex-1 border-t border-dom-border/30" />
            </div>

            {/* Option 2: Upload pre-built */}
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] text-dom-muted uppercase tracking-wider font-semibold">
                  Agent Binary (.exe)
                </label>
                <input
                  ref={agentFileRef}
                  type="file"
                  className="block w-full text-xs text-dom-text file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-dom-elevated file:text-dom-text hover:file:bg-dom-border file:cursor-pointer"
                />
              </div>
              <button
                onClick={() => {
                  const file = agentFileRef.current?.files?.[0];
                  if (!file) {
                    alert("Please select a file first");
                    return;
                  }
                  uploadAgent.mutate(file);
                }}
                disabled={uploadAgent.isPending}
                className="btn-secondary flex items-center gap-2 px-5 py-2"
              >
                {uploadAgent.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                Upload .exe
              </button>
            </div>
            {uploadAgent.isSuccess && (
              <div className="text-xs text-dom-green flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Agent uploaded — players can
                now download it
              </div>
            )}
            {uploadAgent.isError && (
              <div className="text-xs text-dom-red flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />{" "}
                {(uploadAgent.error as any)?.message || "Upload failed"}
              </div>
            )}
          </div>
        </HUDPanel>
      </div>

      {/* ── How it works ─────────────────────────────────────────── */}
      <Card className="text-xs text-dom-muted space-y-3 border-dom-border/50">
        <div className="font-semibold text-dom-text text-sm">Deploy Flow</div>
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1.5 text-center">
            <div className="w-10 h-10 mx-auto rounded-xl bg-dom-accent/10 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-dom-accent" />
            </div>
            <div className="font-medium text-dom-text">1. Train</div>
            <div>Train your bot via Training Runs</div>
          </div>
          <div className="space-y-1.5 text-center">
            <div className="w-10 h-10 mx-auto rounded-xl bg-dom-green/10 flex items-center justify-center">
              <Upload className="w-5 h-5 text-dom-green" />
            </div>
            <div className="font-medium text-dom-text">2. Upload Model</div>
            <div>Upload the .pt checkpoint here</div>
          </div>
          <div className="space-y-1.5 text-center">
            <div className="w-10 h-10 mx-auto rounded-xl bg-dom-purple/10 flex items-center justify-center">
              <Hammer className="w-5 h-5 text-dom-purple" />
            </div>
            <div className="font-medium text-dom-text">3. Build Agent</div>
            <div>One click → .exe is ready</div>
          </div>
          <div className="space-y-1.5 text-center">
            <div className="w-10 h-10 mx-auto rounded-xl bg-dom-yellow/10 flex items-center justify-center">
              <Download className="w-5 h-5 text-dom-yellow" />
            </div>
            <div className="font-medium text-dom-text">4. Players Get It</div>
            <div>Auto-download on next match</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
