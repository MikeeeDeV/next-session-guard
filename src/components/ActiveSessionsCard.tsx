"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
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
  ChevronDown,
  Clock,
  Calendar,
  Monitor,
} from "lucide-react";
import { ActiveSessionDTO } from "../core/types";
import { countryCodeToFlag } from "../core/ua-parser";

// ── Server Actions Interface ────────────────────────────────────────────────
export interface ServerActionsConfig {
  getSessions: () => Promise<{ sessions?: ActiveSessionDTO[]; error?: string }>;
  revokeSession: (sessionId: string) => Promise<{ success?: boolean; error?: string }>;
  revokeOtherSessions: () => Promise<{ success?: boolean; revokedCount?: number; error?: string }>;
}

export interface ActiveSessionsCardProps {
  /**
   * API endpoint to list active sessions.
   * Default: "/api/sessions"
   * Ignored when `serverActions` is provided.
   */
  sessionsApiEndpoint?: string;

  /**
   * API endpoint to revoke all other sessions.
   * Default: "/api/sessions/revoke-others"
   * Ignored when `serverActions` is provided.
   */
  revokeOthersApiEndpoint?: string;

  /**
   * Optional Server Actions to use instead of API routes.
   * When provided, API endpoints are ignored and actions are called directly.
   *
   * @example
   * ```tsx
   * import { getSessions, revokeSession, revokeOtherSessions } from "@/lib/session-actions";
   * <ActiveSessionsCard serverActions={{ getSessions, revokeSession, revokeOtherSessions }} />
   * ```
   */
  serverActions?: ServerActionsConfig;

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

// ── Skeleton Component ──────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="nsg-skeleton-row">
      <div className="nsg-skeleton-icon" />
      <div className="nsg-skeleton-content">
        <div className="nsg-skeleton-line nsg-skeleton-line--title" />
        <div className="nsg-skeleton-line nsg-skeleton-line--subtitle" />
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export function ActiveSessionsCard({
  sessionsApiEndpoint = "/api/sessions",
  revokeOthersApiEndpoint = "/api/sessions/revoke-others",
  serverActions,
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

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
    createdAt: isAr ? "تاريخ الإنشاء:" : "Created:",
    expiresIn: isAr ? "تنتهي في:" : "Expires in:",
    sessionDetails: isAr ? "تفاصيل الجلسة" : "Session Details",
  };

  // ── Data Fetching ───────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      if (serverActions) {
        const result = await serverActions.getSessions();
        if (result.error) throw new Error(result.error);
        setSessions(result.sessions || []);
      } else {
        const res = await fetch(sessionsApiEndpoint);
        if (!res.ok) throw new Error("Failed to load sessions");
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch (err: any) {
      setMessage({
        type: "error",
        text: isAr ? "تعذر تحميل قائمة الجلسات النشطة" : "Failed to load active sessions",
      });
    } finally {
      setIsLoading(false);
    }
  }, [sessionsApiEndpoint, serverActions, isAr]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // ── Revoke Single Session ──────────────────────────────────
  const handleRevokeSingle = async (sessionId: string) => {
    if (!window.confirm(t.confirmRevokeSingle)) return;
    setRevokingId(sessionId);
    setMessage(null);

    try {
      if (serverActions) {
        const result = await serverActions.revokeSession(sessionId);
        if (result.error) throw new Error(result.error);
      } else {
        const res = await fetch(`${sessionsApiEndpoint}?id=${encodeURIComponent(sessionId)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error();
      }

      // Animate removal
      setRemovingIds((prev) => new Set(prev).add(sessionId));
      setTimeout(() => {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        setRemovingIds((prev) => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      }, 300);

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

  // ── Revoke All Others ──────────────────────────────────────
  const handleRevokeOthers = async () => {
    if (!window.confirm(t.confirmRevokeOther)) return;
    setIsRevokingOthers(true);
    setMessage(null);

    try {
      if (serverActions) {
        const result = await serverActions.revokeOtherSessions();
        if (result.error) throw new Error(result.error);
      } else {
        const res = await fetch(revokeOthersApiEndpoint, { method: "POST" });
        if (!res.ok) throw new Error();
      }

      // Animate removal of non-current sessions
      const otherIds = sessions.filter((s) => !s.isCurrent).map((s) => s.id);
      setRemovingIds(new Set(otherIds));
      setTimeout(() => {
        setSessions((prev) => prev.filter((s) => s.isCurrent));
        setRemovingIds(new Set());
      }, 300);

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

  // ── Formatting Helpers ─────────────────────────────────────
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

  const formatDate = (dateStr: string | Date) => {
    try {
      return new Date(dateStr).toLocaleDateString(isAr ? "ar-EG" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return String(dateStr);
    }
  };

  const formatExpiresIn = (dateStr: string | Date) => {
    try {
      const diffMs = new Date(dateStr).getTime() - Date.now();
      if (diffMs <= 0) return isAr ? "منتهية الصلاحية" : "Expired";
      const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
      if (days > 0) return isAr ? `${days} يوم` : `${days}d ${hours}h`;
      return isAr ? `${hours} ساعة` : `${hours}h`;
    } catch {
      return String(dateStr);
    }
  };

  const renderGeoLabel = (session: ActiveSessionDTO): string | null => {
    if (!session.city && !session.country) return null;
    const flag = session.country ? countryCodeToFlag(session.country) : "";
    const parts: string[] = [];
    if (session.city) parts.push(session.city);
    if (session.country) parts.push(session.country);
    return `${parts.join(", ")} ${flag}`.trim();
  };

  const renderDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case "mobile":
        return <Smartphone className="nsg-icon nsg-icon--mobile" />;
      case "tablet":
        return <Tablet className="nsg-icon nsg-icon--tablet" />;
      case "desktop":
      default:
        return <Laptop className="nsg-icon nsg-icon--desktop" />;
    }
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <>
      <style>{styles}</style>
      <div dir={isAr ? "rtl" : "ltr"} className={`nsg-card ${className}`}>
        {/* Header */}
        <div className="nsg-header">
          <div className="nsg-header__info">
            <div className="nsg-header__icon-wrap">
              <ShieldCheck className="nsg-header__icon" />
            </div>
            <div>
              <h3 className="nsg-header__title">{t.title}</h3>
              <p className="nsg-header__subtitle">{t.subtitle}</p>
            </div>
          </div>

          <div className="nsg-header__actions">
            <button
              onClick={fetchSessions}
              disabled={isLoading}
              className="nsg-btn nsg-btn--refresh"
              title="Refresh"
            >
              <RefreshCw className={`nsg-btn__icon ${isLoading ? "nsg-spin" : ""}`} />
            </button>

            {otherSessionsCount > 0 && (
              <button
                onClick={handleRevokeOthers}
                disabled={isRevokingOthers}
                className="nsg-btn nsg-btn--danger"
              >
                <LogOut className="nsg-btn__icon-sm" />
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
            className={`nsg-alert ${
              message.type === "success" ? "nsg-alert--success" : "nsg-alert--error"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="nsg-alert__icon" />
            ) : (
              <AlertTriangle className="nsg-alert__icon" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Sessions List */}
        <div className="nsg-sessions">
          {isLoading && sessions.length === 0 ? (
            <div className="nsg-skeleton-container">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : sessions.length === 0 ? (
            <div className="nsg-empty">{t.noSessions}</div>
          ) : (
            sessions.map((session) => {
              const isRemoving = removingIds.has(session.id);
              const isExpanded = expandedId === session.id;
              const geoLabel = renderGeoLabel(session);

              return (
                <div
                  key={session.id}
                  className={`nsg-session ${
                    session.isCurrent ? "nsg-session--current" : ""
                  } ${isRemoving ? "nsg-session--removing" : ""}`}
                >
                  {/* Main row */}
                  <div
                    className="nsg-session__main"
                    onClick={() => setExpandedId(isExpanded ? null : session.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpandedId(isExpanded ? null : session.id);
                      }
                    }}
                  >
                    <div className="nsg-session__left">
                      <div className="nsg-session__device-icon">
                        {renderDeviceIcon(session.deviceType)}
                      </div>

                      <div className="nsg-session__info">
                        <div className="nsg-session__title-row">
                          <span className="nsg-session__name">
                            {session.browser} {isAr ? "على" : "on"} {session.os}
                          </span>

                          {session.isCurrent && (
                            <span className="nsg-badge nsg-badge--current">
                              <span className="nsg-badge__dot" />
                              {t.currentDevice}
                            </span>
                          )}
                        </div>

                        <div className="nsg-session__meta">
                          {geoLabel && (
                            <>
                              <span className="nsg-session__geo">{geoLabel}</span>
                              <span className="nsg-session__sep">•</span>
                            </>
                          )}
                          {session.ipAddress && (
                            <>
                              <span className="nsg-session__ip">
                                <Globe className="nsg-meta-icon" />
                                <span className="nsg-mono">{session.ipAddress}</span>
                              </span>
                              <span className="nsg-session__sep">•</span>
                            </>
                          )}
                          <span>
                            {t.lastActive} {formatRelativeTime(session.lastActiveAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="nsg-session__right">
                      <ChevronDown
                        className={`nsg-chevron ${isExpanded ? "nsg-chevron--open" : ""}`}
                      />
                      {!session.isCurrent && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRevokeSingle(session.id);
                          }}
                          disabled={revokingId === session.id}
                          className="nsg-btn nsg-btn--revoke"
                        >
                          {revokingId === session.id
                            ? isAr
                              ? "جاري الإلغاء..."
                              : "Revoking..."
                            : t.revokeBtn}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable Details */}
                  <div
                    className={`nsg-details ${isExpanded ? "nsg-details--open" : ""}`}
                  >
                    <div className="nsg-details__inner">
                      <div className="nsg-details__grid">
                        <div className="nsg-details__item">
                          <Calendar className="nsg-details__icon" />
                          <div>
                            <span className="nsg-details__label">{t.createdAt}</span>
                            <span className="nsg-details__value">{formatDate(session.createdAt)}</span>
                          </div>
                        </div>
                        <div className="nsg-details__item">
                          <Clock className="nsg-details__icon" />
                          <div>
                            <span className="nsg-details__label">{t.expiresIn}</span>
                            <span className="nsg-details__value">{formatExpiresIn(session.expires)}</span>
                          </div>
                        </div>
                        <div className="nsg-details__item">
                          <Monitor className="nsg-details__icon" />
                          <div>
                            <span className="nsg-details__label">
                              {isAr ? "نوع الجهاز:" : "Device:"}
                            </span>
                            <span className="nsg-details__value nsg-capitalize">{session.deviceType}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

// ── Embedded Styles (scoped with nsg- prefix) ────────────────────────────────
const styles = `
/* ── Card Container ──────────────────────────────────── */
.nsg-card {
  background: #fff;
  border: 1px solid #e4e4e7;
  border-radius: 1rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #18181b;
}
@media (prefers-color-scheme: dark) {
  .nsg-card {
    background: #18181b;
    border-color: #27272a;
    color: #f4f4f5;
  }
}

/* ── Header ──────────────────────────────────────────── */
.nsg-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #f4f4f5;
}
@media (prefers-color-scheme: dark) {
  .nsg-header { border-bottom-color: #27272a; }
}
.nsg-header__info {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}
.nsg-header__icon-wrap {
  padding: 0.625rem;
  border-radius: 0.75rem;
  background: #eff6ff;
  color: #2563eb;
}
@media (prefers-color-scheme: dark) {
  .nsg-header__icon-wrap {
    background: rgba(37,99,235,0.15);
    color: #60a5fa;
  }
}
.nsg-header__icon { width: 1.5rem; height: 1.5rem; }
.nsg-header__title {
  font-size: 1.125rem;
  font-weight: 700;
  margin: 0;
}
.nsg-header__subtitle {
  font-size: 0.875rem;
  color: #71717a;
  margin: 0.125rem 0 0;
}
@media (prefers-color-scheme: dark) {
  .nsg-header__subtitle { color: #a1a1aa; }
}
.nsg-header__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* ── Buttons ─────────────────────────────────────────── */
.nsg-btn {
  border: none;
  cursor: pointer;
  border-radius: 0.75rem;
  font-family: inherit;
  transition: all 0.15s ease;
}
.nsg-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.nsg-btn--refresh {
  padding: 0.5rem;
  background: transparent;
  color: #71717a;
}
.nsg-btn--refresh:hover:not(:disabled) {
  color: #3f3f46;
  background: #f4f4f5;
}
@media (prefers-color-scheme: dark) {
  .nsg-btn--refresh:hover:not(:disabled) {
    color: #d4d4d8;
    background: #27272a;
  }
}
.nsg-btn--danger {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #e11d48;
  background: #fff1f2;
  border-radius: 0.75rem;
}
.nsg-btn--danger:hover:not(:disabled) {
  background: #ffe4e6;
}
@media (prefers-color-scheme: dark) {
  .nsg-btn--danger {
    color: #fb7185;
    background: rgba(225,29,72,0.15);
  }
  .nsg-btn--danger:hover:not(:disabled) {
    background: rgba(225,29,72,0.25);
  }
}
.nsg-btn--revoke {
  flex-shrink: 0;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: #e11d48;
  background: transparent;
  border: 1px solid transparent;
}
.nsg-btn--revoke:hover:not(:disabled) {
  background: #fff1f2;
  border-color: #fecdd3;
}
@media (prefers-color-scheme: dark) {
  .nsg-btn--revoke {
    color: #fb7185;
  }
  .nsg-btn--revoke:hover:not(:disabled) {
    background: rgba(225,29,72,0.15);
    border-color: rgba(225,29,72,0.3);
  }
}
.nsg-btn__icon { width: 1rem; height: 1rem; }
.nsg-btn__icon-sm { width: 0.875rem; height: 0.875rem; }

/* ── Alert ───────────────────────────────────────────── */
.nsg-alert {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  display: flex;
  align-items: center;
  gap: 0.625rem;
  animation: nsg-fadeIn 0.2s ease;
}
.nsg-alert--success {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}
.nsg-alert--error {
  background: #fff1f2;
  color: #be123c;
  border: 1px solid #fecdd3;
}
@media (prefers-color-scheme: dark) {
  .nsg-alert--success {
    background: rgba(4,120,87,0.15);
    color: #6ee7b7;
    border-color: rgba(4,120,87,0.3);
  }
  .nsg-alert--error {
    background: rgba(225,29,72,0.15);
    color: #fda4af;
    border-color: rgba(225,29,72,0.3);
  }
}
.nsg-alert__icon { width: 1rem; height: 1rem; flex-shrink: 0; }

/* ── Skeleton ────────────────────────────────────────── */
.nsg-skeleton-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 0.5rem;
}
.nsg-skeleton-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1rem;
  border-radius: 0.75rem;
  border: 1px solid #f4f4f5;
  background: #fafafa;
}
@media (prefers-color-scheme: dark) {
  .nsg-skeleton-row {
    border-color: #27272a;
    background: #1c1c1f;
  }
}
.nsg-skeleton-icon {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.75rem;
  background: linear-gradient(90deg, #e4e4e7 25%, #f4f4f5 50%, #e4e4e7 75%);
  background-size: 200% 100%;
  animation: nsg-shimmer 1.5s ease-in-out infinite;
  flex-shrink: 0;
}
@media (prefers-color-scheme: dark) {
  .nsg-skeleton-icon {
    background: linear-gradient(90deg, #27272a 25%, #3f3f46 50%, #27272a 75%);
    background-size: 200% 100%;
  }
}
.nsg-skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.nsg-skeleton-line {
  height: 0.75rem;
  border-radius: 0.375rem;
  background: linear-gradient(90deg, #e4e4e7 25%, #f4f4f5 50%, #e4e4e7 75%);
  background-size: 200% 100%;
  animation: nsg-shimmer 1.5s ease-in-out infinite;
}
@media (prefers-color-scheme: dark) {
  .nsg-skeleton-line {
    background: linear-gradient(90deg, #27272a 25%, #3f3f46 50%, #27272a 75%);
    background-size: 200% 100%;
  }
}
.nsg-skeleton-line--title { width: 60%; }
.nsg-skeleton-line--subtitle { width: 40%; }

/* ── Sessions List ───────────────────────────────────── */
.nsg-sessions {
  margin-top: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.nsg-empty {
  padding: 2rem 0;
  text-align: center;
  color: #a1a1aa;
  font-size: 0.875rem;
}

/* ── Session Row ─────────────────────────────────────── */
.nsg-session {
  border-radius: 0.75rem;
  border: 1px solid rgba(228,228,231,0.8);
  background: rgba(250,250,250,0.7);
  transition: all 0.3s ease;
  overflow: hidden;
  max-height: 300px;
  opacity: 1;
}
.nsg-session--current {
  background: rgba(239,246,255,0.5);
  border-color: rgba(191,219,254,0.7);
}
@media (prefers-color-scheme: dark) {
  .nsg-session {
    border-color: #27272a;
    background: rgba(39,39,42,0.4);
  }
  .nsg-session--current {
    background: rgba(37,99,235,0.08);
    border-color: rgba(37,99,235,0.25);
  }
}
.nsg-session:hover:not(.nsg-session--removing) {
  border-color: #d4d4d8;
}
@media (prefers-color-scheme: dark) {
  .nsg-session:hover:not(.nsg-session--removing) {
    border-color: #3f3f46;
  }
}
.nsg-session--removing {
  max-height: 0;
  opacity: 0;
  padding: 0;
  margin: 0;
  border-width: 0;
  overflow: hidden;
  transition: all 0.3s ease;
}

.nsg-session__main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  cursor: pointer;
  user-select: none;
}
.nsg-session__left {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  min-width: 0;
}
.nsg-session__device-icon {
  padding: 0.625rem;
  border-radius: 0.75rem;
  background: #fff;
  border: 1px solid rgba(228,228,231,0.6);
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}
@media (prefers-color-scheme: dark) {
  .nsg-session__device-icon {
    background: #27272a;
    border-color: #3f3f46;
  }
}
.nsg-icon { width: 1.25rem; height: 1.25rem; display: block; }
.nsg-icon--desktop { color: #3b82f6; }
.nsg-icon--mobile { color: #6366f1; }
.nsg-icon--tablet { color: #06b6d4; }

.nsg-session__info { min-width: 0; }
.nsg-session__title-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.nsg-session__name {
  font-weight: 600;
  font-size: 0.875rem;
}
.nsg-session__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.25rem;
  font-size: 0.75rem;
  color: #71717a;
  flex-wrap: wrap;
}
@media (prefers-color-scheme: dark) {
  .nsg-session__meta { color: #a1a1aa; }
}
.nsg-session__geo { font-weight: 500; }
.nsg-session__ip { display: flex; align-items: center; gap: 0.25rem; }
.nsg-session__sep { color: #d4d4d8; }
@media (prefers-color-scheme: dark) {
  .nsg-session__sep { color: #3f3f46; }
}
.nsg-meta-icon { width: 0.75rem; height: 0.75rem; color: #a1a1aa; }
.nsg-mono { font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace; }
.nsg-capitalize { text-transform: capitalize; }

.nsg-session__right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* ── Badge ───────────────────────────────────────────── */
.nsg-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 500;
}
.nsg-badge--current {
  background: #d1fae5;
  color: #047857;
}
@media (prefers-color-scheme: dark) {
  .nsg-badge--current {
    background: rgba(4,120,87,0.2);
    color: #6ee7b7;
  }
}
.nsg-badge__dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background: #10b981;
  animation: nsg-pulse 2s ease-in-out infinite;
}

/* ── Chevron ─────────────────────────────────────────── */
.nsg-chevron {
  width: 1rem;
  height: 1rem;
  color: #a1a1aa;
  transition: transform 0.2s ease;
  flex-shrink: 0;
}
.nsg-chevron--open {
  transform: rotate(180deg);
}

/* ── Expandable Details ──────────────────────────────── */
.nsg-details {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease, opacity 0.2s ease;
  opacity: 0;
}
.nsg-details--open {
  max-height: 200px;
  opacity: 1;
}
.nsg-details__inner {
  padding: 0 1rem 1rem;
  border-top: 1px solid #f4f4f5;
}
@media (prefers-color-scheme: dark) {
  .nsg-details__inner { border-top-color: #27272a; }
}
.nsg-details__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
  padding-top: 0.75rem;
}
.nsg-details__item {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}
.nsg-details__icon {
  width: 0.875rem;
  height: 0.875rem;
  color: #a1a1aa;
  margin-top: 0.125rem;
  flex-shrink: 0;
}
.nsg-details__label {
  display: block;
  font-size: 0.6875rem;
  color: #a1a1aa;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.nsg-details__value {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  margin-top: 0.125rem;
}

/* ── Animations ──────────────────────────────────────── */
@keyframes nsg-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
@keyframes nsg-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
@keyframes nsg-fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes nsg-spin {
  to { transform: rotate(360deg); }
}
.nsg-spin {
  animation: nsg-spin 1s linear infinite;
}
`;
