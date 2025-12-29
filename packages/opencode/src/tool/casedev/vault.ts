import z from "zod"
import { Tool } from "../tool"
import { CaseDevClient } from "./client"
import fs from "fs/promises"
import path from "path"

interface VaultCreateResponse {
  id: string
  name: string
  description?: string
  filesBucket: string
  vectorBucket: string
  indexName: string
  region: string
  createdAt: string
}

interface VaultUploadResponse {
  objectId: string
  uploadUrl: string
  expiresIn: number
  s3Key: string
  auto_index: boolean
  next_step: string | null
}

interface VaultSearchResult {
  text: string
  object_id: string
  chunk_index: number
  score?: number
  hybridScore?: number
}

interface VaultSearchResponse {
  method: string
  query: string
  response?: string
  chunks?: VaultSearchResult[]
  sources?: Array<{
    id: string
    filename: string
    pageCount?: number
    textLength?: number
    chunkCount?: number
  }>
  vault_id: string
}

interface VaultListResponse {
  vaults: Array<{
    id: string
    name: string
    description?: string
    enableGraph: boolean
    totalObjects: number
    totalBytes: number
    createdAt: string
  }>
  total: number
}

export const VaultCreateTool = Tool.define("casedev_vault_create", {
  description: `Create a new Case.dev Vault for storing and searching documents.

A Vault is an encrypted, searchable document repository with RAG (Retrieval Augmented Generation) capabilities.
Documents uploaded to a vault are automatically OCR'd, chunked, and embedded for semantic search.

IMPORTANT: A vault is REQUIRED before using other Case.dev tools with local files. The typical workflow is:
1. casedev_vault_create - Create a vault (or use casedev_vault_list to find existing ones)
2. casedev_vault_upload - Upload local files to the vault
3. Then use casedev_transcribe, casedev_ocr_process, or casedev_vault_search with the vault/object IDs

Example usage:
- Create a vault for a case: casedev_vault_create with name="Smith v. Jones" description="Personal injury case documents"`,
  parameters: z.object({
    name: z.string().describe("Name for the vault (e.g., case name or project name)"),
    description: z.string().optional().describe("Optional description of the vault's purpose"),
    enable_graph: z
      .boolean()
      .optional()
      .describe("Enable GraphRAG knowledge graph for entity relationship mapping. Defaults to true"),
  }),
  async execute(params, ctx) {
    const response = await CaseDevClient.request<VaultCreateResponse>("/vault", {
      method: "POST",
      body: {
        name: params.name,
        description: params.description,
        enableGraph: params.enable_graph ?? true,
      },
    })

    return {
      title: `Vault created: ${response.name}`,
      metadata: {
        vaultId: response.id,
        name: response.name,
      },
      output: `Vault created successfully!

Vault ID: ${response.id}
Name: ${response.name}
${response.description ? `Description: ${response.description}` : ""}
Region: ${response.region}
Created: ${response.createdAt}

Use casedev_vault_upload with vault_id="${response.id}" to add documents.
Use casedev_vault_search with vault_id="${response.id}" to search documents.`,
    }
  },
})

export const VaultListTool = Tool.define("casedev_vault_list", {
  description: `List all Case.dev Vaults in your account.

Returns vault IDs, names, descriptions, and document counts.`,
  parameters: z.object({}),
  async execute(params, ctx) {
    const response = await CaseDevClient.request<VaultListResponse>("/vault")

    if (response.vaults.length === 0) {
      return {
        title: "No vaults found",
        metadata: { count: 0 },
        output: `No vaults found in your account.

Use casedev_vault_create to create a new vault.`,
      }
    }

    let output = `Found ${response.vaults.length} vault(s):\n\n`

    for (const vault of response.vaults) {
      output += `📁 ${vault.name}\n`
      output += `   ID: ${vault.id}\n`
      if (vault.description) {
        output += `   Description: ${vault.description}\n`
      }
      output += `   Documents: ${vault.totalObjects}\n`
      output += `   Size: ${Math.round(vault.totalBytes / 1024 / 1024)} MB\n`
      output += `   GraphRAG: ${vault.enableGraph ? "enabled" : "disabled"}\n`
      output += `   Created: ${vault.createdAt}\n\n`
    }

    return {
      title: `${response.vaults.length} vault(s)`,
      metadata: {
        count: response.vaults.length,
        vaults: response.vaults.map((v) => ({ id: v.id, name: v.name })),
      },
      output,
    }
  },
})

