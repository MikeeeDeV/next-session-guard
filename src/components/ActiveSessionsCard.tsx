"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Laptop,
  Smartphone,
  Tablet,
  Globe,
  LogOut,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { ActiveSessionDTO } from "../core/types";

export interface ActiveSessionsCardProps {
  /**
   * API endpoint to list active sessions.
   * Default: "/api/sessions"
   */
  sessionsApiEndpoint?: string;

  /**
   * API endpoint to revoke all other sessions.
   * Default: "/api/sessions/revoke-others"
   */
  revokeOthersApiEndpoint?: string;

  /**
   * Display language: "ar" for Arabic, "en" for English.
   * Default: "en"
   */
  locale?: "ar" | "en";

  /**
   * Optional custom styling class
   */
  className?: string;

  /**
   * Callback triggered after any session is revoked
   */
  onSessionRevoked?: (sessionId: string) => void;
}

export function ActiveSessionsCard({
  sessionsApiEndpoint = "/api/sessions",
  revokeOthersApiEndpoint = "/api/sessions/revoke-others",
  locale = "en",
  className = "",
  onSessionRevoked,
}: ActiveSessionsCardProps) {
  const isAr = locale === "ar";

  const [sessions, setSessions] = useState<ActiveSessionDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isRevokingOthers, setIsRevokingOthers] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const t = {
    title: isAr ? "الأجهزة والجلسات النشطة" : "Active Devices & Sessions",
    subtitle: isAr
      ? "إدارة الأجهزة المسجلة حالياً التي تملك صلاحية الوصول إلى حسابك"
      : "Manage active devices and sessions currently signed in to your account",
    currentDevice: isAr ? "هذا الجهاز (الجلسة الحالية)" : "This Device (Current Session)",
    activeNow: isAr ? "نشط الآن" : "Active now",
    lastActive: isAr ? "آخر نشاط:" : "Last active:",
    ipLabel: isAr ? "عنوان IP:" : "IP:",
    revokeBtn: isAr ? "تسجيل الخروج" : "Revoke",
    revokeOthersBtn: isAr ? "تسجيل الخروج من كل الأجهزة الأخرى" : "Sign out all other devices",
    confirmRevokeOther: isAr
      ? "هل أنت متأكد من تسجيل الخروج من كافة الأجهزة الأخرى؟"
      : "Are you sure you want to sign out of all other devices?",
    confirmRevokeSingle: isAr
      ? "هل أنت متأكد من إنهاء هذه الجلسة؟"
      : "Are you sure you want to revoke this session?",
    noSessions: isAr ? "لا توجد جلسات نشطة مسجلة." : "No active sessions found.",
    unknownLocation: isAr ? "موقع غير معروف" : "Unknown location",
  };

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch(sessionsApiEndpoint);
      if (!res.ok) throw new Error("Failed to load sessions");
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err: any) {
      setMessage({
        type: "error",
        text: isAr ? "تعذر تحميل قائمة الجلسات النشطة" : "Failed to load active sessions",
      });
    } finally {
      setIsLoading(false);
    }
  }, [sessionsApiEndpoint, isAr]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSingle = async (sessionId: string) => {
    if (!window.confirm(t.confirmRevokeSingle)) return;
    setRevokingId(sessionId);
    setMessage(null);

    try {
      const res = await fetch(`${sessionsApiEndpoint}?id=${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setMessage({
        type: "success",
        text: isAr ? "تم تسجيل الخروج من الجهاز بنجاح" : "Session revoked successfully",
      });
      if (onSessionRevoked) onSessionRevoked(sessionId);
    } catch {
      setMessage({
        type: "error",
        text: isAr ? "فشل إنهاء الجلسة، حاول مرة أخرى" : "Failed to revoke session",
      });
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    if (!window.confirm(t.confirmRevokeOther)) return;
    setIsRevokingOthers(true);
    setMessage(null);

    try {
      const res = await fetch(revokeOthersApiEndpoint, { method: "POST" });
      if (!res.ok) throw new Error();

      setSessions((prev) => prev.filter((s) => s.isCurrent));
      setMessage({
        type: "success",
        text: isAr
          ? "تم تسجيل الخروج من كافة الأجهزة الأخرى بنجاح"
          : "Successfully signed out of all other devices",
      });
    } catch {
      setMessage({
        type: "error",
        text: isAr ? "فشل تسجيل الخروج من الأجهزة الأخرى" : "Failed to revoke other sessions",
      });
    } finally {
      setIsRevokingOthers(false);
    }
  };

  const formatRelativeTime = (dateStr: string | Date) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes < 2) return t.activeNow;
      if (diffMinutes < 60) return isAr ? `منذ ${diffMinutes} دقيقة` : `${diffMinutes}m ago`;
      if (diffHours < 24) return isAr ? `منذ ${diffHours} ساعة` : `${diffHours}h ago`;
      return isAr ? `منذ ${diffDays} يوم` : `${diffDays}d ago`;
    } catch {
      return String(dateStr);
    }
  };

  const renderDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case "mobile":
        return <Smartphone className="w-5 h-5 text-indigo-500" />;
      case "tablet":
        return <Tablet className="w-5 h-5 text-cyan-500" />;
      case "desktop":
      default:
        return <Laptop className="w-5 h-5 text-blue-500" />;
    }
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{t.title}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchSessions}
            disabled={isLoading}
            className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          {otherSessionsCount > 0 && (
            <button
              onClick={handleRevokeOthers}
              disabled={isRevokingOthers}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 rounded-xl transition-colors disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              {isRevokingOthers
                ? isAr
                  ? "جاري الخروج..."
                  : "Signing out..."
                : t.revokeOthersBtn}
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div
          className={`mt-4 p-3 rounded-xl text-sm flex items-center gap-2.5 ${
            message.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Sessions List */}
      <div className="mt-6 space-y-3">
        {isLoading && sessions.length === 0 ? (
          <div className="py-8 text-center text-zinc-400 text-sm flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>{isAr ? "جاري تحميل الجلسات..." : "Loading sessions..."}</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="py-8 text-center text-zinc-400 text-sm">{t.noSessions}</div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                session.isCurrent
                  ? "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50"
                  : "bg-zinc-50/70 dark:bg-zinc-800/40 border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 shadow-xs border border-zinc-200/60 dark:border-zinc-700 shrink-0">
                  {renderDeviceIcon(session.deviceType)}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                      {session.browser} {isAr ? "على" : "on"} {session.os}
                    </span>

                    {session.isCurrent && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        {t.currentDevice}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 dark:text-zinc-400 flex-wrap">
                    {session.ipAddress && (
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-zinc-400" />
                        <span className="font-mono">{session.ipAddress}</span>
                      </span>
                    )}
                    <span>•</span>
                    <span>
                      {t.lastActive} {formatRelativeTime(session.lastActiveAt)}
                    </span>
                  </div>
                </div>
              </div>

              {!session.isCurrent && (
                <button
                  onClick={() => handleRevokeSingle(session.id)}
                  disabled={revokingId === session.id}
                  className="shrink-0 px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-900 disabled:opacity-50"
                >
                  {revokingId === session.id
                    ? isAr
                      ? "جاري الإلغاء..."
                      : "Revoking..."
                    : t.revokeBtn}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

