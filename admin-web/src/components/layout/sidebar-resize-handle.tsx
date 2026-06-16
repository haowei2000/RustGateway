import { useCallback, useEffect, useRef } from "react"

const MIN_SIDEBAR_WIDTH = 160
const MAX_SIDEBAR_WIDTH = 400

function setSidebarWidth(px: number) {
  if (!Number.isFinite(px)) return
  const clamped = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, px))
  document.documentElement.style.setProperty("--sidebar-width", `${clamped}px`)
}

function persistWidth() {
  const width = getComputedStyle(document.documentElement)
    .getPropertyValue("--sidebar-width")
    .trim()
  if (width) localStorage.setItem("sidebar-width", width)
}

function SidebarResizeHandle() {
  const handleRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return
    setSidebarWidth(e.clientX)
  }, [])

  const onMouseUp = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    handleRef.current?.classList.remove("is-dragging")
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
    persistWidth()
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    handleRef.current?.classList.add("is-dragging")
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [])

  // Restore saved width on mount
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-width")
    const parsed = Number(stored)
    if (Number.isFinite(parsed) && parsed > 0) setSidebarWidth(parsed)
  }, [])

  useEffect(() => {
    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }
  }, [onMouseMove, onMouseUp])

  return (
    <div
      ref={handleRef}
      className="sidebar-resize-handle"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onMouseDown={onMouseDown}
    />
  )
}

export { SidebarResizeHandle }
