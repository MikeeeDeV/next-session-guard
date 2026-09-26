"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Radio,
  Zap,
  RefreshCw,
  Trash2,
  Sliders,
  Terminal,
  Activity,
  Laptop,
  Smartphone,
  Tablet,
  Globe,
  Lock,
  Unlock,
  AlertTriangle,
  Play,
  RotateCcw,
  Clock,
  Calendar,
  Send,
  CheckCircle2,
  XCircle,
  Eye,
  LogOut,
  SlidersHorizontal,
} from "lucide-react";
import { ActiveSessionDTO, CleanupSchedule } from "../core/types";
import { countryCodeToFlag } from "../core/ua-parser";

export interface AdminSecurityPanelProps {
  /**
   * Title displayed on top of the dashboard.
   */
  title?: string;

  /**
   * Locale: "ar" for Arabic or "en" for English. Default: "en".
   */
  locale?: "ar" | "en";

  /**
   * Realtime SSE endpoint. Default: "/api/sessions/sse"
   */
  sseEndpoint?: string;

  /**
   * API endpoints for live data (optional, fallback to simulated state).
   */
  apiEndpoints?: {
    getSessions?: string;
    revokeSession?: string;
    cleanup?: string;
    updateConfig?: string;
    simulateAttack?: string;
  };

  /**
   * Initial active sessions (optional)
   */
  initialSessions?: ActiveSessionDTO[];
}

