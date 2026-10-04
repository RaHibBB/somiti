// Optimistic route guard: checks the cookie signature only (no DB).
// Every page and server action re-checks the session and role against the DB.
import { NextResponse, type NextRequest } from "next/server"
import { SESSION_COOKIE, verifySession } from "@/lib/auth/token"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value)

  // Public pages. /login itself decides (with a DB check) whether you're already signed in:
  // a cookie can have a valid signature but be revoked (session_version bumped by a password
  // reset, role change or cancellation), and redirecting here on the signature alone loops forever.
  if (pathname === "/login" || pathname === "/forgot-password" || pathname === "/reset-password") {
    return NextResponse.next()
  }
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url))
  }
  return NextResponse.next()
}

export const config = {
  // Skip Next internals, static files, app icons/manifest (needed before login, for "Add to home screen")
  // and API routes (cron routes use CRON_SECRET).
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|icon|apple-icon|app-icon/|manifest.webmanifest|.*\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)",
  ],
}
