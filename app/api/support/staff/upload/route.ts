import { SUPPORT_IMAGE_BUCKET, SUPPORT_IMAGE_MAX_BYTES, SUPPORT_IMAGE_TYPES } from "@/lib/support/constants"
import { jsonError, supabaseAdmin } from "@/lib/support/server"
import { getStaff, staffUnauthorized } from "@/lib/support/staff"

export async function POST(request: Request) {
  const staff = await getStaff()
  if (!staff) return staffUnauthorized()
  if (staff.role !== "admin") return jsonError("Apenas o administrador pode enviar fotos.", 403)

  let file: FormDataEntryValue | null
  try {
    file = (await request.formData()).get("file")
  } catch {
    return jsonError("Requisição inválida.", 400)
  }
  if (!(file instanceof File)) return jsonError("Nenhuma imagem enviada.", 400)

  const ext = SUPPORT_IMAGE_TYPES[file.type]
  if (!ext) return jsonError("Use JPG, PNG, WEBP ou GIF.", 400)
  if (file.size > SUPPORT_IMAGE_MAX_BYTES) return jsonError("A imagem deve ter no máximo 5MB.", 400)

  try {
    const admin = supabaseAdmin()
    const { data: bucket } = await admin.storage.getBucket(SUPPORT_IMAGE_BUCKET)
    if (!bucket) {
      await admin.storage.createBucket(SUPPORT_IMAGE_BUCKET, { public: true, fileSizeLimit: SUPPORT_IMAGE_MAX_BYTES })
    }

    const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`
    const { error } = await admin.storage
      .from(SUPPORT_IMAGE_BUCKET)
      .upload(fileName, Buffer.from(await file.arrayBuffer()), { contentType: file.type, cacheControl: "31536000" })
    if (error) throw error

    const { data } = admin.storage.from(SUPPORT_IMAGE_BUCKET).getPublicUrl(fileName)
    return Response.json({ url: data.publicUrl })
  } catch (error) {
    console.error("[support] falha ao enviar imagem:", (error as Error).message)
    return jsonError("Não foi possível enviar a imagem. Tente novamente.", 500)
  }
}
