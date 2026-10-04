export function PageTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h1 className="text-xl font-bold text-brand-navy lg:text-2xl">{children}</h1>
      {action}
    </div>
  )
}
