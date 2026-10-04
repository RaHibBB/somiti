import Link from "next/link"

export function AppHeader({ name }: { name?: string }) {
  return (
    <header className="sticky top-0 z-30 bg-brand-header text-white print:hidden">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="min-w-0">
          <p className="truncate text-base font-bold leading-tight">পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি</p>
          <p className="text-xs text-white/70">মীরসরাই, চট্টগ্রাম</p>
        </Link>
        {name ? <span className="shrink-0 truncate text-sm text-white/85">{name}</span> : null}
      </div>
    </header>
  )
}
