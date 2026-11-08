import { desc, eq } from "drizzle-orm"
import { PageTitle } from "@/components/layout/page-title"
import { requireAdmin } from "@/lib/auth/session"
import { getDb } from "@/lib/db"
import { proposals } from "@/lib/db/schema"
import { todayDhaka } from "@/lib/format"
import { NewProjectForm } from "./project-form"

export const metadata = { title: "নতুন প্রকল্প — সমিতি" }

export default async function NewProjectPage({ searchParams }: PageProps<"/admin/projects/new">) {
  await requireAdmin()
  const wanted = Number((await searchParams).proposal)
  const passed = await getDb()
    .select({ id: proposals.id, title: proposals.title, amount: proposals.amount })
    .from(proposals)
    .where(eq(proposals.status, "passed"))
    .orderBy(desc(proposals.closedAt))
  return (
    <>
      <PageTitle>নতুন প্রকল্প</PageTitle>
      <p className="mb-4 text-sm text-muted-foreground">
        প্রকল্প খোলার পর তার পাতা থেকে কেনা, খরচ আর বিক্রি লিখবেন। সব টাকা এই প্রকল্পের আলাদা হিসাবে থাকবে।
      </p>
      <NewProjectForm today={todayDhaka()} proposals={passed} initialProposalId={passed.some((p) => p.id === wanted) ? wanted : null} />
    </>
  )
}
