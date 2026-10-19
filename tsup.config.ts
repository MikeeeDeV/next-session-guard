import { defineConfig, Options } from "tsup";
import { writeFileSync, readFileSync } from "fs";
import { join } from "path";

function prependDirective(files: string[], directive: string) {
  for (const file of files) {
    const filePath = join("dist", file);
    try {
      const content = readFileSync(filePath, "utf-8");
      if (!content.startsWith(directive)) {
        writeFileSync(filePath, `${directive}\n${content}`);
      }
    } catch {
      // File might not exist yet
    }
  }
}

const sharedConfig: Partial<Options> = {
  splitting: false,
  sourcemap: true,
  treeshake: true,
  outDir: "dist",
};

export default defineConfig([
  // ── Main entry (core + components + api + middleware) ────
  {
    ...sharedConfig,
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    external: [
      "react",
      "react-dom",
      "next",
      "@prisma/client",
      "lucide-react",
    ],
    onSuccess: async () => {
      prependDirective(["index.mjs", "index.js"], '"use client";');
    },
  },

  // ── Server-only entry (zero React hooks, safe for API routes & RSC) ──
  {
    ...sharedConfig,
    entry: { server: "src/server.ts" },
    format: ["esm", "cjs"],
    dts: true,
    external: [
      "next",
      "@prisma/client",
    ],
  },

  // ── Client-only components entry ('use client' banner) ──
  {
    ...sharedConfig,
    entry: { client: "src/client.ts" },
    format: ["esm", "cjs"],
    dts: true,
    external: [
      "react",
      "react-dom",
      "next",
      "lucide-react",
    ],
    onSuccess: async () => {
      prependDirective(["client.mjs", "client.js"], '"use client";');
    },
  },

  // ── Server Actions entry ────────────────────────────────
  {
    ...sharedConfig,
    entry: { actions: "src/actions/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    external: [
      "react",
      "react-dom",
      "next",
      "@prisma/client",
    ],
    onSuccess: async () => {
      prependDirective(["actions.mjs", "actions.js"], '"use server";');
    },
  },

  // ── Cache Adapters entry ────────────────────────────────
  {
    ...sharedConfig,
    entry: { cache: "src/cache/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    external: [],
  },

  // ── Telegram Admin SOC Guard entry ──────────────────────
  {
    ...sharedConfig,
    entry: { telegram: "src/telegram/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    external: [
      "react",
      "react-dom",
      "next",
      "@prisma/client",
    ],
  },

  // ── Realtime SSE entry ─────────────────────────────────
  {
    ...sharedConfig,
    entry: { realtime: "src/realtime/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    external: [],
  },
]);

