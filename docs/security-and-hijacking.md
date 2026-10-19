# Security & Session Hijacking Defense 🛡️

Session Hijacking (or Cookie Theft) remains one of the top attack vectors according to OWASP Top 10. Attackers exploit InfoStealers, XSS vulnerabilities, compromised local networks, or leaking proxy logs to steal valid session cookies and impersonate users without needing their passwords or 2FA credentials.

**Next-Session-Guard** implements a multi-layered cryptographic and behavioral defense matrix to detect, isolate, and neutralize compromised session tokens.

---

## 🎯 Threat Model & Mitigations

| Threat | Attack Scenario | Next-Session-Guard Defense |
| :--- | :--- | :--- |
| **Infostealer Malware** | Attacker extracts cookies from user's Chrome/Edge profile and uses them on a remote VPS. | **Strict IP Binding & Device Fingerprint Mismatch:** The token is immediately blocked because the remote IP and OS do not match the stored session. |
| **Token Replay Attack** | Leaked session token reused across multiple networks. | **Sliding Token Auto-Rotation:** Old tokens are single-use or rotated every 24h, blacklisting previous tokens at the Edge. |
| **Impossible Travel (Kinetic Anomaly)** | Legitimate login from Paris; 10 minutes later, the same token makes a request from Singapore. | **Kinetic Velocity Engine:** Calculates physical travel speed. Speeds exceeding commercial flight velocity (> 900 km/h) trigger immediate revocation. |
| **Mobile Carrier IP Hopping** | Mobile users hopping between cell towers and dynamic IPv6 addresses. | **Relaxed Hijacking Policy:** Matches country code and device signature rather than exact IP, avoiding false positives. |

---

## 📐 Kinetic Impossible Travel (Haversine Formula)

The kinetic anomaly engine calculates the geographic distance between two successive requests using the **Haversine Great-Circle Formula**:

$$d = 2R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$

Where:
- $R$ = Earth's radius ($6,371\text{ km}$)
- $\phi_1, \phi_2$ = Latitudes of Request 1 and Request 2
- $\Delta\lambda$ = Longitude difference

The travel velocity is then computed as:

$$V = \frac{d}{\Delta t}$$

```mermaid
graph TD
    Req1["Request 1 (New York, 12:00 PM)"] --> Compare{"Calculate Velocity: Δd / Δt"}
    Req2["Request 2 (London, 12:15 PM)"] --> Compare
    Compare --> Check{"Velocity > 900 km/h?"}
    Check -->|Yes: 22,000 km/h (Mach 18)| Anomaly["🚨 CRITICAL ALERT: Impossible Travel Detected!"]
    Anomaly --> AutoBan["Action: Auto-Revoke Session & Send Telegram Alert"]
    Check -->|No: < 800 km/h| Valid["✅ Normal Velocity (Legitimate User)"]
```

---

## 🛡️ Hijacking Policies

You can configure the hijacking sensitivity per route or globally:

```typescript
const validation = await sessionManager.validateSession(token, {
  request: req,
  hijackingPolicy: "strict" // "strict" | "relaxed" | "none"
});
```

### 1. `strict` Policy (Recommended for Banking, FinTech & Admin Portals)
- Enforces an exact IP address match.
- Enforces OS and browser family consistency.
- Any change in client IP immediately revokes the session and clears cookies.

### 2. `relaxed` Policy (Recommended for Consumer SaaS & Mobile Web Apps)
- Allows IP changes within the same city or country.
- Tolerates cellular CGNAT IP hopping.
- Flags and revokes only when the country changes or kinetic velocity exceeds Mach 1.

### 3. `none` Policy (For local testing only)
- Disables location verification; validates token expiration only.

---

## 🔄 Sliding Token Auto-Rotation

Even if an attacker intercepts a token, its window of vulnerability is strictly bounded by **Token Auto-Rotation**:

```typescript
export const sessionManager = new SessionManager(adapter, {
  autoRotateDays: 1, // Rotates the token every 24 hours of active use
  defaultExpirationDays: 30
});
```

### How Auto-Rotation Works:
1. When a user sends a request with an existing token that is older than `autoRotateDays`, the server generates a new 32-byte cryptographic token.
2. The old token is immediately registered in the **Edge Blacklist Cache**.
3. A new `Set-Cookie` header is sent back with the updated token.
4. Any subsequent attempt to use the stolen old token results in an immediate `401 Unauthorized`.
