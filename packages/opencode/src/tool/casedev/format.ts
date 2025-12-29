import z from "zod"
import { Tool } from "../tool"
import { CaseDevClient } from "./client"
import fs from "fs/promises"
import path from "path"

export const FormatDocumentTool = Tool.define("casedev_format", {
  description: `Generate professional documents using Case.dev Format API.

Converts markdown or structured content into polished PDFs, DOCX, or HTML files.
Supports templates with variable interpolation for legal documents.

Output formats:
- pdf: Professional PDF document
- docx: Microsoft Word document
- html_preview: HTML preview

Example usage:
- Generate a PDF memo: casedev_format with content="# Legal Memo\\n\\n..." output_format="pdf" save_to="/path/to/memo.pdf"
- Create a Word document: casedev_format with content="..." output_format="docx" save_to="/path/to/doc.docx"
- Preview as HTML: casedev_format with content="..." output_format="html_preview" save_to="/path/to/preview.html"`,
  parameters: z.object({
    content: z.string().describe("Markdown or text content to format"),
    output_format: z
      .enum(["pdf", "docx", "html_preview"])
      .describe("Output format: pdf, docx, or html_preview"),
    save_to: z.string().describe("Path to save the output file"),
    input_format: z
      .enum(["md", "json", "text"])
      .optional()
      .describe("Input format: md (default), json, or text"),
    variables: z
      .record(z.string(), z.string())
      .optional()
      .describe("Variables for template interpolation (e.g., client_name, case_number). Use {{variable_name}} in content."),
  }),
  async execute(params, ctx) {
    ctx.metadata({
      title: `Formatting document...`,
      metadata: { status: "formatting", output_format: params.output_format },
    })

    // Build request body
    const body: Record<string, unknown> = {
      content: params.content,
      input_format: params.input_format ?? "md",
      output_format: params.output_format,
    }

    // If variables provided, set up components for interpolation
    if (params.variables && Object.keys(params.variables).length > 0) {
      body.options = {
        components: [
          {
            content: params.content,
            variables: params.variables,
          },
        ],
      }
    }

    // Make request - API returns binary directly for PDF/DOCX, HTML string for html_preview
    const response = await CaseDevClient.request<ArrayBuffer | string>("/format/v1/document", {
      method: "POST",
      body,
      // For binary responses, we need to handle differently
      responseType: params.output_format === "html_preview" ? "text" : "arraybuffer",
    })

    // Resolve and prepare output path
    const outputPath = path.resolve(params.save_to)
    const outputDir = path.dirname(outputPath)

    // Ensure directory exists
    await fs.mkdir(outputDir, { recursive: true })

    // Write the file
    if (params.output_format === "html_preview") {
      // HTML is returned as plain text
      await fs.writeFile(outputPath, response as string)
    } else {
      // PDF and DOCX are returned as binary
      const buffer = Buffer.from(response as ArrayBuffer)
      await fs.writeFile(outputPath, buffer)
    }

    const stats = await fs.stat(outputPath)
    const sizeKB = Math.round(stats.size / 1024)

    return {
      title: `Document created: ${path.basename(outputPath)}`,
      metadata: {
        format: params.output_format,
        savedTo: outputPath,
        size: stats.size,
      },
      output: `Document generated successfully!

File: ${outputPath}
Format: ${params.output_format.toUpperCase()}
Size: ${sizeKB} KB

The document has been saved and is ready to use.`,
    }
  },
})
