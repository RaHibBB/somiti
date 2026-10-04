"use client"

import { useEffect } from "react"

/** On load, scroll the grid so the current month is visible next to the sticky name column. */
export function ScrollToCurrent() {
  useEffect(() => {
    const box = document.getElementById("grid-scroll")
    const cell = box?.querySelector<HTMLElement>('th[data-current="true"]')
    if (!box || !cell) return
    const nameCol = box.querySelector<HTMLElement>("thead th")?.offsetWidth ?? 0
    // Show two past months to the left of the current one.
    box.scrollLeft = Math.max(0, cell.offsetLeft - nameCol - cell.offsetWidth * 2)
  }, [])
  return null
}
