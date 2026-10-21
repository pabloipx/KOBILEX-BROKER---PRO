"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { X } from "lucide-react"
import { POPUP_DURATION_MS, type PopupImage } from "@/lib/popup"

const SEEN_KEY = "announcement_popup_seen"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function AnnouncementPopup() {
  const { data } = useSWR<{ enabled: boolean; images: PopupImage[] }>("/api/popup", fetcher, {
    revalidateOnFocus: false,
  })
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  const images = data?.enabled ? data.images : []

  useEffect(() => {
    if (images.length === 0) return
    if (sessionStorage.getItem(SEEN_KEY)) return
    sessionStorage.setItem(SEEN_KEY, "1")
    setOpen(true)
  }, [images.length])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => setOpen(false), POPUP_DURATION_MS)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    window.addEventListener("keydown", onKey)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  useEffect(() => {
    if (!open || images.length < 2) return
    const slide = setInterval(
      () => setIndex((i) => (i + 1) % images.length),
      POPUP_DURATION_MS / images.length,
    )
    return () => clearInterval(slide)
  }, [open, images.length])

  if (!open || images.length === 0) return null

  const current = images[index] ?? images[0]
  const picture = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={current.url || "/placeholder.svg"}
      alt="Anúncio da corretora"
      className="block max-h-[72dvh] w-full rounded-2xl object-contain"
    />
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Anúncio"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-5 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-sm animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fechar anúncio"
          className="absolute -right-2 -top-2 z-10 flex size-11 items-center justify-center rounded-full border border-white/15 bg-neutral-900/95 text-white shadow-lg transition hover:bg-neutral-800"
        >
          <X className="size-5" />
        </button>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl shadow-orange-500/10">
          {current.link ? (
            <a href={current.link} onClick={() => setOpen(false)}>
              {picture}
            </a>
          ) : (
            picture
          )}
          <div className="h-1 w-full bg-white/10">
            <div
              className="h-full bg-orange-500"
              style={{ animation: `popup-progress ${POPUP_DURATION_MS}ms linear forwards` }}
            />
          </div>
        </div>

        {images.length > 1 && (
          <div className="mt-3 flex justify-center gap-2">
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Ver anúncio ${i + 1}`}
                className="flex h-11 items-center px-1"
              >
                <span className={`block h-2 rounded-full transition-all ${i === index ? "w-6 bg-orange-500" : "w-2 bg-white/40"}`} />
              </button>
            ))}
          </div>
        )}
      </div>
      <style>{`@keyframes popup-progress { from { width: 100%; } to { width: 0%; } }`}</style>
    </div>
  )
}
