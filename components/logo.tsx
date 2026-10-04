"use client"

import { useEffect, useRef, useState } from "react"

/** The samiti's coin-stack mark, drawn as SVG. Shown until a real logo file is added. */
export function CoinMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} role="img" aria-label="সমিতির লোগো">
      <rect width="64" height="64" rx="14" fill="#1d3f57" />
      {[40, 29, 18].map((y) => (
        <rect key={y} x="14" y={y} width="36" height="12" rx="6" fill="#2e8b3e" stroke="#fff" strokeWidth="2" />
      ))}
    </svg>
  )
}

/**
 * The samiti's logo. Drop the real logo at `public/logo.png` and it appears everywhere
 * (header, login, home); until then the coin mark is shown.
 */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  const [missing, setMissing] = useState(false)
  const img = useRef<HTMLImageElement>(null)

  // The image can fail before hydration, in which case onError never reaches React.
  useEffect(() => {
    const el = img.current
    if (el && el.complete && el.naturalWidth === 0) setMissing(true)
  }, [])

  if (missing) return <CoinMark size={size} className={className} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={img}
      src="/logo.png"
      alt="পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
      onError={() => setMissing(true)}
    />
  )
}
