"use client"

import { useEffect, useRef, useState } from "react"

/**
 * Letterhead image from public/letterhead-header.png (supplied by the samiti).
 * Falls back to a text header until the image is added.
 */
export function Letterhead() {
  const [missing, setMissing] = useState(false)
  const img = useRef<HTMLImageElement>(null)

  // The image may fail before hydration, in which case onError never reaches React.
  useEffect(() => {
    const el = img.current
    if (el && el.complete && el.naturalWidth === 0) setMissing(true)
  }, [])

  if (missing) {
    return (
      <div className="border-b-2 border-[#1a4059] pb-2 text-center">
        <p className="text-[15pt] font-bold text-[#1a4059]">পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি</p>
        <p className="text-[9.5pt]">মীরসরাই, চট্টগ্রাম · প্রতিষ্ঠা ২০২৬</p>
      </div>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={img}
      src="/letterhead-header.png"
      alt="পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি"
      className="block w-full"
      onError={() => setMissing(true)}
    />
  )
}
