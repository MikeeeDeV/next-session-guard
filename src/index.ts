// Core Engine
export { SessionManager } from "./core/session-manager";
export {
  extractClientIp,
  parseClientInfo,
  getClientMetadata,
} from "./core/ua-parser";
export * from "./core/types";

// UI Components
export { ActiveSessionsCard } from "./components/ActiveSessionsCard";
export type { ActiveSessionsCardProps } from "./components/ActiveSessionsCard";

// App Router API Route Helpers
export { createSessionsRouteHandlers } from "./api/route-sessions";
export { createRevokeOthersHandler } from "./api/route-revoke-others";

// Middleware
export { sessionGuardMiddleware } from "./middleware/session-guard";
export type { SessionGuardOptions } from "./middleware/session-guard";