export const VaultUploadTool = Tool.define("casedev_vault_upload", {
  description: `Upload a LOCAL file to a Case.dev Vault. This is THE way to work with local files.

IMPORTANT: This tool is the REQUIRED first step for processing ANY local file with Case.dev APIs.
- For transcription: Upload audio/video here first, then use casedev_transcribe with vault_id + object_id
- For OCR: Upload document here first, then use casedev_ocr_process with the presigned URL
- For search: Documents uploaded here are automatically indexed for casedev_vault_search

Supported file types: PDF, PNG, JPG, JPEG, TIFF, DOCX, TXT, MP3, WAV, M4A, MP4, WEBM
The file is uploaded via presigned URL and optionally auto-indexed for semantic search.

Returns: vault_id and object_id needed for subsequent operations (transcription, OCR, etc.)

Example workflow for transcribing a local audio file:
1. casedev_vault_upload with vault_id="vault_abc" file_path="/path/to/audio.mp3"
2. casedev_transcribe with vault_id="vault_abc" object_id="<returned_object_id>"`,
  parameters: z.object({
    vault_id: z.string().describe("The vault ID to upload to"),
    file_path: z.string().describe("Absolute path to the file to upload"),
    auto_index: z
      .boolean()
      .optional()
      .describe("Automatically process and index the file for search. Defaults to true"),
  }),
  async execute(params, ctx) {
    // Read the file
    const filePath = path.resolve(params.file_path)
    const fileBuffer = await fs.readFile(filePath)
    const filename = path.basename(filePath)
    const stats = await fs.stat(filePath)

    // Determine content type
    const ext = path.extname(filePath).toLowerCase()
    const contentTypeMap: Record<string, string> = {
      // Documents
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".tiff": "image/tiff",
      ".tif": "image/tiff",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".txt": "text/plain",
      // Audio
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".m4a": "audio/mp4",
      ".aac": "audio/aac",
      ".ogg": "audio/ogg",
      ".flac": "audio/flac",
      // Video
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mov": "video/quicktime",
      ".avi": "video/x-msvideo",
    }
    const contentType = contentTypeMap[ext] ?? "application/octet-stream"

    // Step 1: Get presigned upload URL
    const uploadResponse = await CaseDevClient.request<VaultUploadResponse>(
      `/vault/${params.vault_id}/upload`,
      {
        method: "POST",
        body: {
          filename,
          contentType,
          auto_index: params.auto_index ?? true,
          sizeBytes: stats.size,
        },
      },
    )

    // Step 2: Upload file directly to S3 using presigned URL
    const s3Response = await fetch(uploadResponse.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
      },
      body: fileBuffer,
    })

    if (!s3Response.ok) {
      throw new Error(`Failed to upload file to S3: ${s3Response.status} ${s3Response.statusText}`)
    }

    // Step 3: Trigger ingestion if auto_index is enabled
    let ingestStatus = "skipped"
    if (uploadResponse.next_step && uploadResponse.auto_index) {
      try {
        await CaseDevClient.request<{ status: string }>(
          `/vault/${params.vault_id}/ingest/${uploadResponse.objectId}`,
          { method: "POST" },
        )
        ingestStatus = "started"
      } catch (e) {
        ingestStatus = "failed to start"
      }
    }

    return {
      title: `Uploaded: ${filename}`,
      metadata: {
        objectId: uploadResponse.objectId,
        vaultId: params.vault_id,
        filename,
        autoIndex: uploadResponse.auto_index,
      },
      output: `Document uploaded to vault.

Object ID: ${uploadResponse.objectId}
Filename: ${filename}
Size: ${Math.round(stats.size / 1024)} KB
Auto-index: ${uploadResponse.auto_index}
Ingestion: ${ingestStatus}

${uploadResponse.auto_index ? "The document is being processed for indexing. Once complete, it will be searchable via casedev_vault_search." : "Document stored but not indexed. Use casedev_vault_ingest to process it later."}`,
    }
  },
})

