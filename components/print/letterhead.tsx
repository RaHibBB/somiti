"use client"

import { useEffect, useState } from "react"
import { LogoSvg } from "@/lib/logo-art"

/**
 * Printed documents start with the samiti's letterhead. If the samiti adds its own header image
 * at public/letterhead-header.png it is used; until then (and while it loads) a header with the
 * logo and the samiti's name is shown.
 */
export function Letterhead() {
  const [hasImage, setHasImage] = useState(false)

  useEffect(() => {
    const img = new Image()
    img.onload = () => setHasImage(true)
    img.src = "/letterhead-header.png"
  }, [])

  if (hasImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/letterhead-header.png" alt="পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি" className="block w-full" />
    )
  }
  return (
    <div className="flex items-center justify-center gap-4 border-b-2 border-[#1a4059] pb-3">
      <LogoSvg size={64} title="পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি" />
      <div className="text-left">
        <p className="text-[16pt] leading-tight font-bold text-[#1a4059]">পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি</p>
        <p className="text-[9.5pt]">মীরসরাই, চট্টগ্রাম · প্রতিষ্ঠা ২০২৬</p>
      </div>
    </div>
  )
}
