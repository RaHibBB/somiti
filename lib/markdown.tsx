// Minimal Markdown → React for the static constitution text (headings, lists,
// paragraphs, **bold**, horizontal rules). No HTML passthrough, so nothing to sanitise.
import { Fragment, type ReactNode } from "react"

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  )
}

export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = []
  const lines = source.replace(/\r\n/g, "\n").split("\n")
  let i = 0
  let key = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length
      const cls = level === 1 ? "text-2xl font-bold text-brand-navy mt-2" : level === 2 ? "text-xl font-semibold text-brand-navy mt-6" : "text-lg font-semibold mt-4"
      const Tag = (`h${level + 1}`) as "h2" | "h3" | "h4"
      blocks.push(<Tag key={key++} className={cls}>{inline(h[2])}</Tag>)
      i++
      continue
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) {
      blocks.push(<hr key={key++} className="my-4" />)
      i++
      continue
    }
    const ordered = /^\s*(\d+|[০-৯]+)[.)]\s+/.test(line)
    if (ordered || /^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      const re = ordered ? /^\s*(\d+|[০-৯]+)[.)]\s+(.*)$/ : /^\s*[-*]\s+(.*)$/
      while (i < lines.length && re.test(lines[i])) {
        const m = re.exec(lines[i])!
        items.push(m[m.length - 1])
        i++
      }
      const List = ordered ? "ol" : "ul"
      blocks.push(
        <List key={key++} className={ordered ? "list-decimal space-y-1 pl-6" : "list-disc space-y-1 pl-6"}>
          {items.map((it, j) => (
            <li key={j}>{inline(it)}</li>
          ))}
        </List>,
      )
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\s*[-*]\s|\s*(\d+|[০-৯]+)[.)]\s)/.test(lines[i])) {
      para.push(lines[i].trim())
      i++
    }
    blocks.push(<p key={key++}>{inline(para.join(" "))}</p>)
  }
  return <div className="space-y-3 text-base leading-relaxed">{blocks}</div>
}
