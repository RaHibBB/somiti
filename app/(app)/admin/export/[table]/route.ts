import { requireAdmin } from "@/lib/auth/session"
import { toCsv } from "@/lib/csv"
import { getDb } from "@/lib/db"
import { todayDhaka } from "@/lib/format"
import { EXPORTS, exportRows, type ExportName } from "../tables"

export async function GET(_req: Request, ctx: RouteContext<"/admin/export/[table]">) {
  await requireAdmin()
  const { table } = await ctx.params
  if (!(table in EXPORTS)) return new Response("Not found", { status: 404 })
  const rows = await exportRows(getDb(), table as ExportName)
  const filename = `samiti-${table}-${todayDhaka()}.csv`
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
