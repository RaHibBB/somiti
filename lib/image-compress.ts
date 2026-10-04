// Browser-only: shrink a photo to ≤1600px on the long side and ≤200 KB JPEG before upload,
// so it works on slow mobile connections and stays inside the free Blob allowance.

const MAX_SIDE = 1600
const MAX_BYTES = 200 * 1024

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("ছবিটি খোলা যায়নি।"))
    }
    img.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("ছবি রূপান্তর ব্যর্থ।"))), "image/jpeg", quality),
  )
}

export async function compressImage(file: File): Promise<File> {
  const img = await loadImage(file)
  let scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext("2d")!
    ctx.fillStyle = "#fff" // PNGs with transparency → white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const q of [0.82, 0.7, 0.58, 0.46]) {
      const blob = await toBlob(canvas, q)
      if (blob.size <= MAX_BYTES) return new File([blob], "receipt.jpg", { type: "image/jpeg" })
    }
    scale *= 0.75
  }
  throw new Error("ছবিটি ছোট করা যায়নি। অন্য ছবি দিন।")
}
