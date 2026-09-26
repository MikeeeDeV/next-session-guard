# 🎮 Next-Session-Guard Live Playground & SOC Dashboard

This is a complete, self-contained Next.js demo application demonstrating all features of `next-session-guard` in action:

1. **User Active Sessions (`/`)**: View active devices, geo-location badges, and test live browser revocation.
2. **Admin SOC Panel (`/admin`)**:
   - Live SSE connection indicator.
   - Interactive Session Inspector with remote live kick.
   - **Full GUI Configuration**:
     - Session Hijacking Protection (Strict / Relaxed / Disabled)
     - Token Auto-Rotation intervals
     - Scheduled Database Garbage Collection (Monthly, Semi-Annual, Annual, Manual)
     - Telegram Admin SOC Guard controls
   - **Attack & Defense Simulation Lab**:
     - Simulate IP Session Hijacking Attack
     - Simulate Kinetic Travel Anomaly (Mach velocity calculation)
     - Test Instant Realtime SSE Kick
     - Test Token Auto-Rotation

## 🚀 How to Run

1. Build the library from root (if not already built):
   ```bash
   cd ../..
   npm run build
   ```

2. Start the playground dev server:
   ```bash
   cd examples/playground
   npm run dev
   ```

3. Open your browser:
   - **User Sessions & SSE Listener**: [http://localhost:3000](http://localhost:3000)
   - **Admin SOC Panel & Simulator**: [http://localhost:3000/admin](http://localhost:3000/admin)
