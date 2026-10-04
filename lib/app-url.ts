import "server-only"
import { headers } from "next/headers"

/** Public site address for links in messages. Never trusts the Host header in production. */
export async function appUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "")
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  const h = await headers()
  return `http://${h.get("host") ?? "localhost:3000"}`
}