export const VaultSearchTool = Tool.define("casedev_vault_search", {
  description: `Search documents in a Case.dev Vault using semantic search.

Search methods:
- hybrid (recommended): Combined vector + keyword search with BM25
- fast: Quick similarity search without LLM
- global: GraphRAG global search for comprehensive questions
- entity: GraphRAG entity-based search for specific entities
- local: GraphRAG local search for entity-specific questions

Returns relevant document chunks with page references and confidence scores.

Example usage:
- Find contract terms: casedev_vault_search with vault_id="vault_abc" query="termination clause"
- Research case facts: casedev_vault_search with vault_id="vault_xyz" query="defendant's knowledge of defect"`,
  parameters: z.object({
    vault_id: z.string().describe("The vault ID to search in"),
    query: z.string().describe("Natural language search query"),
    method: z
      .enum(["hybrid", "fast", "global", "entity", "local", "vector", "graph"])
      .optional()
      .describe("Search method. Defaults to 'hybrid'"),
    top_k: z.number().optional().describe("Maximum number of results (1-100). Defaults to 10"),
    object_id: z
      .string()
      .optional()
      .describe("Optional: filter search to a specific document by object ID"),
  }),
  async execute(params, ctx) {
    const filters: Record<string, unknown> = {}
    if (params.object_id) {
      filters.object_id = params.object_id
    }

    const response = await CaseDevClient.request<VaultSearchResponse>(
      `/vault/${params.vault_id}/search`,
      {
        method: "POST",
        body: {
          query: params.query,
          method: params.method ?? "hybrid",
          topK: Math.min(Math.max(params.top_k ?? 10, 1), 100),
          filters: Object.keys(filters).length > 0 ? filters : undefined,
        },
      },
    )

    if (!response.chunks || response.chunks.length === 0) {
      return {
        title: "No results found",
        metadata: {
          vaultId: params.vault_id,
          query: params.query,
          method: response.method,
          resultCount: 0,
        },
        output: `No documents matched your query: "${params.query}"

Try:
- Using different keywords or phrasing
- Checking if documents have been uploaded and indexed
- Using a broader search term
- Trying a different search method (global, fast, hybrid)`,
      }
    }

    let output = `Search results for: "${params.query}"\n`
    output += `Method: ${response.method}\n`
    output += `Found ${response.chunks.length} relevant chunk(s)\n\n`

    // Show AI response if available (from global/entity methods)
    if (response.response) {
      output += `--- AI Analysis ---\n${response.response}\n\n`
    }

    // Show chunks
    for (let i = 0; i < response.chunks.length; i++) {
      const chunk = response.chunks[i]
      const score = chunk.hybridScore ?? chunk.score ?? 0
      const confidence = Math.round(score * 100)

      output += `--- Result ${i + 1} (${confidence}% match) ---\n`
      if (chunk.object_id) {
        output += `Document: ${chunk.object_id}`
        if (chunk.chunk_index !== undefined) {
          output += ` (chunk ${chunk.chunk_index})`
        }
        output += `\n`
      }
      output += `\n${chunk.text}\n\n`
    }

    // Show source documents
    if (response.sources && response.sources.length > 0) {
      output += `--- Source Documents ---\n`
      for (const source of response.sources) {
        output += `• ${source.filename} (${source.id})`
        if (source.pageCount) output += ` - ${source.pageCount} pages`
        output += `\n`
      }
    }

    return {
      title: `${response.chunks.length} result(s) for "${params.query.slice(0, 30)}..."`,
      metadata: {
        vaultId: params.vault_id,
        query: params.query,
        method: response.method,
        resultCount: response.chunks.length,
        sources: response.sources,
      },
      output,
    }
  },
})

