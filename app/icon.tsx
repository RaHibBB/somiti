import { ImageResponse } from "next/og"
import { AppIconArt } from "@/lib/app-icon"

export const size = { width: 64, height: 64 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(<AppIconArt size={64} />, size)
}
