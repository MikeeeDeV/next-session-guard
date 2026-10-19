# Architecture & Lifecycle 🏗️

This document describes the architectural design, internal request flows, and security state machines of **Next-Session-Guard**.

---

## 🏛️ Layered Component Architecture

```mermaid
graph TB
    subgraph ClientLayer["1. Client Layer (next-session-guard/client)"]
        ActiveSessionsCard["<ActiveSessionsCard />"]
        AdminSecurityPanel["<AdminSecurityPanel />"]
        SSEHook["useSessionGuard() Hook"]
    end

    subgraph EdgeLayer["2. Edge / Middleware Layer"]
        Middleware["Next.js Middleware"]
        L1Cache["In-Memory LRU Cache"]
        L2Cache["Redis / Upstash Blacklist Cache"]
    end

    subgraph ServerLayer["3. Core Server Engine (next-session-guard/server)"]
        SessionManager["SessionManager Engine"]
        GeoParser["Geo & Device Parser (Zero-dependency)"]
        HijackGuard["Hijacking Guard (Kinetic & IP)"]
        GC["Garbage Collector (Pruning Engine)"]
    end

    subgraph StorageLayer["4. Storage Adapters"]
        PrismaAdapter["PrismaAdapter"]
        DrizzleAdapter["DrizzleAdapter"]
        MemoryAdapter["MemoryAdapter"]
    end

    subgraph RealtimeLayer["5. Realtime Mesh (next-session-guard/realtime)"]
        SSEHub["SSEHub"]
        RevocationBridge["createSSERevocationBridge()"]
    end

    subgraph SOCLayer["6. Telegram SOC (next-session-guard/telegram)"]
        TelegramWebhook["Admin Webhook Handler"]
        ActionVault["HMAC-SHA256 Action Vault"]
        AnomalyEngine["Kinetic Anomaly Engine (Mach Speed)"]
    end

    ClientLayer -->|Fetch / Revoke| ServerLayer
    ClientLayer <-->|SSE Stream| RealtimeLayer
    EdgeLayer -->|Token Check| L1Cache
    EdgeLayer -->|Cache Fallback| L2Cache
    ServerLayer --> StorageLayer
    ServerLayer --> RealtimeLayer
    ServerLayer -.->|High Risk Alerts| SOCLayer
    SOCLayer -.->|1-Click Ban Action| ServerLayer
```

---

## 🔄 1. Session Creation Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Browser
    participant API as /api/auth/login
    participant SM as SessionManager
    participant Parser as Device & Geo Parser
    participant DB as Database / ORM
    participant Cache as Cache Layer

    User->>API: POST /api/auth/login (Credentials)
    Note over API: Authenticate user password / MFA
    API->>SM: createSession(userId, request, metadata)
    SM->>Parser: Extract IP, User-Agent, Geo Headers
    Parser-->>SM: { os, browser, device, city, country, lat, long }
    SM->>SM: Generate crypto-safe 32-byte token
    SM->>DB: INSERT into Session table
    DB-->>SM: Saved Session Record
    SM->>Cache: Warm session state (optional)
    SM-->>API: Created Session Object
    API-->>User: Set-Cookie: session_token (HttpOnly, Secure)
```

### Steps Explained:
1. **Header Inspection:** Inspects `x-forwarded-for`, `cf-connecting-ip`, `x-real-ip`, and Geo headers (`x-vercel-ip-country`, `cf-ipcountry`).
2. **Device Detection:** Internal regex engine classifies Android, iOS, Windows, macOS, Linux, and categorizes devices into Desktop, Mobile, Tablet, Bot, or Console.
3. **Cryptographic Entropy:** Tokens are generated using Node's `crypto.randomBytes(32).toString('hex')`.

---

## 🛡️ 2. Validation & Hijacking Defense Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Attacker as Incoming Request
    participant MW as Middleware / Route
    participant Cache as Cache Layer
    participant SM as SessionManager
    participant Realtime as SSEHub
    participant SOC as Telegram SOC

    Attacker->>MW: Request with session_token cookie
    MW->>Cache: Is token in Revocation Blacklist?
    alt Token Blacklisted in Cache (<1ms)
        Cache-->>MW: Blacklisted!
        MW-->>Attacker: 401 Unauthorized (Redirect to /login)
    else Token Not Blacklisted
        MW->>SM: validateSession(token, { request, policy: 'strict' })
        SM->>SM: Compare Request IP / Country with Session Record
        alt Signature Mismatch (Hijacking Detected)
            SM->>SM: Auto-Revoke Compromised Session
            SM->>Cache: Add token to Blacklist
            SM->>Realtime: Broadcast 'session_revoked' event
            SM->>SOC: Send Anomaly Alert (IP mismatch)
            SM-->>MW: { isValid: false, reason: 'hijack_detected' }
            MW-->>Attacker: 401 Unauthorized (Cookie Cleared)
        else Signature Matches
            SM-->>MW: { isValid: true, session }
            MW-->>Attacker: 200 OK (Proceed to Protected Route)
        end
    end
```

---

## ⚡ 3. Real-Time Remote Revocation Lifecycle (SSE)

```mermaid
sequenceDiagram
    autonumber
    actor Victim as Legitimate User (Tab 1)
    actor Admin as Admin / User (Tab 2)
    participant Hub as SSEHub (/api/sessions/sse)
    participant SM as SessionManager
    participant Bridge as SSERevocationBridge

    Victim->>Hub: GET /api/sessions/sse (Open EventSource)
    Hub-->>Victim: Connected: SSE Stream established
    Note over Victim: Active session in open browser tab

    Admin->>SM: revokeSession(sessionId)
    SM->>Bridge: onRevoke(revokedSessionId, userId)
    Bridge->>Hub: broadcast(userId, 'session_revoked', { sessionId })
    Hub-->>Victim: data: {"type":"session_revoked","sessionId":"..."}
    Note over Victim: Victim's browser catches event
    Victim->>Victim: Redirect instantly to /login?revoked=true
```

---

## 🤖 4. Telegram SOC Autonomous Defense Loop

```mermaid
sequenceDiagram
    autonumber
    actor Attacker as Attacker in Foreign Country
    participant SM as SessionManager
    participant SOC as Anomaly Engine
    participant TG as Telegram Admin Group
    actor Admin as Security Admin

    Attacker->>SM: Use stolen session from Tokyo (Previous: New York, 5 min ago)
    SM->>SOC: Calculate Geo-Velocity (Tokyo vs New York, 300s)
    Note over SOC: Velocity = 10,800 km/h (> Mach 8 Impossible Travel)
    SOC->>TG: Urgent Alert with Inline Action Buttons: [🔒 Freeze] [💥 Kill] [✅ Allow]
    Admin->>TG: Clicks [💥 Kill Session]
    TG->>SM: Webhook: Execute Kill (Validates HMAC-SHA256 Token)
    SM->>SM: Terminate Session & Blacklist IP
    SM-->>TG: Session Expunged & IP Blacklisted
```

---

## 🔒 Fail-Safe Principles

1. **Defense in Depth:** The L1/L2 cache protects your database from being flooded during volumetric replay attacks.
2. **Zero Polling:** Revocation takes effect instantly via SSE, preventing stolen tokens from functioning while the victim is unaware.
3. **Strict HMAC Nonces:** Telegram action payloads are cryptographically signed and expire within 5 minutes to prevent replay attacks on SOC actions.
