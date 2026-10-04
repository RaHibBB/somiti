// Optimistic route guard: checks the cookie signature only (no DB).
// Reading is public (samiti decision): anyone can see the accounts without logging in.
// Only pages that act as a specific person need a session; every page and server action
// still re-checks the session and role against the DB.
import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token"

const NEEDS_LOGIN = ["/admin", "/me", "/report", "/settings"]

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const needsLogin = NEEDS_LOGIN.some((p) => pathname === p || pathname.startsWith(p + "/"))
  if (!needsLogin) return NextResponse.next()

  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value)
  if (!session) {
    const login = new URL("/login", request.url)
    login.searchParams.set("next", pathname + search)
    return NextResponse.redirect(login)
  }
  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url))
  }
  return NextResponse.next()
}

export const config = {
  // Skip Next internals, static files, app icons/manifest and API routes (cron routes use CRON_SECRET).
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|icon|apple-icon|app-icon/|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)",
  ],
}
