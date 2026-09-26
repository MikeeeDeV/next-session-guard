"use client";

import React, { useState, useEffect } from "react";
import { ActiveSessionsCard } from "next-session-guard";
import { ShieldAlert, Zap, Radio, CheckCircle2 } from "lucide-react";

export default function UserHomePage() {
  const [kickBanner, setKickBanner] = useState<string | null>(null);
  const [sseConnected, setSseConnected] = useState<boolean>(false);

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/sessions/sse?userId=demo_user_1");
      es.onopen = () => setSseConnected(true);
      es.onerror = () => setSseConnected(false);

      es.addEventListener("session_revoked", (e: MessageEvent) => {
        const data = JSON.parse(e.data);
        setKickBanner(`Your session was revoked remotely (${data.reason || "admin_revoke"}) at ${new Date().toLocaleTimeString()}! Realtime kick received.`);
      });
    } catch {
      // Ignore
    }

    return () => {
      es?.close();
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Realtime Live Kick Notice */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">
              Real-time SSE Browser Kick Listener
            </div>
            <div className="text-xs text-slate-400">
              {sseConnected
                ? "Connected to Server-Sent Events stream. If kicked remotely from Telegram or Admin Panel, this window responds instantly."
                : "Connecting to SSE stream..."}
            </div>
          </div>
        </div>

        <a
          href="/admin"
          className="px-3.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-semibold border border-cyan-500/30 transition flex items-center gap-1.5"
        >
          <Zap className="w-3.5 h-3.5" />
          Open Admin SOC Panel
        </a>
      </div>

      {kickBanner && (
        <div className="p-4 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-200 text-sm flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{kickBanner}</span>
          </div>
          <button
            onClick={() => setKickBanner(null)}
            className="text-xs underline text-rose-300 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* User Sessions Card Component */}
      <div className="w-full">
        <ActiveSessionsCard
          sessionsApiEndpoint="/api/sessions"
          revokeOthersApiEndpoint="/api/sessions/revoke-others"
          locale="en"
        />
      </div>
    </div>
  );
}
