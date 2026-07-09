"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { createBrowserClient } from "@supabase/ssr"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Upload, Camera, CheckCircle, Clock, XCircle, Loader2, AlertTriangle } from "lucide-react"
import Image from "next/image"

export default function KYCPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingFront, setUploadingFront] = useState(false)
  const [uploadingBack, setUploadingBack] = useState(false)
  const [uploadingSelfie, setUploadingSelfie] = useState(false)
  const [kycStatus, setKycStatus] = useState<string>("unverified")
  const [rejectionReason, setRejectionReason] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [documentFrontPath, setDocumentFrontPath] = useState<string | null>(null)
  const [documentBackPath, setDocumentBackPath] = useState<string | null>(null)
  const [selfiePath, setSelfiePath] = useState<string | null>(null)

  const [documentFrontPreview, setDocumentFrontPreview] = useState<string | null>(null)
  const [documentBackPreview, setDocumentBackPreview] = useState<string | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)

  const frontInputRef = useRef<HTMLInputElement>(null)
  const backInputRef = useRef<HTMLInputElement>(null)
  const selfieInputRef = useRef<HTMLInputElement>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  )

  useEffect(() => {
    checkKYCStatus()
  }, [])

  async function checkKYCStatus() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }

      setUserId(user.id)

      const { data: profile } = await supabase.from("profiles").select("kyc_status").eq("id", user.id).single()

      // Check if there are actual documents submitted
      const { data: kycRequests, error: kycError } = await supabase
        .from("kyc_requests")
        .select("id, status, rejection_reason, document_front_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)

      // Get the most recent request (if any)
      const kycRequest = kycRequests && kycRequests.length > 0 ? kycRequests[0] : null

      // Determine actual status based on documents existence
      let actualStatus = "unverified"
      
      // Only show "pending" (Em Análise) if there's an actual document uploaded
      if (kycRequest && kycRequest.document_front_url && kycRequest.document_front_url.trim() !== "") {
        // Documents exist - use the request status
        actualStatus = kycRequest.status || "pending"
        
        if (kycRequest.status === "rejected" && kycRequest.rejection_reason) {
          setRejectionReason(kycRequest.rejection_reason)
        }
      } else if (profile?.kyc_status === "approved") {
        // Already approved (legacy)
        actualStatus = "approved"
      } else {
        // No documents or empty URL - always show unverified
        actualStatus = "unverified"
      }

      setKycStatus(actualStatus)
    } catch (error) {
      console.error("Error checking KYC status:", error)
      setKycStatus("unverified")
    } finally {
      setLoading(false)
    }
  }

  // Comprime/redimensiona a imagem no navegador para evitar arquivos gigantes
  // (fotos de celular podem ter 5-10MB, o que estoura o limite de upload do servidor).
  async function compressImage(file: File): Promise<Blob> {
    // Se não for imagem, retorna o arquivo original
    if (!file.type.startsWith("image/")) return file

    return new Promise((resolve) => {
      const img = document.createElement("img")
      const objectUrl = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        const maxDimension = 1600
        let { width, height } = img

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve(file)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => resolve(blob || file),
          "image/jpeg",
          0.8,
        )
      }

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(file)
      }

      img.src = objectUrl
    })
  }

  async function uploadFile(type: "front" | "back" | "selfie", file: File) {
    if (!userId) return

    if (type === "front") setUploadingFront(true)
    else if (type === "back") setUploadingBack(true)
    else setUploadingSelfie(true)

    try {
      const reader = new FileReader()
      reader.onloadend = () => {
        const preview = reader.result as string
        if (type === "front") setDocumentFrontPreview(preview)
        else if (type === "back") setDocumentBackPreview(preview)
        else setSelfiePreview(preview)
      }
      reader.readAsDataURL(file)

      // Comprime a imagem antes de enviar
      const compressed = await compressImage(file)

      const typeKey = type === "front" ? "document_front" : type === "back" ? "document_back" : "selfie"
      const fileName = `${userId}/${typeKey}_${Date.now()}.jpg`

      // Upload direto do navegador para o Supabase Storage (contorna o limite
      // de tamanho de corpo das rotas de API do servidor).
      const { data, error: uploadError } = await supabase.storage
        .from("kyc-documents")
        .upload(fileName, compressed, {
          contentType: "image/jpeg",
          upsert: false,
        })

      if (uploadError) {
        throw new Error(uploadError.message || "Erro ao fazer upload")
      }

      const path = data.path

      if (type === "front") setDocumentFrontPath(path)
      else if (type === "back") setDocumentBackPath(path)
      else setSelfiePath(path)

      setError(null)
    } catch (err: any) {
      console.error("Upload error:", err)
      setError(err.message)
    } finally {
      if (type === "front") setUploadingFront(false)
      else if (type === "back") setUploadingBack(false)
      else setUploadingSelfie(false)
    }
  }

  async function handleSubmit() {
    if (!documentFrontPath || !documentBackPath || !selfiePath || !userId) {
      setError("Por favor, envie todos os documentos necessários")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          documentFrontPath,
          documentBackPath,
          selfiePath,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao enviar documentos")
      }

      setKycStatus("pending")
      setSuccess(true)
    } catch (err: any) {
      console.error("Submit error:", err)
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
      </div>
    )
  }

  if (kycStatus === "approved") {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-card border-b border-border">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-lg">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold">Verificação de Conta</h1>
            <div className="w-9" />
          </div>
        </header>

        <div className="p-4 max-w-lg mx-auto">
          <Card className="border-green-500/30 bg-purple-500/5">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <div className="w-20 h-20 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-10 w-10 text-purple-500" />
                </div>
                <h2 className="text-2xl font-bold text-purple-500 mb-2">Conta Verificada</h2>
                <p className="text-muted-foreground mb-6">
                  Sua conta foi verificada com sucesso! Você tem acesso completo a todas as funcionalidades, incluindo
                  saques.
                </p>
                <div className="space-y-3">
                  <Button onClick={() => router.push("/withdraw")} className="w-full bg-purple-600 hover:bg-purple-700">
                    Fazer Saque
                  </Button>
                  <Button onClick={() => router.push("/trade")} variant="outline" className="w-full">
                    Voltar ao Trading
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">Verificação de Conta</h1>
          <div className="w-9" />
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        {/* Success Message */}
        {success && (
          <Card className="border-green-500 bg-purple-500/10">
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="h-12 w-12 text-purple-500 mx-auto mb-3" />
                <p className="text-purple-500 font-semibold">Documentos enviados com sucesso!</p>
                <p className="text-muted-foreground text-sm mt-2">Aguarde a análise em até 24 horas.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <Card className="border-red-500 bg-red-500/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-500">
                <XCircle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              {kycStatus === "pending" && <Clock className="h-5 w-5 text-purple-500" />}
              {kycStatus === "rejected" && <XCircle className="h-5 w-5 text-red-500" />}
              {kycStatus === "unverified" && <AlertTriangle className="h-5 w-5 text-orange-500" />}
              Status da Verificação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kycStatus === "pending" && (
              <div className="text-center py-4">
                <Clock className="h-16 w-16 text-purple-500 mx-auto mb-4" />
                <p className="text-purple-500 font-semibold text-lg">Em Análise</p>
                <p className="text-muted-foreground mt-2">
                  Seus documentos foram enviados e estão sendo analisados. Aguarde a aprovação em até 24 horas.
                </p>
              </div>
            )}

            {kycStatus === "rejected" && (
              <div className="text-center py-4">
                <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <p className="text-red-500 font-semibold text-lg">Verificação Rejeitada</p>
                {rejectionReason && <p className="text-muted-foreground mt-2">Motivo: {rejectionReason}</p>}
                <p className="text-muted-foreground mt-2">Por favor, envie novos documentos.</p>
              </div>
            )}

            {kycStatus === "unverified" && (
              <div className="text-center py-4">
                <AlertTriangle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
                <p className="text-orange-500 font-semibold text-lg">Aguardando Documento</p>
                <p className="text-muted-foreground mt-2">
                  Para realizar saques, você precisa verificar sua conta enviando seus documentos abaixo.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Form - Show only if unverified or rejected (not when pending/in analysis) */}
        {(kycStatus === "unverified" || kycStatus === "rejected") && !success && (
          <>
            {/* Document Front */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Frente do Documento</CardTitle>
                <CardDescription>RG, CNH ou Passaporte</CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  ref={frontInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadFile("front", file)
                  }}
                />
                {documentFrontPreview ? (
                  <div className="relative">
                    <Image
                      src={documentFrontPreview || "/placeholder.svg"}
                      alt="Frente do documento"
                      width={400}
                      height={250}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    {documentFrontPath && (
                      <div className="absolute top-2 right-2 bg-purple-500 rounded-full p-1">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute bottom-2 right-2 bg-transparent"
                      onClick={() => frontInputRef.current?.click()}
                      disabled={uploadingFront}
                    >
                      {uploadingFront ? <Loader2 className="h-4 w-4 animate-spin" /> : "Trocar"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-32 border-dashed flex flex-col gap-2 bg-transparent"
                    onClick={() => frontInputRef.current?.click()}
                    disabled={uploadingFront}
                  >
                    {uploadingFront ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      <>
                        <Camera className="h-8 w-8" />
                        <span>Tirar foto ou escolher arquivo</span>
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Document Back */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Verso do Documento</CardTitle>
                <CardDescription>Parte de trás do documento</CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  ref={backInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadFile("back", file)
                  }}
                />
                {documentBackPreview ? (
                  <div className="relative">
                    <Image
                      src={documentBackPreview || "/placeholder.svg"}
                      alt="Verso do documento"
                      width={400}
                      height={250}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    {documentBackPath && (
                      <div className="absolute top-2 right-2 bg-purple-500 rounded-full p-1">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute bottom-2 right-2 bg-transparent"
                      onClick={() => backInputRef.current?.click()}
                      disabled={uploadingBack}
                    >
                      {uploadingBack ? <Loader2 className="h-4 w-4 animate-spin" /> : "Trocar"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-32 border-dashed flex flex-col gap-2 bg-transparent"
                    onClick={() => backInputRef.current?.click()}
                    disabled={uploadingBack}
                  >
                    {uploadingBack ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      <>
                        <Camera className="h-8 w-8" />
                        <span>Tirar foto ou escolher arquivo</span>
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Selfie with Document */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Selfie com Documento</CardTitle>
                <CardDescription>Tire uma foto segurando o documento ao lado do rosto</CardDescription>
              </CardHeader>
              <CardContent>
                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) uploadFile("selfie", file)
                  }}
                />
                {selfiePreview ? (
                  <div className="relative">
                    <Image
                      src={selfiePreview || "/placeholder.svg"}
                      alt="Selfie com documento"
                      width={400}
                      height={250}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    {selfiePath && (
                      <div className="absolute top-2 right-2 bg-purple-500 rounded-full p-1">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute bottom-2 right-2 bg-transparent"
                      onClick={() => selfieInputRef.current?.click()}
                      disabled={uploadingSelfie}
                    >
                      {uploadingSelfie ? <Loader2 className="h-4 w-4 animate-spin" /> : "Trocar"}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-32 border-dashed flex flex-col gap-2 bg-transparent"
                    onClick={() => selfieInputRef.current?.click()}
                    disabled={uploadingSelfie}
                  >
                    {uploadingSelfie ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      <>
                        <Camera className="h-8 w-8" />
                        <span>Tirar selfie</span>
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Submit Button */}
            <Button
              className="w-full h-14 bg-purple-600 hover:bg-purple-700 text-lg font-semibold"
              onClick={handleSubmit}
              disabled={submitting || !documentFrontPath || !documentBackPath || !selfiePath}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 mr-2" />
                  Enviar Documentos
                </>
              )}
            </Button>

            {/* Progress indicator */}
            <div className="flex justify-center gap-2 pt-2">
              <div className={`h-2 w-16 rounded-full ${documentFrontPath ? "bg-purple-500" : "bg-muted"}`} />
              <div className={`h-2 w-16 rounded-full ${documentBackPath ? "bg-purple-500" : "bg-muted"}`} />
              <div className={`h-2 w-16 rounded-full ${selfiePath ? "bg-purple-500" : "bg-muted"}`} />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {[documentFrontPath, documentBackPath, selfiePath].filter(Boolean).length}/3 documentos enviados
            </p>
          </>
        )}
      </div>
    </div>
  )
}