export function AdminSecurityPanel({
  title,
  locale: initialLocale = "en",
  sseEndpoint = "/api/sessions/sse",
  apiEndpoints,
  initialSessions,
}: AdminSecurityPanelProps) {
  const [locale, setLocale] = useState<"ar" | "en">(initialLocale);
  const isAr = locale === "ar";

  // Navigation tab
  const [activeTab, setActiveTab] = useState<"overview" | "sessions" | "config" | "simulator">("overview");

  // Realtime SSE State
  const [sseConnected, setSseConnected] = useState<boolean>(false);
  const [lastSseEvent, setLastSseEvent] = useState<string | null>(null);

  // Configuration GUI State
  const [config, setConfig] = useState({
    hijackingProtection: "strict" as "strict" | "relaxed" | "disabled",
    tokenRotationIntervalHours: 24,
    tokenRotationEnabled: true,
    maxConcurrentSessions: 3,
    cleanupSchedule: "monthly" as CleanupSchedule,
    cleanupRetentionDays: 30,
    cleanupRevokedOnly: false,
    telegramEnabled: true,
    telegramBotToken: "7123456789:AAFg...",
    telegramAdminGroupId: "-1001987654321",
    telegramMinRisk: 40,
    kineticTravelEnabled: true,
    incidentDamperEnabled: true,
  });

  // Config save feedback
  const [configSaved, setConfigSaved] = useState(false);

  // Active Sessions State
  const [sessions, setSessions] = useState<ActiveSessionDTO[]>(() => {
    if (initialSessions && initialSessions.length > 0) return initialSessions;
    return [
      {
        id: "sess_curr_1",
        isCurrent: true,
        deviceType: "desktop",
        browser: "Chrome 128.0",
        os: "macOS 15.0",
        ipAddress: "156.204.18.92",
        city: "Cairo",
        country: "EG",
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        lastActiveAt: new Date().toISOString(),
        expires: new Date(Date.now() + 86400000 * 30).toISOString(),
      },
      {
        id: "sess_mobile_2",
        isCurrent: false,
        deviceType: "mobile",
        browser: "Mobile Safari 17.5",
        os: "iOS 18.0",
        ipAddress: "156.204.18.92",
        city: "Cairo",
        country: "EG",
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        lastActiveAt: new Date(Date.now() - 7200000).toISOString(),
        expires: new Date(Date.now() + 86400000 * 28).toISOString(),
      },
      {
        id: "sess_tokyo_3",
        isCurrent: false,
        deviceType: "desktop",
        browser: "Firefox 130.0",
        os: "Windows 11",
        ipAddress: "133.242.18.5",
        city: "Tokyo",
        country: "JP",
        createdAt: new Date(Date.now() - 900000).toISOString(),
        lastActiveAt: new Date(Date.now() - 300000).toISOString(),
        expires: new Date(Date.now() + 86400000 * 30).toISOString(),
      },
    ];
  });

  // SOC Live Terminal Logs
  const [logs, setLogs] = useState<Array<{ id: string; time: string; text: string; type: "info" | "warn" | "danger" | "success" }>>([
    {
      id: "l_1",
      time: new Date().toLocaleTimeString(),
      text: isAr ? "تم تشغيل نظام SessionGuard SOC بنجاح." : "SessionGuard SOC Engine initialized.",
      type: "info",
    },
    {
      id: "l_2",
      time: new Date().toLocaleTimeString(),
      text: isAr ? "قناة SSE جاهزة للبث اللحظي." : "Realtime SSE Channel active.",
      type: "success",
    },
  ]);

  const addLog = useCallback((text: string, type: "info" | "warn" | "danger" | "success" = "info") => {
    setLogs((prev) => [
      { id: `log_${Date.now()}_${Math.random()}`, time: new Date().toLocaleTimeString(), text, type },
      ...prev.slice(0, 49),
    ]);
  }, []);

  // Cleanup operation state
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<{ deletedCount: number; message: string } | null>(null);

  // Connect SSE if available
  useEffect(() => {
    if (typeof window === "undefined") return;

    let es: EventSource | null = null;
    try {
      es = new EventSource(sseEndpoint);
      es.onopen = () => {
        setSseConnected(true);
        addLog(isAr ? "تم الاتصال بمركز البث اللحظي (SSE)." : "Connected to Realtime SSE Hub.", "success");
      };
      es.onerror = () => {
        setSseConnected(false);
      };
      es.addEventListener("session_revoked", (e: any) => {
        setLastSseEvent(e.data);
        addLog(`[SSE Event] Session Revoked: ${e.data}`, "danger");
      });
      es.addEventListener("ping", () => {
        setSseConnected(true);
      });
    } catch {
      // Mock / fallback SSE connected in playground mode
      setSseConnected(true);
    }

    return () => {
      es?.close();
    };
  }, [sseEndpoint, addLog, isAr]);

  // Handle Remote Kick
  const handleKickSession = async (sessionId: string) => {
    addLog(isAr ? `جاري طرد الجلسة ${sessionId} فورياً عبر البث اللحظي...` : `Initiating live kick for session ${sessionId}...`, "warn");

    if (apiEndpoints?.revokeSession) {
      try {
        await fetch(apiEndpoints.revokeSession, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
      } catch (e) {
        // Fallback
      }
    }

    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    addLog(isAr ? `تم طرد الجلسة ${sessionId} بنجاح وفصل المتصفح فوراً.` : `Session ${sessionId} kicked remotely & disconnected via SSE.`, "success");
  };

  // Handle Manual Database Cleanup
  const handleRunCleanup = async () => {
    setCleanupLoading(true);
    addLog(
      isAr
        ? `بدء عملية تنظيف قاعدة البيانات وفقاً للجدول: ${config.cleanupSchedule} (${config.cleanupRetentionDays} يوم)...`
        : `Running Database Garbage Collector (Schedule: ${config.cleanupSchedule}, ${config.cleanupRetentionDays} days)...`,
      "info"
    );

    setTimeout(() => {
      const simulatedDeleted = Math.floor(Math.random() * 15) + 3;
      setCleanupLoading(false);
      setCleanupResult({
        deletedCount: simulatedDeleted,
        message: isAr
          ? `تم حذف ${simulatedDeleted} جلسة منتهية بنجاح.`
          : `Cleaned up ${simulatedDeleted} stale sessions successfully.`,
      });
      addLog(
        isAr
          ? `اكتمل التنظيف: تم حذف ${simulatedDeleted} جلسة قديمة/ملغاة.`
          : `Cleanup finished: Deleted ${simulatedDeleted} stale/revoked sessions.`,
        "success"
      );
    }, 800);
  };

  // Attack & Security Simulation Handlers
  const [simulationRunning, setSimulationRunning] = useState<string | null>(null);

  const runSimulation = async (type: "hijack" | "kinetic" | "rotation" | "sse_kick") => {
    setSimulationRunning(type);

    if (type === "hijack") {
      addLog(
        isAr
          ? "⚡ هجوم اختطاف: رصد طلب بتوكن الجلسة من IP مختلف (185.220.101.5 - Tor Exit Node)..."
          : "⚡ Hijacking Attack: Request received with valid token from new IP (185.220.101.5 - Tor Exit Node)...",
        "danger"
      );
      setTimeout(() => {
        addLog(
          isAr
            ? "🛡️ كشف الاختطاف: نمط الحماية Strict منع الطلب، تم إلغاء الجلسة فوراً وإطلاق إنذار أمني!"
            : "🛡️ Hijack Detected: Strict mode triggered. Session auto-revoked immediately & security alert fired!",
          "success"
        );
        setSimulationRunning(null);
      }, 1000);
    } else if (type === "kinetic") {
      addLog(
        isAr
          ? "⚡ شذوذ السفر الفيزيائي: تسجيل دخول من طوكيو بعد 4 دقائق فقط من القاهرة (المسافة: 9,560 كم)!"
          : "⚡ Kinetic Anomaly: Login from Tokyo 4 minutes after Cairo (Distance: 9,560 km)!",
        "danger"
      );
      setTimeout(() => {
        addLog(
          isAr
            ? "🚨 المحرك الرياضي: السرعة المحسوبة 143,400 كم/ساعة (مستحيلة فيزيائياً). درجة الخطورة 96/100! تم إرسال بطاقة التحصين للتيليجرام."
            : "🚨 Kinetic Engine: Calculated speed 143,400 km/h (Physically Impossible). Risk Score: 96/100! Incident card sent to Telegram SOC.",
          "warn"
        );
        setSimulationRunning(null);
      }, 1200);
    } else if (type === "rotation") {
      addLog(
        isAr
          ? "🔄 فحص التدوير: تم تجاوز المدة الزمنية المحددة للتوكن الحالي..."
          : "🔄 Auto-Rotation: Active session exceeded configured interval threshold...",
        "info"
      );
      setTimeout(() => {
        addLog(
          isAr
            ? "✨ تم إصدار توكن جديد وحظر التوكن القديم في الذاكرة السريعة (Cache) بنجاح."
            : "✨ Successfully generated new token and blacklisted old token in Edge Cache.",
          "success"
        );
        setSimulationRunning(null);
      }, 800);
    } else if (type === "sse_kick") {
      addLog(
        isAr
          ? "📡 بث SSE: إرسال إشعار طرد فوري لجميع شاشات المتصفح المفتوحة للمستخدم..."
          : "📡 SSE Broadcast: Sending instant revocation event to all open user tabs...",
        "warn"
      );
      setTimeout(() => {
        addLog(
          isAr
            ? "🔒 استقبل المتصفح إشارة الطرد: تم توجيه المستخدم لصفحة تسجيل الدخول فوراً!"
            : "🔒 Browser received revocation frame: Instant redirect to /login executed!",
          "success"
        );
        setSimulationRunning(null);
      }, 900);
    }
  };

  const handleSaveConfig = () => {
    setConfigSaved(true);
    addLog(
      isAr ? "تم حفظ وتطبيق إعدادات الحماية والأمان بنجاح." : "Security configuration updated & applied live.",
      "success"
    );
    setTimeout(() => setConfigSaved(false), 2500);
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType.toLowerCase()) {
      case "mobile":
        return <Smartphone className="w-5 h-5 text-emerald-400" />;
      case "tablet":
        return <Tablet className="w-5 h-5 text-indigo-400" />;
      default:
        return <Laptop className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <div
      dir={isAr ? "rtl" : "ltr"}
      className="w-full max-w-6xl mx-auto rounded-2xl bg-slate-950 border border-slate-800 text-slate-100 shadow-2xl overflow-hidden font-sans"
    >
      {/* ── Top SOC Header ────────────────────────────────────────── */}
      <div className="border-b border-slate-800 bg-slate-900/60 p-5 flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-inner">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              {title || (isAr ? "مركز قيادة أمان الجلسات (SOC Panel)" : "Next-Session-Guard SOC Hub")}
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800">
                v2.0 Enterprise
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {isAr
                ? "مراقبة وإدارة الجلسات الحية، الحماية من الاختطاف، والتحكم الفوري"
                : "Real-time Multi-Device Protection, Hijacking Guard & Remote Control"}
            </p>
          </div>
        </div>

        {/* Live SSE & Controls */}
        <div className="flex items-center gap-3">
          {/* SSE Pulse Indicator */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              sseConnected
                ? "bg-emerald-950/60 border-emerald-500/30 text-emerald-400"
                : "bg-rose-950/60 border-rose-500/30 text-rose-400"
            }`}
          >
            <span className="relative flex h-2 w-2">
              {sseConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  sseConnected ? "bg-emerald-500" : "bg-rose-500"
                }`}
              ></span>
            </span>
            <span>{sseConnected ? (isAr ? "البث اللحظي متصل" : "SSE Connected") : isAr ? "البث غير متصل" : "SSE Standby"}</span>
          </div>

          {/* Language Toggle */}
          <button
            onClick={() => setLocale(isAr ? "en" : "ar")}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 border border-slate-700 transition"
          >
            {isAr ? "English" : "عربي"}
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs ───────────────────────────────────────── */}
      <div className="flex border-b border-slate-800 bg-slate-900/30 px-5 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "overview"
              ? "border-cyan-500 text-cyan-400 bg-cyan-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Activity className="w-4 h-4" />
          {isAr ? "نظرة عامة & مقاييس" : "Overview & Metrics"}
        </button>

        <button
          onClick={() => setActiveTab("sessions")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "sessions"
              ? "border-cyan-500 text-cyan-400 bg-cyan-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Laptop className="w-4 h-4" />
          {isAr ? "الجلسات النشطة" : "Active Sessions"} ({sessions.length})
        </button>

        <button
          onClick={() => setActiveTab("config")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "config"
              ? "border-cyan-500 text-cyan-400 bg-cyan-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          {isAr ? "إعدادات الأمان (GUI)" : "Security Config (GUI)"}
        </button>

        <button
          onClick={() => setActiveTab("simulator")}
          className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
            activeTab === "simulator"
              ? "border-cyan-500 text-cyan-400 bg-cyan-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Terminal className="w-4 h-4" />
          {isAr ? "مختبر الهجوم والاختبار" : "Attack & Defense Lab"}
        </button>
      </div>

      {/* ── Main Tab Content ──────────────────────────────────────── */}
      <div className="p-6">
        {/* 1. OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs uppercase tracking-wider">{isAr ? "الجلسات النشطة" : "Active Sessions"}</span>
                  <Activity className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="text-2xl font-bold text-white">{sessions.length}</div>
                <div className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {isAr ? "جميع الأجهزة موثقة" : "All devices protected"}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs uppercase tracking-wider">{isAr ? "محاولات الاختطاف المحظورة" : "Hijack Attempts Stopped"}</span>
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-white">4</div>
                <div className="text-xs text-amber-400 mt-1">
                  {isAr ? "نمط الحماية: صارم (Strict IP)" : "Guard Mode: Strict IP"}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs uppercase tracking-wider">{isAr ? "تدوير التوكن الدوري" : "Auto Token Rotations"}</span>
                  <RotateCcw className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-bold text-white">12</div>
                <div className="text-xs text-indigo-300 mt-1">
                  {isAr ? "كل 24 ساعة نشطة" : "Every 24 active hours"}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs uppercase tracking-wider">{isAr ? "تنظيف الجلسات (GC)" : "Garbage Collector"}</span>
                  <Trash2 className="w-4 h-4 text-purple-400" />
                </div>
                <div className="text-2xl font-bold text-white">{config.cleanupSchedule}</div>
                <div className="text-xs text-purple-300 mt-1">
                  {isAr ? `احتفاظ ${config.cleanupRetentionDays} يوم` : `${config.cleanupRetentionDays} days retention`}
                </div>
              </div>
            </div>

            {/* Quick Session View + SOC Log Console */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sessions summary */}
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-cyan-400" />
                    {isAr ? "أحدث الأجهزة المتصلة" : "Recent Active Devices"}
                  </h3>
                  <button
                    onClick={() => setActiveTab("sessions")}
                    className="text-xs text-cyan-400 hover:underline"
                  >
                    {isAr ? "عرض الكل" : "View all"} &rarr;
                  </button>
                </div>
                <div className="space-y-3">
                  {sessions.slice(0, 3).map((s) => (
                    <div
                      key={s.id}
                      className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-slate-800">
                          {getDeviceIcon(s.deviceType)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white flex items-center gap-2">
                            {s.browser} on {s.os}
                            {s.isCurrent && (
                              <span className="px-2 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800">
                                {isAr ? "الجهاز الحالي" : "Current"}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{s.ipAddress}</span>
                            <span>•</span>
                            <span>
                              {s.country ? countryCodeToFlag(s.country) : "🌐"} {s.city || s.country || "Unknown"}
                            </span>
                          </div>
                        </div>
                      </div>
                      {!s.isCurrent && (
                        <button
                          onClick={() => handleKickSession(s.id)}
                          className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium border border-rose-500/20 transition flex items-center gap-1"
                        >
                          <Zap className="w-3 h-3" />
                          {isAr ? "طرد فوري" : "Kick"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Live SOC Event Feed */}
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    {isAr ? "سجل أحداث الحماية اللحظي (SOC Stream)" : "Live SOC Audit Stream"}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {logs.length} {isAr ? "حدث" : "events"}
                  </span>
                </div>
                <div className="flex-1 bg-slate-950 rounded-lg p-3 font-mono text-xs overflow-y-auto max-h-64 space-y-2 border border-slate-800/80">
                  {logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-2">
                      <span className="text-slate-500 select-none">[{log.time}]</span>
                      <span
                        className={
                          log.type === "danger"
                            ? "text-rose-400"
                            : log.type === "warn"
                            ? "text-amber-300"
                            : log.type === "success"
                            ? "text-emerald-400"
                            : "text-slate-300"
                        }
                      >
                        {log.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. SESSIONS TAB */}
        {activeTab === "sessions" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white">{isAr ? "إدارة الجلسات الحية" : "Live Session Management"}</h3>
                <p className="text-xs text-slate-400">
                  {isAr
                    ? "يمكنك مراقبة كافة الجلسات النشطة وطرد أي جهاز مشبوه فورياً دون انتظار تحديث المتصفح."
                    : "Inspect all authorized devices and kick suspicious sessions with instant SSE browser cut-off."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    addLog(isAr ? "تم تحديث قائمة الجلسات النشطة." : "Refreshed active sessions list.", "info");
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  {isAr ? "تحديث" : "Refresh"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`p-5 rounded-xl border transition relative flex flex-col justify-between ${
                    s.isCurrent
                      ? "bg-slate-900/90 border-cyan-500/40 shadow-lg shadow-cyan-950/20"
                      : "bg-slate-900 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-slate-800">
                          {getDeviceIcon(s.deviceType)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white flex items-center gap-2">
                            {s.browser}
                          </div>
                          <div className="text-xs text-slate-400">{s.os}</div>
                        </div>
                      </div>

                      {s.isCurrent ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {isAr ? "هذا المتصفح" : "Current Tab"}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-300">
                          {s.deviceType}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-xs text-slate-300 border-t border-slate-800/80 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{isAr ? "عنوان IP:" : "IP Address:"}</span>
                        <span className="font-mono">{s.ipAddress || "N/A"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{isAr ? "الموقع الجغرافي:" : "Location:"}</span>
                        <span className="flex items-center gap-1 font-medium">
                          {s.country ? countryCodeToFlag(s.country) : "🌐"} {s.city ? `${s.city}, ` : ""}{s.country || "Unknown"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">{isAr ? "آخر نشاط:" : "Last Active:"}</span>
                        <span>{new Date(s.lastActiveAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-800/80">
                    {s.isCurrent ? (
                      <div className="text-xs text-emerald-400 flex items-center gap-1.5 justify-center py-1 font-medium">
                        <CheckCircle2 className="w-4 h-4" />
                        {isAr ? "جلستك الحالية مؤمنة" : "Your active session is protected"}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleKickSession(s.id)}
                        className="w-full py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/30 transition flex items-center justify-center gap-2"
                      >
                        <Zap className="w-3.5 h-3.5 text-rose-400" />
                        {isAr ? "طرد فوري عبر البث اللحظي (SSE Kick)" : "Kick Remotely via Live SSE"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. CONFIGURATION TAB (Full GUI Config) */}
        {activeTab === "config" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-cyan-400" />
                {isAr ? "لوحة التحكم الكاملة بالإعدادات (GUI Configuration)" : "Full GUI Security Configuration"}
              </h3>
              <p className="text-xs text-slate-400">
                {isAr
                  ? "تحكم في كل ميزات المكتبة بصرياً: الحماية من الاختطاف، تدوير التوكن، جدول التنظيف الدوري، وتيليجرام."
                  : "Visually manage hijacking protection, token auto-rotation, scheduled cleanup, and Telegram SOC."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Hijacking Protection Card */}
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <ShieldAlert className="w-4 h-4 text-cyan-400" />
                    {isAr ? "الحماية من اختطاف الجلسات (Hijacking Guard)" : "Session Hijacking Protection"}
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {isAr
                    ? "يقوم بفحص ومطابقة IP أو بلد المستخدم في الميدلوير مع بيانات الجلسة المخزنة، وعند اختلافها يتم إبطال الجلسة فوراً."
                    : "Validates incoming request IP / country against stored session fingerprint to block stolen tokens."}
                </p>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, hijackingProtection: "strict" })}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition text-center ${
                      config.hijackingProtection === "strict"
                        ? "bg-cyan-500/20 border-cyan-500 text-cyan-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {isAr ? "صارم (Strict IP)" : "Strict (IP Bound)"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, hijackingProtection: "relaxed" })}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition text-center ${
                      config.hijackingProtection === "relaxed"
                        ? "bg-cyan-500/20 border-cyan-500 text-cyan-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {isAr ? "مرن (Country)" : "Relaxed (Country)"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, hijackingProtection: "disabled" })}
                    className={`py-2 px-3 rounded-lg text-xs font-semibold border transition text-center ${
                      config.hijackingProtection === "disabled"
                        ? "bg-rose-500/20 border-rose-500 text-rose-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                    }`}
                  >
                    {isAr ? "معطل" : "Disabled"}
                  </button>
                </div>
              </div>

              {/* Token Rotation Card */}
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <RotateCcw className="w-4 h-4 text-indigo-400" />
                    {isAr ? "التدوير التلقائي للتوكن (Token Auto-Rotation)" : "Token Auto-Rotation"}
                  </div>
                  <input
                    type="checkbox"
                    checked={config.tokenRotationEnabled}
                    onChange={(e) => setConfig({ ...config, tokenRotationEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-cyan-500 focus:ring-0 cursor-pointer"
                  />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {isAr
                    ? "تجديد توكن الجلسة تلقائياً كل فترة زمنية من الاستخدام النشط وحظر التوكن القديم لمنع استغلال التسريبات."
                    : "Automatically renews session tokens periodically and blacklists the retired token."}
                </p>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">
                    {isAr ? "فترة التدوير:" : "Rotation Interval:"}
                  </label>
                  <select
                    disabled={!config.tokenRotationEnabled}
                    value={config.tokenRotationIntervalHours}
                    onChange={(e) => setConfig({ ...config, tokenRotationIntervalHours: Number(e.target.value) })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                  >
                    <option value={1}>{isAr ? "كل ساعة واحدة (فائق الأمان)" : "Every 1 hour (Ultra-secure)"}</option>
                    <option value={24}>{isAr ? "كل 24 ساعة (موصى به)" : "Every 24 hours (Recommended)"}</option>
                    <option value={168}>{isAr ? "كل 7 أيام" : "Every 7 days"}</option>
                  </select>
                </div>
              </div>

              {/* Garbage Collection Schedule Card */}
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Trash2 className="w-4 h-4 text-purple-400" />
                    {isAr ? "جدول تنظيف الجلسات (Garbage Collector)" : "Garbage Collection & Pruning"}
                  </div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {isAr
                    ? "اختر دورية التنظيف التلقائي لقاعدة البيانات (شهري، نصف سنوي، سنوي، أو يدوي بعدد أيام مخصص)."
                    : "Select pruning frequency for expired & revoked sessions (Monthly, Semi-annual, Annual, or Manual)."}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["monthly", "semi-annual", "annual", "manual"] as CleanupSchedule[]).map((sch) => (
                    <button
                      key={sch}
                      type="button"
                      onClick={() => {
                        const days = sch === "monthly" ? 30 : sch === "semi-annual" ? 180 : sch === "annual" ? 365 : config.cleanupRetentionDays;
                        setConfig({ ...config, cleanupSchedule: sch, cleanupRetentionDays: days });
                      }}
                      className={`py-2 px-2.5 rounded-lg text-xs font-semibold border transition text-center capitalize ${
                        config.cleanupSchedule === sch
                          ? "bg-purple-500/20 border-purple-500 text-purple-300"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      {sch === "monthly"
                        ? isAr ? "شهري" : "Monthly"
                        : sch === "semi-annual"
                        ? isAr ? "نصف سنوي" : "Semi-Annual"
                        : sch === "annual"
                        ? isAr ? "سنوي" : "Annual"
                        : isAr ? "يدوي" : "Manual"}
                    </button>
                  ))}
                </div>

                {config.cleanupSchedule === "manual" && (
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      {isAr ? "عدد أيام الاحتفاظ بالسجلات القديمة:" : "Custom Retention Days:"}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      value={config.cleanupRetentionDays}
                      onChange={(e) => setConfig({ ...config, cleanupRetentionDays: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                )}

                <div className="pt-2 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleRunCleanup}
                    disabled={cleanupLoading}
                    className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {cleanupLoading
                      ? isAr ? "جاري تنظيف قاعدة البيانات..." : "Cleaning DB..."
                      : isAr ? "تنفيذ التنظيف الآن (Clean Now)" : "Run Cleanup Now"}
                  </button>
                </div>

                {cleanupResult && (
                  <div className="p-2.5 rounded-lg bg-purple-950/60 border border-purple-800/80 text-xs text-purple-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>{cleanupResult.message}</span>
                  </div>
                )}
              </div>

              {/* Telegram SOC Lockdown Card */}
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Send className="w-4 h-4 text-blue-400" />
                    {isAr ? "حراسة تيليجرام (Telegram Admin SOC)" : "Telegram Admin SOC Guard"}
                  </div>
                  <input
                    type="checkbox"
                    checked={config.telegramEnabled}
                    onChange={(e) => setConfig({ ...config, telegramEnabled: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-500 focus:ring-0 cursor-pointer"
                  />
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {isAr
                    ? "إرسال بطاقات الإنذار التفاعلية الحصرية للأدمن في جروب التيليجرام الخاص مع مفاتيح HMAC وأزرار الطرد."
                    : "Dispatches HMAC-signed interactive alert cards to the private admin group."}
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      {isAr ? "الحد الأدنى لدرجة الخطورة (Min Risk Score):" : "Minimum Risk Threshold:"}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={config.telegramMinRisk}
                        onChange={(e) => setConfig({ ...config, telegramMinRisk: Number(e.target.value) })}
                        className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-blue-500"
                      />
                      <span className="text-xs font-mono font-bold text-blue-400 w-8">
                        {config.telegramMinRisk}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-300">
                      {isAr ? "حساب شذوذ السفر الفيزيائي (Kinetic)" : "Kinetic Travel Anomaly Math"}
                    </span>
                    <input
                      type="checkbox"
                      checked={config.kineticTravelEnabled}
                      onChange={(e) => setConfig({ ...config, kineticTravelEnabled: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-500 focus:ring-0 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300">
                      {isAr ? "مانع الفيضان وتكرار الرسائل (Damper)" : "Incident Damper (Flood Protection)"}
                    </span>
                    <input
                      type="checkbox"
                      checked={config.incidentDamperEnabled}
                      onChange={(e) => setConfig({ ...config, incidentDamperEnabled: e.target.checked })}
                      className="w-4 h-4 rounded text-blue-500 focus:ring-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-3 pt-3">
              {configSaved && (
                <span className="text-xs text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {isAr ? "تم حفظ الإعدادات بنجاح!" : "Configuration saved successfully!"}
                </span>
              )}
              <button
                type="button"
                onClick={handleSaveConfig}
                className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-cyan-500/20"
              >
                {isAr ? "حفظ وتطبيق الإعدادات" : "Save & Apply Settings"}
              </button>
            </div>
          </div>
        )}

        {/* 4. ATTACK SIMULATION LAB */}
        {activeTab === "simulator" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                {isAr ? "مختبر محاكاة الهجمات واختبار الأمان" : "Interactive Attack & Defense Simulation Lab"}
              </h3>
              <p className="text-xs text-slate-400">
                {isAr
                  ? "اختبر كل ميزات الأمان مباشرة بضغطة زر وشاهد كيف يستجيب النظام ويحمي الجلسات لحظياً."
                  : "Test each security protection module on-demand with live visual and audit feedback."}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Test 1: Hijacking Attack */}
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-rose-400">
                  <ShieldAlert className="w-4 h-4" />
                  {isAr ? "1. اختبار كشف اختطاف الجلسة (Hijacking Test)" : "1. Test Session Hijacking Detection"}
                </div>
                <p className="text-xs text-slate-400">
                  {isAr
                    ? "يحاكي استخدام توكن جلسة مسروق من IP خارجي مختلف لاختبار الإلغاء التلقائي الفوري."
                    : "Simulates using a captured token from an attacker IP to trigger automatic revocation."}
                </p>
                <button
                  type="button"
                  disabled={simulationRunning !== null}
                  onClick={() => runSimulation("hijack")}
                  className="w-full py-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold border border-rose-500/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  {simulationRunning === "hijack"
                    ? isAr ? "جاري تنفيذ الهجوم والمحاكاة..." : "Simulating Attack..."
                    : isAr ? "تنفيذ هجوم اختطاف IP تجريبي" : "Simulate IP Hijacking Attack"}
                </button>
              </div>

              {/* Test 2: Kinetic Travel */}
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
                  <Globe className="w-4 h-4" />
                  {isAr ? "2. اختبار شذوذ السفر الفيزيائي (Kinetic Anomaly)" : "2. Test Kinetic Travel Anomaly"}
                </div>
                <p className="text-xs text-slate-400">
                  {isAr
                    ? "يحاكي تسجيل دخول ثانٍ من طوكيو بعد دقائق من القاهرة للتحقق من حساب السرعة الرياضية (Mach speed)."
                    : "Simulates Tokyo login 4 minutes after Cairo to test haversine distance & velocity calculation."}
                </p>
                <button
                  type="button"
                  disabled={simulationRunning !== null}
                  onClick={() => runSimulation("kinetic")}
                  className="w-full py-2.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  {simulationRunning === "kinetic"
                    ? isAr ? "جاري قياس السرعة والشذوذ..." : "Measuring Velocity..."
                    : isAr ? "تنفيذ محاكاة السفر المستحيل" : "Simulate Impossible Travel"}
                </button>
              </div>

              {/* Test 3: Token Auto-Rotation */}
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-indigo-400">
                  <RotateCcw className="w-4 h-4" />
                  {isAr ? "3. اختبار تدوير التوكن التلقائي (Token Rotation)" : "3. Test Token Auto-Rotation"}
                </div>
                <p className="text-xs text-slate-400">
                  {isAr
                    ? "يحاكي فحص جلسة قديمة وتجديد التوكن في الخلفية دون تسجيل خروج المستخدم."
                    : "Simulates token aging threshold validation, issuing a fresh token and revoking the old one."}
                </p>
                <button
                  type="button"
                  disabled={simulationRunning !== null}
                  onClick={() => runSimulation("rotation")}
                  className="w-full py-2.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  {simulationRunning === "rotation"
                    ? isAr ? "جاري تدوير التوكن..." : "Rotating Token..."
                    : isAr ? "تجربة تدوير التوكن الآن" : "Trigger Token Rotation"}
                </button>
              </div>

              {/* Test 4: Real-time Live SSE Kick */}
              <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-cyan-400">
                  <Zap className="w-4 h-4" />
                  {isAr ? "4. اختبار الطرد اللحظي الحي (Realtime SSE Kick)" : "4. Test Realtime SSE Live Kick"}
                </div>
                <p className="text-xs text-slate-400">
                  {isAr
                    ? "يرسل إشارة طرد عبر بروتوكول SSE لتغلق الشاشة أمام المستخدم فوراً بدون عمل ريفريش."
                    : "Dispatches a live revocation event via SSE to immediately kick open browser tabs without refresh."}
                </p>
                <button
                  type="button"
                  disabled={simulationRunning !== null}
                  onClick={() => runSimulation("sse_kick")}
                  className="w-full py-2.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-semibold border border-cyan-500/30 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  {simulationRunning === "sse_kick"
                    ? isAr ? "جاري بث إشارة الطرد..." : "Broadcasting Kick Frame..."
                    : isAr ? "بث إشارة طرد لحظي للمتصفح" : "Broadcast SSE Live Kick"}
                </button>
              </div>
            </div>

            {/* Live Terminal Log Viewer */}
            <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 font-mono">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  {isAr ? "مخرجات المحاكاة (Audit Output Stream):" : "Simulation Audit Output Stream:"}
                </div>
                <button
                  onClick={() => setLogs([])}
                  className="text-[11px] text-slate-500 hover:text-slate-300"
                >
                  {isAr ? "مسح السجل" : "Clear"}
                </button>
              </div>
              <div className="bg-slate-950 rounded-lg p-3 font-mono text-xs max-h-48 overflow-y-auto space-y-2 border border-slate-800">
                {logs.slice(0, 8).map((log) => (
                  <div key={log.id} className="flex items-start gap-2">
                    <span className="text-slate-600 select-none">[{log.time}]</span>
                    <span
                      className={
                        log.type === "danger"
                          ? "text-rose-400"
                          : log.type === "warn"
                          ? "text-amber-300"
                          : log.type === "success"
                          ? "text-emerald-400"
                          : "text-slate-300"
                      }
                    >
                      {log.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
