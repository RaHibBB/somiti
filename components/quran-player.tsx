"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Volume2, VolumeX } from "lucide-react"
import { cn } from "@/lib/utils"

// Short, low-data recitations by Mishary Alafasy, streamed from public servers (nothing is stored
// on our side): Surah Al-Fatiha (~0.8 MB) then Ayat al-Kursi (~0.4 MB), repeated. The browser
// keeps them after the first play, so later visits cost almost no data.
const PLAYLIST = ["https://server8.mp3quran.net/afs/001.mp3", "https://everyayah.com/data/Alafasy_64kbps/002255.mp3"]
const PREF_KEY = "samiti_quran" // "off" once the visitor has turned it off on this device

type State = "waiting" | "playing" | "off"

/**
 * Background recitation with an always-visible on/off button.
 * - Browsers don't allow sound before the visitor touches the page, so it starts on the first tap/click.
 * - Turning it off is remembered on that device; Save-Data users start with it off.
 * - Pauses when the tab is hidden and on print pages.
 */
export function QuranPlayer() {
  const pathname = usePathname()
  const onPrintPage = pathname.startsWith("/print")
  const audio = useRef<HTMLAudioElement | null>(null)
  const wanted = useRef(true)
  const started = useRef(false)
  const [state, setState] = useState<State | null>(null) // null until mounted (avoids a flash)
  const [unavailable, setUnavailable] = useState(false)

  const tryPlay = useCallback(async () => {
    const a = audio.current
    if (!a) return false
    try {
      await a.play()
      started.current = true
      setState("playing")
      return true
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    let pref = true
    try {
      pref = localStorage.getItem(PREF_KEY) !== "off"
    } catch {}
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
    wanted.current = pref && !saveData
    setState(wanted.current ? "waiting" : "off")

    const a = new Audio()
    a.preload = "none"
    a.volume = 0.6
    let index = 0
    let errors = 0
    a.src = PLAYLIST[0]
    audio.current = a

    const next = () => {
      index = (index + 1) % PLAYLIST.length
      a.src = PLAYLIST[index]
      if (wanted.current) void a.play().catch(() => {})
    }
    a.addEventListener("ended", next)
    a.addEventListener("playing", () => {
      errors = 0
    })
    a.addEventListener("error", () => {
      errors += 1
      if (errors > PLAYLIST.length * 2) {
        setUnavailable(true)
        setState("off")
        return
      }
      next()
    })

    // First tap/click/key anywhere starts it (sound can't start before that).
    const start = (e: Event) => {
      if (!wanted.current || started.current) return
      if ((e.target as HTMLElement | null)?.closest?.("[data-quran-toggle]")) return // the button handles itself
      void tryPlay().then((ok) => {
        if (ok) {
          window.removeEventListener("click", start, true)
          window.removeEventListener("keydown", start, true)
        }
      })
    }
    window.addEventListener("click", start, true)
    window.addEventListener("keydown", start, true)

    // Don't play to an empty screen.
    let resume = false
    const onVisibility = () => {
      if (document.hidden) {
        if (!a.paused) {
          a.pause()
          resume = true
        }
      } else if (resume && wanted.current) {
        resume = false
        void a.play().catch(() => {})
      }
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      window.removeEventListener("click", start, true)
      window.removeEventListener("keydown", start, true)
      document.removeEventListener("visibilitychange", onVisibility)
      a.pause()
      audio.current = null
    }
  }, [tryPlay])

  // Print pages stay silent; coming back resumes if it was playing.
  useEffect(() => {
    const a = audio.current
    if (!a) return
    if (onPrintPage) a.pause()
    else if (started.current && wanted.current) void a.play().catch(() => {})
  }, [onPrintPage])

  async function toggle() {
    const a = audio.current
    if (!a) return
    if (state === "playing") {
      a.pause()
      wanted.current = false
      setState("off")
      try {
        localStorage.setItem(PREF_KEY, "off")
      } catch {}
      return
    }
    wanted.current = true
    try {
      localStorage.removeItem(PREF_KEY)
    } catch {}
    setUnavailable(false)
    if (!(await tryPlay())) setState("waiting")
  }

  if (state === null || onPrintPage) return null

  const playing = state === "playing"
  const label = unavailable ? "তিলাওয়াত পাওয়া যাচ্ছে না" : playing ? "তিলাওয়াত চলছে · বন্ধ" : state === "waiting" ? "তিলাওয়াত শুনুন" : "তিলাওয়াত বন্ধ · চালু"
  return (
    <button
      type="button"
      data-quran-toggle
      onClick={toggle}
      aria-pressed={playing}
      aria-label={label}
      className={cn(
        "fixed bottom-20 left-3 z-50 flex h-11 lg:bottom-5 lg:left-auto lg:right-5 items-center gap-2 rounded-full border px-4 text-sm font-medium shadow-lg backdrop-blur print:hidden",
        playing ? "border-green-700 bg-brand-green text-white" : "bg-white/95 text-brand-navy",
        state === "waiting" && "animate-pulse",
      )}
    >
      {playing ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
      <span>{label}</span>
    </button>
  )
}
