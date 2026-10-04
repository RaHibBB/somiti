import { Logo } from "@/components/logo"

/** Navy header + white card used by login, forgot-password and reset-password. */
export function AuthShell({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col">
      <div className="bg-brand-header px-4 pt-10 pb-8 text-center text-white">
        <div className="mx-auto mb-3 w-fit rounded-2xl bg-white/95 p-1.5 shadow-md">
          <Logo size={56} />
        </div>
        <p className="text-xl leading-snug font-bold">পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি</p>
        <p className="mt-1 text-sm text-white/75">মীরসরাই, চট্টগ্রাম</p>
      </div>
      <div className="mx-auto -mt-4 w-full max-w-sm flex-1 px-4 pb-10">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          {title ? <h1 className="mb-4 text-lg font-semibold text-brand-navy">{title}</h1> : null}
          {children}
        </div>
      </div>
    </main>
  )
}
