import { LogoSvg } from "@/lib/logo-art"

/**
 * The samiti's logo (coins with a sprout in a navy badge). Drawn inline, so it is instant, needs
 * no image request and never shows a broken-image icon. Files for sharing: public/logo.svg and
 * public/logo.png (see scripts/build-logo.tsx).
 */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span className={className} style={{ display: "inline-flex", width: size, height: size }}>
      <LogoSvg size={size} title="পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি" />
    </span>
  )
}
