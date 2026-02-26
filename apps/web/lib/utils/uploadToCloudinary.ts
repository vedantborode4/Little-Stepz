// lib/utils/uploadToCloudinary.ts

export async function uploadToCloudinary(file: File, signatureData: any) {
  const formData = new FormData()

  formData.append("file", file)
  formData.append("api_key", signatureData.apiKey)
  formData.append("timestamp", signatureData.timestamp)
  formData.append("signature", signatureData.signature)
  formData.append("folder", signatureData.folder)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${signatureData.cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    }
  )

  return res.json()
}