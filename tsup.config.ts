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
]);
