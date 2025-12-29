import { Auth } from "@/auth"
import { Config } from "@/config/config"
import { Log } from "@/util/log"

const log = Log.create({ service: "casedev.client" })

export const CASEDEV_API_URL = "https://api.case.dev"

export namespace CaseDevClient {
  /**
   * Get the Case.dev API key from auth storage, environment, or config
   */
  export async function getApiKey(): Promise<string | undefined> {
    // Check environment variables first
    const envKey = process.env.THURGOOD_API_KEY ?? process.env.CASEDEV_API_KEY
    if (envKey) return envKey

    // Check auth storage
    const auth = await Auth.get("thurgood")
    if (auth?.type === "api") return auth.key

    // Check config
    const config = await Config.get()
    const configKey = config.provider?.["thurgood"]?.options?.apiKey
    if (configKey) return configKey

    return undefined
  }

  /**
   * Make an authenticated request to the Case.dev API
   */
  export async function request<T = unknown>(
    endpoint: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE"
      body?: unknown
      headers?: Record<string, string>
      timeout?: number
      responseType?: "json" | "text" | "arraybuffer"
    } = {},
  ): Promise<T> {
    const apiKey = await getApiKey()
    if (!apiKey) {
      throw new Error(
        "Case.dev API key not found. Please set THURGOOD_API_KEY or CASEDEV_API_KEY environment variable, or connect Case.dev in the provider settings.",
      )
    }

    const url = `${CASEDEV_API_URL}${endpoint}`
    const { method = "GET", body, headers = {}, timeout = 30000, responseType = "json" } = options

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      log.info({ url, method }, "Case.dev API request")

      const response = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error")
        throw new Error(`Case.dev API error (${response.status}): ${errorText}`)
      }

      // Handle different response types
      if (responseType === "arraybuffer") {
        const data = await response.arrayBuffer()
        return data as T
      } else if (responseType === "text") {
        const data = await response.text()
        return data as T
      } else {
        const data = await response.json()
        return data as T
      }
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Case.dev API request timed out after ${timeout}ms`)
      }
      throw error
    }
  }

  /**
   * Upload a file to Case.dev (multipart form data)
   */
  export async function uploadFile(
    endpoint: string,
    file: {
      content: Buffer | Uint8Array
      filename: string
      contentType?: string
    },
    additionalFields?: Record<string, string>,
  ): Promise<unknown> {
    const apiKey = await getApiKey()
    if (!apiKey) {
      throw new Error("Case.dev API key not found")
    }

    const url = `${CASEDEV_API_URL}${endpoint}`
    const formData = new FormData()

    // Add the file
    const blob = new Blob([file.content], { type: file.contentType ?? "application/octet-stream" })
    formData.append("file", blob, file.filename)

    // Add any additional fields
    if (additionalFields) {
      for (const [key, value] of Object.entries(additionalFields)) {
        formData.append(key, value)
      }
    }

    log.info({ url, filename: file.filename }, "Case.dev file upload")

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error")
      throw new Error(`Case.dev upload error (${response.status}): ${errorText}`)
    }

    return response.json()
  }
}
