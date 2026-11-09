"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft, FileDown } from "lucide-react"
import { SharePdfButtons, type ShareInfo } from "./share-pdf"

export function PrintToolbar({ share }: { share?: ShareInfo }) {
  const router = useRouter()
  return (
    <div className="no-print sticky top-0 z-10 mb-4 border-b bg-white px-4 py-3">
      <div className="mx-auto flex max-w-[210mm] items-center gap-2">
        <button
          type="button"
          onClick={() => (history.length > 1 ? router.back() : router.push("/"))}
          aria-label="ফিরে যান"
          className={share ? "flex size-12 shrink-0 items-center justify-center self-start rounded-xl border" : "flex h-12 items-center gap-1 rounded-xl border px-3 text-base"}
        >
          <ArrowLeft className="size-5" /> {share ? null : "ফিরে যান"}
        </button>
        {share ? (
          <SharePdfButtons share={share} />
        ) : (
          <button
            type="button"
            onClick={() => window.print()}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-navy text-lg font-semibold text-white"
          >
            <FileDown className="size-5" /> PDF ডাউনলোড
          </button>
        )}
      </div>
      {share ? null : (
        <p className="mx-auto mt-2 max-w-[210mm] text-center text-sm text-muted-foreground">
          মোবাইলে: প্রিন্ট পাতায় প্রিন্টার হিসেবে &quot;Save as PDF&quot; বাছাই করে ডাউনলোড চাপুন।
        </p>
      )}
    </div>
  )
}
