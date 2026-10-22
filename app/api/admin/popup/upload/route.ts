import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminRequest } from "@/lib/admin/session"

const BUCKET = "popups"
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
}

export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Nenhuma imagem enviada" }, { status: 400 })
    }
    const ext = ALLOWED_TYPES[file.type]
    if (!ext) {
      return NextResponse.json({ error: "Use JPG, PNG, WEBP ou GIF" }, { status: 400 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "A imagem deve ter no máximo 5MB" }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: bucket } = await adminClient.storage.getBucket(BUCKET)
    if (!bucket) {
      await adminClient.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES })
    }

    const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())
    const { error } = await adminClient.storage.from(BUCKET).upload(fileName, buffer, {
      contentType: file.type,
      cacheControl: "31536000",
    })
    if (error) throw error

    const { data } = adminClient.storage.from(BUCKET).getPublicUrl(fileName)
    return NextResponse.json({ url: data.publicUrl })
  } catch (error) {
    console.error("Error uploading popup image:", error)
    return NextResponse.json({ error: "Erro ao enviar imagem" }, { status: 500 })
  }
}
