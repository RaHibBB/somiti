// The samiti's logo, drawn once as plain SVG shapes (flat colours, no fonts, no gradients) so the
// same drawing works in the page, in the generated app icons, and in the exported PNG/SVG files
// (scripts/build-logo.tsx).
//
// Idea: savings that grow together — a stack of three coins with a sprout rising from it, inside
// a navy badge with a gold ring (eight beads = eight-pointed star = many members, one samiti).

export const LOGO_COLORS = {
  navy: "#1d3f57",
  navyDeep: "#14303f",
  gold: "#f0c24b",
  coin: "#2e8b3e",
  coinDark: "#23702f",
  coinTop: "#52b563",
  leaf: "#6fcf7f",
  white: "#ffffff",
} as const

const C = LOGO_COLORS

// Eight beads on the ring (every 45°, radius 116 around the centre 128,128).
const BEADS = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
  const a = (deg * Math.PI) / 180
  return { x: +(128 + 116 * Math.cos(a)).toFixed(2), y: +(128 + 116 * Math.sin(a)).toFixed(2) }
})

// One coin = a cylinder side (front curve at the bottom) at top-ellipse height `y`.
const coinSide = (y: number) => `M78 ${y} v14 a50 13 0 0 0 100 0 v-14 a50 13 0 0 0 -100 0 Z`

/** The logo as an SVG element (scales to any size). */
export function LogoSvg({ size = 64, title = "সমিতির লোগো" }: { size?: number; title?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 256 256" role="img" aria-label={title}>
      {/* badge */}
      <circle cx="128" cy="128" r="126" fill={C.navy} />
      <circle cx="128" cy="128" r="116" fill="none" stroke={C.gold} strokeWidth="4" />
      <circle cx="128" cy="128" r="106" fill={C.navyDeep} />
      {/* eight-pointed star, faint */}
      <g fill="none" stroke={C.white} strokeOpacity="0.1" strokeWidth="2">
        <rect x="58" y="58" width="140" height="140" />
        <rect x="58" y="58" width="140" height="140" transform="rotate(45 128 128)" />
      </g>
      {/* eight beads = members */}
      {BEADS.map((b) => (
        <circle key={`${b.x}-${b.y}`} cx={b.x} cy={b.y} r="5.5" fill={C.gold} />
      ))}
      {/* coins, bottom to top */}
      {[178, 164, 150].map((y) => (
        <path key={y} d={coinSide(y)} fill={y === 150 ? C.coin : C.coinDark} stroke={C.navyDeep} strokeWidth="2.5" strokeLinejoin="round" />
      ))}
      <ellipse cx="128" cy="150" rx="50" ry="13" fill={C.coinTop} stroke={C.navyDeep} strokeWidth="2.5" />
      <ellipse cx="128" cy="150" rx="34" ry="8" fill="none" stroke={C.white} strokeOpacity="0.35" strokeWidth="2" />
      {/* sprout */}
      <path d="M128 150 L128 104" stroke={C.leaf} strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M128 104 C116 92 118 74 128 60 C138 74 140 92 128 104 Z" fill={C.leaf} />
      <path d="M128 126 C108 128 90 116 86 96 C106 94 124 106 128 126 Z" fill={C.leaf} />
      <path d="M128 118 C150 120 168 108 172 88 C152 86 132 98 128 118 Z" fill={C.leaf} />
    </svg>
  )
}
