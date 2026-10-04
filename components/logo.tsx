"use client"

import { useEffect, useState } from "react"

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

const LOGO_SRC = "/logo.png"
let probe: Promise<boolean> | null = null

/** Does public/logo.png exist? Checked once per page load, by actually loading the image. */
function logoExists(): Promise<boolean> {
  probe ??= new Promise<boolean>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = LOGO_SRC
  })
  return probe
}

/**
 * The samiti's logo. Drop the real logo at `public/logo.png` and it appears everywhere
 * (header, sidebar, login, home). The coin mark is shown first and until then, so there is
 * never a broken-image icon while the page loads.
 */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    let alive = true
    void logoExists().then((ok) => {
      if (alive) setAvailable(ok)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!available) return <CoinMark size={size} className={className} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={LOGO_SRC}
      alt="পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
    />
  )
}
