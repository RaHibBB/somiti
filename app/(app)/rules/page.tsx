import { readFile } from "node:fs/promises"
import path from "node:path"
import { PageTitle } from "@/components/layout/page-title"
import { requireMember } from "@/lib/auth/session"
import { Markdown } from "@/lib/markdown"

export const metadata = { title: "নিয়মাবলি — সমিতি" }

export default async function RulesPage() {
  await requireMember()
  const source = await readFile(path.join(process.cwd(), "content", "rules.md"), "utf8")
  // The first "# " heading in the file becomes the page title.
  const [, title = "সমিতির নিয়মাবলি"] = /^#\s+(.*)$/m.exec(source) ?? []
  const body = source.replace(/^#\s+.*$/m, "").replace(/^>\s?/gm, "")
  return (
    <>
      <PageTitle>{title}</PageTitle>
      <article className="rounded-xl border bg-white p-4">
        <Markdown source={body} />
      </article>
    </>
  )
}
