import { LOGO_COLORS, LogoSvg } from "@/lib/logo-art"

// The install / tab icon: the logo centred on a navy tile (phones crop icons to rounded squares
// or circles, so the badge sits inside a safe margin).
export function AppIconArt({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: LOGO_COLORS.navy,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <LogoSvg size={Math.round(size * 0.84)} />
    </div>
  )
}
