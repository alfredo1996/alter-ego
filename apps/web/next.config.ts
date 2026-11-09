import { join } from "node:path"

import { createMDX } from "fumadocs-mdx/next";

import { securityHeaders } from "./src/lib/csp";

import type { NextConfig } from "next";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  // Next 16.4 writes an AGENTS.md into the repo root on every `next dev`; it is not ours to commit.
  agentRules: false,
  poweredByHeader: false,
  // The workspace packages ship TypeScript source.
  transpilePackages: ["@alter-ego/kernel", "@alter-ego/ui"],
  turbopack: {
    root: join(__dirname, "../.."),
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders(process.env.NODE_ENV !== "production"),
      },
    ];
  },
};

export default withMDX(nextConfig);
