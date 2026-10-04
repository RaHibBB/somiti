import { getCurrentMember } from "@/lib/auth/session"
import { formatDateTime, toBn } from "@/lib/format"
import { Letterhead } from "./letterhead"
import { PrintToolbar } from "./print-toolbar"

/**
 * A4 document shell: toolbar (screen only), letterhead, title, generated date, and an
 * authorisation block. When an admin downloads it, their name is printed as the person who
 * issued/certified it; for members and visitors a default "সমিতির পক্ষে" signature block is used.
 */
export async function PrintDoc({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  const viewer = await getCurrentMember()
  const admin = viewer?.role === "admin" ? viewer : null
  const now = formatDateTime(new Date())
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
          <p className="shrink-0 text-right text-[8.5pt] text-gray-600">তৈরি: {now}</p>
        </div>
        {children}

        <div className="mt-10 flex items-end justify-between gap-6 text-[9.5pt]" style={{ breakInside: "avoid" }}>
          <div className="text-gray-700">
            {admin ? (
              <>
                <p>
                  ডাউনলোড ও প্রত্যয়ন করেছেন: <b>{admin.nameBn}</b> (অ্যাডমিন, সদস্য নং {toBn(admin.memberNo)})
                </p>
                <p className="text-[8.5pt]">সময়: {now}</p>
              </>
            ) : (
              <p className="text-[8.5pt]">সমিতির ওয়েবসাইট থেকে তৈরি। প্রত্যয়নের জন্য যেকোনো অ্যাডমিনের স্বাক্ষর নিন।</p>
            )}
          </div>
          <div className="w-48 shrink-0 text-center">
            <div className="mb-1 h-10 border-b border-gray-500" />
            <p>{admin ? `${admin.nameBn} — স্বাক্ষর` : "সমিতির পক্ষে স্বাক্ষর"}</p>
          </div>
        </div>

        <p className="mt-6 border-t pt-2 text-center text-[8.5pt] text-gray-600">
          এই বিবরণী সমিতির ওয়েবসাইট থেকে স্বয়ংক্রিয়ভাবে তৈরি। &quot;বাতিল&quot; চিহ্নিত এন্ট্রি হিসাবে ধরা হয়নি।
        </p>
      </div>
    </>
  )
}
