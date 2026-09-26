// Core Engine
export { SessionManager } from "./core/session-manager";
export {
  extractClientIp,
  extractGeoInfo,
  parseClientInfo,
  getClientMetadata,
  countryCodeToFlag,
} from "./core/ua-parser";
export * from "./core/types";

// UI Components
export { ActiveSessionsCard } from "./components/ActiveSessionsCard";
export type { ActiveSessionsCardProps, ServerActionsConfig } from "./components/ActiveSessionsCard";
export { AdminSecurityPanel } from "./components/AdminSecurityPanel";
export type { AdminSecurityPanelProps } from "./components/AdminSecurityPanel";

// Database Adapters (Prisma, Drizzle, Memory)
export {
  createPrismaAdapter,
  createMemoryAdapter,
  createDrizzleAdapter,
} from "./core/adapters";
export type { DatabaseAdapter } from "./core/adapters";

// App Router API Route Helpers
export { createSessionsRouteHandlers } from "./api/route-sessions";
export { createRevokeOthersHandler } from "./api/route-revoke-others";

// Middleware
export { sessionGuardMiddleware } from "./middleware/session-guard";
export type { SessionGuardOptions } from "./middleware/session-guard";

