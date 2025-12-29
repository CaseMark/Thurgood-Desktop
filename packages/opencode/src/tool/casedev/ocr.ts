import z from "zod"
import { Tool } from "../tool"
import { CaseDevClient } from "./client"
import fs from "fs/promises"

interface OcrProcessResponse {
  id: string
  status: "pending" | "processing" | "completed" | "failed"
  message?: string
}

interface OcrStatusResponse {
  id: string
  status: "pending" | "processing" | "completed" | "failed"
  progress?: number
  message?: string
  pages?: number
  completedAt?: string
}

interface OcrDownloadResponse {
  content: string
  format: string
  pages?: number
}

export const OcrProcessTool = Tool.define("casedev_ocr_process", {
  description: `Process a document (PDF, image) through Case.dev OCR to extract text.

IMPORTANT: Local file paths are NOT supported. Files must be either:
1. Uploaded to a vault first (recommended) - use casedev_vault_upload to get a presigned URL
2. Available at a publicly accessible URL (https://)

For local files, ALWAYS use this workflow:
1. First: casedev_vault_create (if no vault exists)
2. Then: casedev_vault_upload with the local file path - this returns a presigned URL
3. Finally: casedev_ocr_process with the presigned URL as document_url

This tool submits a document for OCR processing and returns a job ID.
Use casedev_ocr_status to check the status and casedev_ocr_download to get results.

Supported file types: PDF, PNG, JPG, JPEG, TIFF, BMP

Example usage:
- From vault upload: casedev_ocr_process with document_url="<presigned_url_from_vault_upload>"
- From public URL: casedev_ocr_process with document_url="https://example.com/document.pdf"`,
  parameters: z.object({
    document_url: z.string().describe("URL to the document (HTTP/HTTPS or S3 path)"),
    engine: z
      .enum(["doctr", "paddleocr"])
      .optional()
      .describe("OCR engine to use. doctr is more accurate, paddleocr is faster. Defaults to 'doctr'"),
    document_id: z.string().optional().describe("Optional custom document ID for tracking"),
  }),
  async execute(params, ctx) {
    const response = await CaseDevClient.request<OcrProcessResponse>("/ocr/v1/process", {
      method: "POST",
      body: {
        document_url: params.document_url,
        engine: params.engine ?? "doctr",
        document_id: params.document_id,
      },
    })

    return {
      title: `OCR job submitted: ${response.id}`,
      metadata: {
        jobId: response.id,
        status: response.status,
        documentUrl: params.document_url,
      },
      output: `OCR processing started.

Job ID: ${response.id}
Status: ${response.status}
Document: ${params.document_url}
Engine: ${params.engine ?? "doctr"}

Use casedev_ocr_status with job_id="${response.id}" to check progress.
Once complete, use casedev_ocr_download with job_id="${response.id}" to get results.`,
    }
  },
})

export const OcrStatusTool = Tool.define("casedev_ocr_status", {
  description: `Check the status of a Case.dev OCR processing job.

Returns the current status, progress percentage, and page count when available.`,
  parameters: z.object({
    job_id: z.string().describe("The OCR job ID returned from casedev_ocr_process"),
  }),
  async execute(params, ctx) {
    const response = await CaseDevClient.request<OcrStatusResponse>(`/ocr/v1/${params.job_id}`)

    const statusEmoji: Record<string, string> = {
      pending: "⏳",
      processing: "🔄",
      completed: "✅",
      failed: "❌",
    }

    let output = `OCR Job Status: ${statusEmoji[response.status] ?? "❓"} ${response.status}`

    if (response.progress !== undefined) {
      output += `\nProgress: ${response.progress}%`
    }
    if (response.pages !== undefined) {
      output += `\nPages: ${response.pages}`
    }
    if (response.message) {
      output += `\nMessage: ${response.message}`
    }
    if (response.completedAt) {
      output += `\nCompleted: ${response.completedAt}`
    }

    if (response.status === "completed") {
      output += `\n\nUse casedev_ocr_download with job_id="${params.job_id}" to get the extracted text.`
    }

    return {
      title: `OCR status: ${response.status}`,
      metadata: {
        jobId: params.job_id,
        status: response.status,
        progress: response.progress,
        pages: response.pages,
      },
      output,
    }
  },
})

export const OcrDownloadTool = Tool.define("casedev_ocr_download", {
  description: `Download the results of a completed Case.dev OCR job.

Available formats:
- text: Plain extracted text
- json: Structured JSON with coordinates and confidence scores
- pdf: Searchable PDF with text layer

The text format is recommended for most use cases.`,
  parameters: z.object({
    job_id: z.string().describe("The OCR job ID"),
    format: z
      .enum(["text", "json", "pdf"])
      .optional()
      .describe("Output format: text, json, or pdf. Defaults to 'text'"),
    save_to: z
      .string()
      .optional()
      .describe("Optional path to save the output file. Required for PDF format."),
  }),
  async execute(params, ctx) {
    const format = params.format ?? "text"

    if (format === "pdf" && !params.save_to) {
      return {
        title: "Error: save_to required for PDF",
        metadata: { error: true },
        output: "When downloading as PDF format, you must specify save_to path to save the file.",
      }
    }

    const response = await CaseDevClient.request<OcrDownloadResponse>(
      `/ocr/v1/${params.job_id}/download/${format}`,
    )

    // For PDF, we need to save to file
    if (format === "pdf" && params.save_to) {
      const pdfContent = Buffer.from(response.content, "base64")
      await fs.writeFile(params.save_to, pdfContent)

      return {
        title: `OCR PDF saved to ${params.save_to}`,
        metadata: {
          jobId: params.job_id,
          format,
          savedTo: params.save_to,
          pages: response.pages,
        },
        output: `Searchable PDF saved to: ${params.save_to}\nPages: ${response.pages ?? "unknown"}`,
      }
    }

    // For text or json, optionally save and/or return content
    if (params.save_to) {
      const content = format === "json" ? JSON.stringify(response, null, 2) : response.content
      await fs.writeFile(params.save_to, content)

      return {
        title: `OCR ${format} saved to ${params.save_to}`,
        metadata: {
          jobId: params.job_id,
          format,
          savedTo: params.save_to,
        },
        output: `OCR results saved to: ${params.save_to}\n\nPreview:\n${content.slice(0, 2000)}${content.length > 2000 ? "\n...(truncated)" : ""}`,
      }
    }

    // Return content directly
    const content = format === "json" ? JSON.stringify(response, null, 2) : response.content

    return {
      title: `OCR ${format} content`,
      metadata: {
        jobId: params.job_id,
        format,
        length: content.length,
      },
      output: content,
    }
  },
})
