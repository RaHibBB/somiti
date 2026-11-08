import type { Metadata, Viewport } from "next"
import { Noto_Sans_Bengali } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const bengali = Noto_Sans_Bengali({
  variable: "--font-bengali",
  subsets: ["bengali", "latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি",
  description: "সমিতির হিসাব — মীরসরাই, চট্টগ্রাম",
  // Public to anyone with the link, but kept out of search results.
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d3f57",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="bn" className={`${bengali.variable} h-full antialiased`}>
      <body className="min-h-full bg-muted">
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  )
}
