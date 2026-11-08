import type { NextConfig } from "next"

// ImageResponse (next/og) needs these at runtime, but only in the three icon routes.
const OG_FILES = "./node_modules/.pnpm/next@*/node_modules/next/dist/compiled/@vercel/og/**"

const nextConfig: NextConfig = {
  // PGlite is only used for local development (DATABASE_URL=pglite:…); keep it out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  // /rules reads content/rules.md at request time; make sure it ships with the function.
  outputFileTracingIncludes: {
    "/rules": ["./content/**"],
    "/icon": [OG_FILES],
    "/apple-icon": [OG_FILES],
    "/app-icon/*": [OG_FILES],
  },
  // Dev-only / icon-only packages were being traced into every page's server function
  // (~18 MB of PGlite WASM alone), which made cold starts slow. Keep them out everywhere;
  // the icon routes get @vercel/og back via their own include.
  outputFileTracingExcludes: {
    "*": ["**/@electric-sql/pglite/**", "**/next/dist/compiled/@vercel/og/**"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
}

export default nextConfig