export const VaultIngestTool = Tool.define("casedev_vault_ingest", {
  description: `Trigger indexing of a specific document in a Case.dev Vault.

Use this to process a document that was uploaded with auto_index=false, or to re-process a document.`,
  parameters: z.object({
    vault_id: z.string().describe("The vault ID"),
    object_id: z.string().describe("The object ID of the document to ingest"),
  }),
  async execute(params, ctx) {
    const response = await CaseDevClient.request<{ status: string; message?: string }>(
      `/vault/${params.vault_id}/ingest/${params.object_id}`,
      { method: "POST" },
    )

    return {
      title: `Ingestion started: ${params.object_id}`,
      metadata: {
        vaultId: params.vault_id,
        objectId: params.object_id,
        status: response.status,
      },
      output: `Document ingestion started.

Vault ID: ${params.vault_id}
Object ID: ${params.object_id}
Status: ${response.status}
${response.message ? `Message: ${response.message}` : ""}

The document will be OCR'd (if needed), chunked, and embedded for search.
This may take a few minutes depending on document size.`,
    }
  },
})

// Types for vault objects listing
interface VaultObject {
  id: string
  filename: string
  contentType: string
  sizeBytes: number
  ingestionStatus: "pending" | "processing" | "completed" | "failed"
  pageCount?: number
  textLength?: number
  chunkCount?: number
  vectorCount?: number
  tags?: string[]
  metadata?: Record<string, unknown>
  createdAt: string
  ingestionCompletedAt?: string
}

interface VaultObjectsResponse {
  vaultId: string
  objects: VaultObject[]
  count: number
}

export const VaultObjectsListTool = Tool.define("casedev_vault_objects", {
  description: `List all documents/objects in a Case.dev Vault.

Returns a list of all uploaded documents with their:
- Object IDs (needed for transcription, search filtering, text extraction, etc.)
- Filenames and file sizes
- Ingestion status (pending, processing, completed, failed)
- Page counts, text length, and chunk counts (after processing)

Use this to:
- See what documents are in a vault before searching
- Get object IDs for transcription or other operations
- Check ingestion status of uploaded documents
- Find specific files by name`,
  parameters: z.object({
    vault_id: z.string().describe("The vault ID to list objects from"),
  }),
  async execute(params, ctx) {
    const response = await CaseDevClient.request<VaultObjectsResponse>(`/vault/${params.vault_id}/objects`)

    if (response.objects.length === 0) {
      return {
        title: "No documents in vault",
        metadata: { vaultId: params.vault_id, count: 0 },
        output: `No documents found in vault ${params.vault_id}.

Use casedev_vault_upload to add documents to this vault.`,
      }
    }

    let output = `Found ${response.count} document(s) in vault:\n\n`

    for (const obj of response.objects) {
      const statusEmoji: Record<string, string> = {
        pending: "⏳",
        processing: "🔄",
        completed: "✅",
        failed: "❌",
      }

      output += `${statusEmoji[obj.ingestionStatus] ?? "❓"} ${obj.filename}\n`
      output += `   ID: ${obj.id}\n`
      output += `   Type: ${obj.contentType}\n`
      output += `   Size: ${Math.round(obj.sizeBytes / 1024)} KB\n`
      output += `   Status: ${obj.ingestionStatus}\n`

      if (obj.ingestionStatus === "completed") {
        if (obj.pageCount) output += `   Pages: ${obj.pageCount}\n`
        if (obj.chunkCount) output += `   Chunks: ${obj.chunkCount}\n`
        if (obj.textLength) output += `   Text: ${Math.round(obj.textLength / 1000)}k chars\n`
      }

      output += `   Uploaded: ${obj.createdAt}\n`
      if (obj.tags && obj.tags.length > 0) {
        output += `   Tags: ${obj.tags.join(", ")}\n`
      }
      output += `\n`
    }

    return {
      title: `${response.count} document(s) in vault`,
      metadata: {
        vaultId: params.vault_id,
        count: response.count,
        objects: response.objects.map((o) => ({
          id: o.id,
          filename: o.filename,
          status: o.ingestionStatus,
        })),
      },
      output,
    }
  },
})

