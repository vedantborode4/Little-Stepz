import { api } from "./api-client"
import { friendlyError } from "./errorMessages"

/**
 * Fetch a PDF and hand it to the browser's downloader.
 *
 * Fetched through the axios client rather than linked directly so the request carries
 * the auth header (and the 401-refresh interceptor); the response is a blob, saved via
 * a temporary object URL. Shared by every invoice and receipt download.
 */
export async function downloadPdf(path: string, fallbackName: string): Promise<void> {
  const res = await api.get(path, { responseType: "blob" })
  const disposition = res.headers?.["content-disposition"] as string | undefined
  const match = disposition?.match(/filename="?([^"]+)"?/)
  const filename = match?.[1] ?? fallbackName

  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }))
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoked on the next tick so the click has already started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * User-facing copy for a failed PDF request.
 *
 * `responseType: "blob"` applies to the error response too, so the API's JSON body
 * arrives as a Blob and the message has to be read out of it before anything can be
 * done with it — passing the raw axios error to `friendlyError` finds no message and
 * falls through to "Request failed with status code 409".
 *
 * The extracted message still goes through `friendlyError`, which maps known codes to
 * copy and refuses to let an unmapped one (`RECEIPT_NOT_AVAILABLE`) reach a shopper.
 * With no usable message we return the caller's fallback rather than the raw axios
 * string, which is no more meaningful to a user than the code would have been.
 */
export async function pdfErrorMessage(err: unknown, fallback: string): Promise<string> {
  const body = (err as { response?: { data?: unknown } })?.response?.data

  let payload: unknown = body
  if (body instanceof Blob) {
    try {
      payload = JSON.parse(await body.text())
    } catch {
      payload = undefined
    }
  }

  const message = (payload as { message?: string } | undefined)?.message
  return message ? friendlyError(message, fallback) : fallback
}
