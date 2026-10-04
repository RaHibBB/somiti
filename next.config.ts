import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // PGlite is only used for local development (DATABASE_URL=pglite:…); keep it out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
  // /rules reads content/rules.md at request time; make sure it ships with the function.
  outputFileTracingIncludes: {
    "/rules": ["./content/**"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
}

export default nextConfig
