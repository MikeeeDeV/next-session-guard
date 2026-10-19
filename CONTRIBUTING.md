# Contributing to Next-Session-Guard 🛡️

Thank you for your interest in contributing to **Next-Session-Guard**! We welcome all contributions, including bug reports, feature requests, documentation improvements, database adapters, and pull requests.

Please read this guide before contributing to ensure a smooth and productive workflow.

---

## 📋 Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all contributors with respect, empathy, and constructive feedback.

---

## 🛠️ Getting Started

### Prerequisites

- **Node.js**: `18.17.0` or higher (`20+` recommended)
- **Package Manager**: `npm` (or `pnpm` / `yarn`)
- **Git**

### Local Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/MikeeeDeV/next-session-guard.git
   cd next-session-guard
   ```

2. **Install root dependencies:**
   ```bash
   npm install
   ```

3. **Build the packages:**
   ```bash
   npm run build
   ```

4. **Run the automated test suite:**
   ```bash
   npm test
   ```

---

## 🧪 Testing Guidelines

Next-Session-Guard takes security and reliability extremely seriously. All core logic must be thoroughly tested:

```bash
# Run all unit and integration tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Generate code coverage report
npm run coverage

# Validate TypeScript types across all subpaths
npm run typecheck
```

- When adding a new feature or fixing a bug, **always include tests** in the `tests/` directory.
- Ensure all 215+ tests pass with zero regressions before submitting a pull request.

---

## 🧩 Architecture & Subpath Rules

Next-Session-Guard uses an explicit multi-subpath architecture configured via `tsup.config.ts` and `package.json`:

1. **`next-session-guard/server`**: Server-only engine. Must **never** import React hooks (`useState`, `useEffect`) or client components.
2. **`next-session-guard/client`**: Client-only components (`<ActiveSessionsCard />`, `<AdminSecurityPanel />`). Must include the `"use client"` directive.
3. **`next-session-guard/cache`**: Zero-dependency / edge-compatible token blacklist adapters (`MemoryAdapter`, `Upstash`, `Redis`).
4. **`next-session-guard/realtime`**: Server-Sent Events (SSE) hub and live browser revocation bridge.
5. **`next-session-guard/telegram`**: 100% opt-in Telegram Admin SOC suite.
6. **`next-session-guard/actions`**: Next.js Server Actions.

---

## 🎮 Testing with the Playground

We maintain a ready-to-run interactive demo in `examples/playground`:

```bash
cd examples/playground
npm install
npm run dev
```

Visit `http://localhost:3000` to test your changes visually and test real-time SSE live kicks.

---

## 🔀 Submitting a Pull Request

1. **Create a branch:**
   ```bash
   git checkout -b feat/my-new-feature
   # or
   git checkout -b fix/issue-description
   ```

2. **Commit your changes:**
   Use clear, conventional commit messages:
   - `feat: add Supabase database adapter`
   - `fix: resolve race condition in token rotation`
   - `docs: improve SSE live kick guide`
   - `test: add edge cases for impossible travel math`

3. **Verify quality gates:**
   ```bash
   npm run build
   npm run typecheck
   npm test
   ```

4. **Push and open a PR:**
   Push your branch to your fork and submit a PR against the `main` branch. Fill out our [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md).

---

## 🐛 Reporting Bugs

If you find a bug:
1. Check existing [GitHub Issues](https://github.com/MikeeeDeV/next-session-guard/issues) to avoid duplicates.
2. Open a new issue using our **Bug Report** template.
3. Include your Next.js version, ORM (Prisma/Drizzle/Memory), and a minimal reproducible example.

---

## 🔒 Security Vulnerabilities

**Do NOT report security vulnerabilities in public GitHub issues.**  
Please follow our responsible disclosure policy outlined in [SECURITY.md](SECURITY.md) or email **alsghyrblhh@gmail.com**.

---

Thank you for helping make Next-Session-Guard the gold standard for session security in Next.js! 🛡️
