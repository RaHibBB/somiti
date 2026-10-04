import { formatDateTime } from "@/lib/format"
import { Letterhead } from "./letterhead"
import { PrintToolbar } from "./print-toolbar"

/** A4 document shell: toolbar (screen only), letterhead, title, generated date. */
export function PrintDoc({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <>
      <PrintToolbar />
      <div className="print-doc">
        <Letterhead />
        <div className="mt-3 mb-3 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[14pt] font-bold">{title}</h1>
            {subtitle ? <p className="text-[10pt]">{subtitle}</p> : null}
          </div>
          <p className="shrink-0 text-right text-[8.5pt] text-gray-600">তৈরি: {formatDateTime(new Date())}</p>
        </div>
        {children}
        <p className="mt-6 border-t pt-2 text-center text-[8.5pt] text-gray-600">
          এই বিবরণী সমিতির ওয়েবসাইট থেকে স্বয়ংক্রিয়ভাবে তৈরি। &quot;বাতিল&quot; চিহ্নিত এন্ট্রি হিসাবে ধরা হয়নি।
        </p>
      </div>
    </>
  )
}
