import "./print.css"

export default function PrintLayout({ children }: LayoutProps<"/print">) {
  return <div className="min-h-dvh bg-white">{children}</div>
}
