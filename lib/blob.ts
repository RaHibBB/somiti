import "server-only"
import { put } from "@vercel/blob"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { UserError } from "@/lib/services/errors"

const MAX_BYTES = 300 * 1024 // client compresses to ≤200 KB; small slack
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

/**
 * Store a receipt photo and return its URL. Uses Vercel Blob (public, random suffix).
 * Without BLOB_READ_WRITE_TOKEN in development it saves under public/dev-uploads instead.
 */
export async function uploadReceipt(file: File): Promise<string> {
  if (!TYPES.has(file.type)) throw new UserError("শুধু ছবি (JPG/PNG) দেওয়া যাবে।")
  if (file.size > MAX_BYTES) throw new UserError("ছবিটি অনেক বড়। আবার চেষ্টা করুন।")
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"
  const name = `receipts/${new Date().toISOString().slice(0, 10)}.${ext}`

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    if (process.env.NODE_ENV === "production") throw new Error("BLOB_READ_WRITE_TOKEN is not set")
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const dir = path.join(process.cwd(), "public", "dev-uploads")
    await mkdir(dir, { recursive: true })
    await writeFile(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()))
    return `/dev-uploads/${fileName}`
  }
  const blob = await put(name, file, { access: "public", addRandomSuffix: true, contentType: file.type })
  return blob.url
}
