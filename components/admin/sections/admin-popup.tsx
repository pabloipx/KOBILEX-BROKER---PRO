"use client"

import { useRef, useState } from "react"
import useSWR from "swr"
import { ImagePlus, Loader2, Trash2, Eye, EyeOff, ArrowUp, ArrowDown, Save, Megaphone } from "lucide-react"
import { POPUP_DURATION_MS, POPUP_MAX_IMAGES, type PopupConfig } from "@/lib/popup"

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" })
  if (!res.ok) throw new Error("Erro ao carregar")
  return res.json()
}

export function AdminPopup() {
  const { data, error, isLoading, mutate } = useSWR<PopupConfig>("/api/admin/popup", fetcher, {
    revalidateOnFocus: false,
  })
  const [draft, setDraft] = useState<PopupConfig | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const config = draft ?? data
  const update = (next: PopupConfig) => {
    setDraft(next)
    setMessage(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-orange-500" />
      </div>
    )
  }
  if (error || !config) {
    return <p className="py-10 text-center text-red-400">Não foi possível carregar o pop-up.</p>
  }

  const handleUpload = async (file: File) => {
    if (config.images.length >= POPUP_MAX_IMAGES) {
      setMessage({ type: "error", text: `Máximo de ${POPUP_MAX_IMAGES} imagens.` })
      return
    }
    setUploading(true)
    setMessage(null)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/admin/popup/upload", { method: "POST", body, credentials: "include" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao enviar imagem")
      update({ ...config, images: [...config.images, { id: crypto.randomUUID(), url: json.url, active: true }] })
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro ao enviar imagem" })
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= config.images.length) return
    const images = [...config.images]
    const [item] = images.splice(from, 1)
    images.splice(to, 0, item)
    update({ ...config, images })
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch("/api/admin/popup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(config),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao salvar")
      await mutate(json, { revalidate: false })
      setDraft(null)
      setMessage({ type: "ok", text: "Pop-up salvo com sucesso." })
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro ao salvar" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">
          <Megaphone className="size-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Pop-up</h2>
          <p className="text-sm text-gray-400">
            {`Anúncio exibido quando o usuário entra na corretora. Fica ${POPUP_DURATION_MS / 1000}s na tela e pode ser fechado.`}
          </p>
        </div>
      </div>

      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <span>
          <span className="block font-medium text-white">Exibir pop-up</span>
          <span className="block text-sm text-gray-400">Desative para não mostrar o anúncio a ninguém.</span>
        </span>
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => update({ ...config, enabled: e.target.checked })}
          className="size-5 accent-orange-500"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {config.images.map((img, i) => (
          <div key={img.id} className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
            <div className="relative bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url || "/placeholder.svg"}
                alt={`Imagem ${i + 1} do pop-up`}
                className={`aspect-[4/5] w-full object-contain ${img.active ? "" : "opacity-40"}`}
              />
              <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">
                {`#${i + 1}`}
              </span>
              {!img.active && (
                <span className="absolute right-2 top-2 rounded-md bg-gray-700 px-2 py-0.5 text-xs text-gray-200">
                  Oculta
                </span>
              )}
            </div>
            <div className="space-y-3 p-3">
              <input
                type="url"
                inputMode="url"
                placeholder="Link ao tocar (opcional)"
                value={img.link ?? ""}
                onChange={(e) =>
                  update({
                    ...config,
                    images: config.images.map((it) => (it.id === img.id ? { ...it, link: e.target.value || undefined } : it)),
                  })
                }
                className="h-11 w-full rounded-lg border border-white/10 bg-black/40 px-3 text-base text-white placeholder:text-gray-500 focus:border-orange-500 focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    update({
                      ...config,
                      images: config.images.map((it) => (it.id === img.id ? { ...it, active: !it.active } : it)),
                    })
                  }
                  aria-label={img.active ? "Ocultar imagem" : "Mostrar imagem"}
                  className="flex size-11 items-center justify-center rounded-lg bg-white/5 text-gray-300 hover:bg-white/10"
                >
                  {img.active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  aria-label="Mover para cima"
                  className="flex size-11 items-center justify-center rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-30"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === config.images.length - 1}
                  aria-label="Mover para baixo"
                  className="flex size-11 items-center justify-center rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 disabled:opacity-30"
                >
                  <ArrowDown className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => update({ ...config, images: config.images.filter((it) => it.id !== img.id) })}
                  aria-label="Remover imagem"
                  className="ml-auto flex size-11 items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || config.images.length >= POPUP_MAX_IMAGES}
          className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/15 text-gray-400 transition hover:border-orange-500/60 hover:text-orange-400 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="size-7 animate-spin" /> : <ImagePlus className="size-7" />}
          <span className="font-medium">{uploading ? "Enviando..." : "Adicionar imagem"}</span>
          <span className="text-xs text-gray-500">JPG, PNG, WEBP ou GIF até 5MB</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleUpload(file)
          }}
        />
      </div>

      {config.images.length > 1 && (
        <p className="text-sm text-gray-400">Com mais de uma imagem, elas se alternam durante os 8 segundos.</p>
      )}

      {message && (
        <p role="status" className={`text-sm ${message.type === "ok" ? "text-green-400" : "text-red-400"}`}>
          {message.text}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving || !draft}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
        Salvar pop-up
      </button>
    </div>
  )
}