interface VaultObjectTextResponse {
  objectId: string
  filename: string
  text: string
  pageCount?: number
  textLength: number
}

export const VaultObjectTextTool = Tool.define("casedev_vault_text", {
  description: `Get the full extracted text from a document in a Case.dev Vault.

Returns the complete OCR'd/extracted text from a processed document.
Useful for:
- Reading the full content of a document
- Getting text for summarization or analysis
- Extracting specific sections from a document

Note: Document must be fully ingested (status: completed) before text is available.`,
  parameters: z.object({
    vault_id: z.string().describe("The vault ID"),
    object_id: z.string().describe("The object ID of the document"),
  }),
  async execute(params, ctx) {
    const response = await CaseDevClient.request<VaultObjectTextResponse>(
      `/vault/${params.vault_id}/objects/${params.object_id}/text`,
    )

    if (!response.text || response.text.length === 0) {
      return {
        title: "No text available",
        metadata: {
          vaultId: params.vault_id,
          objectId: params.object_id,
        },
        output: `No text available for this document.

This could mean:
- The document is still processing (check status with casedev_vault_objects)
- The document failed to process
- The document contains no extractable text (e.g., blank pages)`,
      }
    }

    const previewLength = 5000
    const isLong = response.text.length > previewLength

    return {
      title: `Text from ${response.filename}`,
      metadata: {
        vaultId: params.vault_id,
        objectId: params.object_id,
        filename: response.filename,
        textLength: response.textLength,
        pageCount: response.pageCount,
      },
      output: `Document: ${response.filename}
Pages: ${response.pageCount ?? "unknown"}
Text length: ${response.textLength.toLocaleString()} characters

--- Document Text ---

${isLong ? response.text.slice(0, previewLength) + "\n\n...(truncated, showing first 5000 chars)" : response.text}`,
    }
  },
})

export const VaultObjectDownloadTool = Tool.define("casedev_vault_download", {
  description: `Download a file from a Case.dev Vault to your local machine.

Downloads the original file (PDF, audio, video, etc.) from the vault to a local path.
This is useful for:
- Getting transcript JSON files that were auto-generated
- Downloading processed documents
- Retrieving any file stored in the vault

Example usage:
- Download a transcript: casedev_vault_download with vault_id="vault_abc" object_id="obj_123" save_to="/path/to/transcript.json"`,
  parameters: z.object({
    vault_id: z.string().describe("The vault ID"),
    object_id: z.string().describe("The object ID of the file to download"),
    save_to: z.string().describe("Local path where the file should be saved"),
  }),
  async execute(params, ctx) {
    ctx.metadata({
      title: `Downloading from vault...`,
      metadata: { status: "downloading", objectId: params.object_id },
    })

    // Download the file as arraybuffer
    const response = await CaseDevClient.request<ArrayBuffer>(
      `/vault/${params.vault_id}/objects/${params.object_id}/download`,
      { responseType: "arraybuffer" },
    )

    // Save to local path
    const savePath = path.resolve(params.save_to)
    const saveDir = path.dirname(savePath)

    // Ensure directory exists
    await fs.mkdir(saveDir, { recursive: true })

    // Write the file
    const buffer = Buffer.from(response)
    await fs.writeFile(savePath, buffer)

    const stats = await fs.stat(savePath)
    const sizeKB = Math.round(stats.size / 1024)

    return {
      title: `Downloaded: ${path.basename(savePath)}`,
      metadata: {
        vaultId: params.vault_id,
        objectId: params.object_id,
        savedTo: savePath,
        size: stats.size,
      },
      output: `File downloaded successfully!

Saved to: ${savePath}
Size: ${sizeKB} KB

The file is ready to use locally.`,
    }
  },
})
