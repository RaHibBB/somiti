import { ImageResponse } from "next/og"
import { AppIconArt } from "@/lib/app-icon"

// PNG icons for the web app manifest (Android "Add to home screen" needs 192 and 512).
const SIZES = new Set([192, 512])

export async function GET(_req: Request, ctx: RouteContext<"/app-icon/[size]">) {
  const size = Number((await ctx.params).size)
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 })
  return new ImageResponse(<AppIconArt size={size} />, {
    width: size,
    height: size,
    headers: { "Cache-Control": "public, max-age=86400" },
  })
}
