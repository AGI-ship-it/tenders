import type { NextConfig } from "next";

// GITHUB_PAGES=true builds a static site for https://<owner>.github.io/tenders/ (see .github/workflows).
// Every screen renders from client-side demo state, so the same app works as a static export.
const isPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  devIndicators: false,
  ...(isPages && {
    output: "export",
    basePath: "/tenders",
    trailingSlash: true,
    images: { unoptimized: true },
  }),
};

export default nextConfig;
