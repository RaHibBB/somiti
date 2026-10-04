/** An error whose message is safe (and meant) to show the user, in Bengali. */
export class UserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UserError"
  }
}

/** Postgres unique-violation, optionally on a given constraint name. */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const e = ((err as { cause?: unknown })?.cause ?? err) as { code?: string; constraint?: string; message?: string }
  if (e?.code !== "23505") return false
  if (!constraint) return true
  return e.constraint === constraint || (e.message ?? "").includes(constraint)
}
