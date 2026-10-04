/** Where to go after login: only same-site paths (blocks "//evil.com" and full URLs). */
export function safeNext(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/"
  if (value.startsWith("/login")) return "/"
  return value.slice(0, 300)
}
