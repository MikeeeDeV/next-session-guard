"use client";

import React from "react";
import { AdminSecurityPanel } from "next-session-guard";

export default function AdminPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <AdminSecurityPanel
        title="Admin Security Operations Center (SOC)"
        locale="en"
        sseEndpoint="/api/sessions/sse"
        apiEndpoints={{
          getSessions: "/api/sessions",
          revokeSession: "/api/sessions",
          cleanup: "/api/admin/cleanup",
        }}
      />
    </div>
  );
}
