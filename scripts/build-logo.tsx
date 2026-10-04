// Exports the logo as files: public/logo.svg and PNGs (512 transparent, 1024, and a square
// version for WhatsApp / Facebook profile pictures).  Usage: pnpm tsx scripts/build-logo.tsx
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import sharp from "sharp"
import { LOGO_COLORS, LogoSvg } from "@/lib/logo-art"

async function main() {
  const svg = renderToStaticMarkup(<LogoSvg size={512} />)
  const pub = path.join(process.cwd(), "public")
  await mkdir(pub, { recursive: true })
  await writeFile(path.join(pub, "logo.svg"), `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`)

  const render = (size: number) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size)
  await render(512).png().toFile(path.join(pub, "logo.png"))
  await render(1024).png().toFile(path.join("exports", "logo-1024.png").replace(/^/, ""))
  // Square with the navy background, for profile pictures that get cropped to a circle.
  const badge = await render(820).png().toBuffer()
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: LOGO_COLORS.navy } })
    .composite([{ input: badge, gravity: "center" }])
    .png()
    .toFile(path.join("exports", "logo-square-1024.png"))
  console.log("wrote public/logo.svg, public/logo.png, exports/logo-1024.png, exports/logo-square-1024.png")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
