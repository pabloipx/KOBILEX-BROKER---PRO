export const POPUP_SETTING_KEY = "popup_config"
export const POPUP_DURATION_MS = 8000
export const POPUP_MAX_IMAGES = 10

export interface PopupImage {
  id: string
  url: string
  link?: string
  active: boolean
}

export interface PopupConfig {
  enabled: boolean
  images: PopupImage[]
}

export const DEFAULT_POPUP_CONFIG: PopupConfig = {
  enabled: true,
  images: [{ id: "saques-24h", url: "/popups/saques-24h.jpg", active: true }],
}

function isSafeUrl(value: unknown, allowRelative: boolean): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return false
  if (allowRelative && value.startsWith("/") && !value.startsWith("//")) return true
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}

export function parsePopupConfig(raw: unknown): PopupConfig | null {
  let value = raw
  if (typeof value === "string") {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== "object") return null
  const obj = value as Record<string, unknown>
  if (!Array.isArray(obj.images)) return null

  const images: PopupImage[] = []
  for (const item of obj.images.slice(0, POPUP_MAX_IMAGES)) {
    if (!item || typeof item !== "object") continue
    const img = item as Record<string, unknown>
    if (!isSafeUrl(img.url, true)) continue
    images.push({
      id: typeof img.id === "string" && img.id ? img.id.slice(0, 64) : crypto.randomUUID(),
      url: img.url,
      link: isSafeUrl(img.link, true) ? img.link : undefined,
      active: img.active !== false,
    })
  }

  return { enabled: obj.enabled !== false, images }
}
