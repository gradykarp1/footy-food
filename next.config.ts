import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root. Without this, an unrelated lockfile higher up the
    // filesystem makes Turbopack infer a root outside the project.
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
