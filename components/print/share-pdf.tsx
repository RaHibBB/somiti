"use client"

import { useEffect, useRef, useState } from "react"
import { FileDown, Loader2, Printer, Share2 } from "lucide-react"
import { fromBn } from "@/lib/format"

export type ShareInfo = {
  /** Without ".pdf". */
  fileName: string
  /** Short message sent along with the file. */
  text: string
}

function safeName(name: string) {
  return name.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "রসিদ"
}

/**
 * Turns the document on screen (.print-doc) into a one-page PDF on the phone itself — no
 * server, no print dialog. Done in the background as soon as the page opens, so that the
 * "WhatsApp-এ পাঠান" tap can open the phone's share sheet at once (browsers only allow sharing
 * right after a tap). The libraries are loaded only on pages that use this.
 */
async function buildPdf(fileName: string): Promise<File> {
  const source = document.querySelector<HTMLElement>(".print-doc")
  if (!source) throw new Error("no document")
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")])
  await document.fonts.ready
  // An A4-wide copy off screen, so the PDF looks the same on any phone.
  const holder = document.createElement("div")
  holder.className = "pdf-capture"
  holder.setAttribute("aria-hidden", "true")
  holder.appendChild(source.cloneNode(true))
  document.body.appendChild(holder)
  try {
    const doc = holder.firstElementChild as HTMLElement
    const canvas = await toCanvas(doc, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true })
    const widthMm = 210
    const heightMm = Math.max(120, (canvas.height * widthMm) / canvas.width)
    const pdf = new jsPDF({ unit: "mm", format: [widthMm, heightMm], orientation: heightMm >= widthMm ? "portrait" : "landscape", compress: true })
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.9), "JPEG", 0, 0, widthMm, (canvas.height * widthMm) / canvas.width)
    return new File([pdf.output("blob")], `${safeName(fileName)}.pdf`, { type: "application/pdf" })
  } finally {
    holder.remove()
  }
}

function download(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement("a")
  a.href = url
  a.download = file.name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function SharePdfButtons({ share }: { share: ShareInfo }) {
  const [file, setFile] = useState<File | null>(null)
  const [failed, setFailed] = useState(false)
  const [note, setNote] = useState<string>()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    buildPdf(share.fileName)
      .then(setFile)
      .catch(() => setFailed(true))
  }, [share.fileName])

  const canShareFiles = typeof navigator !== "undefined" && !!file && !!navigator.canShare?.({ files: [file] })

  async function onShare() {
    if (!file) return
    setNote(undefined)
    if (canShareFiles) {
      try {
        await navigator.share({ files: [file], title: file.name, text: fromBn(share.text) })
      } catch (err) {
        if ((err as Error).name !== "AbortError") setNote("শেয়ার করা যায়নি। নিচের \"PDF ডাউনলোড\" দিয়ে নামিয়ে WhatsApp-এ সংযুক্ত করুন।")
      }
    } else {
      download(file)
      setNote("এই ব্রাউজার থেকে সরাসরি শেয়ার হয় না — PDF নামানো হয়েছে, WhatsApp-এ 📎 চেপে সংযুক্ত করুন।")
    }
  }

  if (failed) {
    // Rare (very old browser): fall back to the browser's own "Save as PDF".
    return (
      <button type="button" onClick={() => window.print()} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-navy text-lg font-semibold text-white">
        <Printer className="size-5" /> PDF (প্রিন্ট থেকে)
      </button>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-2">
      <button
        type="button"
        onClick={onShare}
        disabled={!file}
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-2 text-base font-semibold text-white disabled:opacity-70"
      >
        {file ? <Share2 className="size-5" /> : <Loader2 className="size-5 animate-spin" />}
        {file ? "রসিদ PDF WhatsApp-এ পাঠান" : "PDF তৈরি হচ্ছে…"}
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => file && download(file)} disabled={!file} className="flex h-11 items-center justify-center gap-1 rounded-xl border text-sm whitespace-nowrap disabled:opacity-60">
          <FileDown className="size-4" /> ডাউনলোড
        </button>
        <button type="button" onClick={() => window.print()} className="flex h-11 items-center justify-center gap-1 rounded-xl border text-sm whitespace-nowrap">
          <Printer className="size-4" /> প্রিন্ট
        </button>
      </div>
      {note ? <p className="text-center text-sm text-amber-800">{note}</p> : null}
    </div>
  )
}
