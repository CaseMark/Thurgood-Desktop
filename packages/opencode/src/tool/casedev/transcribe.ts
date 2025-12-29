import z from "zod"
import { Tool } from "../tool"
import { CaseDevClient } from "./client"

interface TranscriptionResponse {
  id: string
  status: "queued" | "processing" | "completed" | "error"
  vault_id?: string
  source_object_id?: string
  text?: string
  words?: Array<{
    text: string
    start: number
    end: number
    confidence: number
    speaker?: string
  }>
  utterances?: Array<{
    text: string
    start: number
    end: number
    confidence: number
    speaker: string
  }>
  audio_duration?: number
  language_code?: string
}

export const TranscribeTool = Tool.define("casedev_transcribe", {
  description: `Transcribe audio or video files using Case.dev Voice API.

IMPORTANT: Local file paths are NOT supported. Files must be either:
1. Uploaded to a vault first (recommended) - use casedev_vault_upload, then transcribe with vault_id + object_id
2. Available at a publicly accessible URL (https://)

For local files, ALWAYS use this workflow:
1. First: casedev_vault_create (if no vault exists)
2. Then: casedev_vault_upload with the local file path
3. Finally: casedev_transcribe with the returned vault_id and object_id

Features:
- Speaker diarization (identifies different speakers)
- Timestamps for each segment
- Custom vocabulary boosting for legal terms
- Supports many audio/video formats (mp3, wav, m4a, mp4, webm, etc.)

Example usage:
- Transcribe from vault: casedev_transcribe with vault_id="vault_abc" object_id="obj_123"
- Transcribe from public URL: casedev_transcribe with audio_url="https://example.com/deposition.mp3"`,
  parameters: z.object({
    vault_id: z
      .string()
      .optional()
      .describe("Vault ID containing the audio file (use with object_id for vault-based mode)"),
    object_id: z
      .string()
      .optional()
      .describe("Object ID of the audio file in the vault (use with vault_id)"),
    audio_url: z
      .string()
      .optional()
      .describe("URL of the audio file to transcribe (for direct URL mode, no auto-storage)"),
    format: z
      .enum(["json", "text"])
      .optional()
      .describe("Output format when using vault mode. Defaults to 'json'"),
    language_code: z
      .string()
      .optional()
      .describe("Language code (e.g., 'en_us', 'es', 'fr'). Auto-detected if not specified"),
    speaker_labels: z
      .boolean()
      .optional()
      .describe("Enable speaker identification and labeling. Defaults to false"),
    speakers_expected: z
      .number()
      .optional()
      .describe("Expected number of speakers (improves accuracy when known)"),
    word_boost: z
      .array(z.string())
      .optional()
      .describe("Custom vocabulary words to boost (e.g., legal terms, names)"),
  }),
  async execute(params, ctx) {
    // Validate mode
    const isVaultMode = params.vault_id && params.object_id
    if (!isVaultMode && !params.audio_url) {
      return {
        title: "Error: Missing parameters",
        metadata: { error: true },
        output: `Either vault_id + object_id OR audio_url is required.

Vault mode (recommended):
- vault_id: The vault containing your audio file
- object_id: The object ID of the audio file

Direct URL mode:
- audio_url: Public URL to the audio file`,
      }
    }

    ctx.metadata({
      title: `Transcribing audio...`,
      metadata: { status: "submitting" },
    })

    // Build request body
    const body: Record<string, unknown> = {}

    if (isVaultMode) {
      body.vault_id = params.vault_id
      body.object_id = params.object_id
      body.format = params.format ?? "json"
    } else {
      body.audio_url = params.audio_url
    }

    // Add optional parameters
    if (params.language_code) body.language_code = params.language_code
    if (params.speaker_labels !== undefined) body.speaker_labels = params.speaker_labels
    if (params.speakers_expected) body.speakers_expected = params.speakers_expected
    if (params.word_boost) body.word_boost = params.word_boost

    // Submit transcription job
    const response = await CaseDevClient.request<TranscriptionResponse>("/voice/transcription", {
      method: "POST",
      body,
      timeout: 30000,
    })

    // For vault mode, the job runs async and results are stored in vault
    if (isVaultMode) {
      return {
        title: `Transcription job started: ${response.id}`,
        metadata: {
          jobId: response.id,
          status: response.status,
          vaultId: params.vault_id,
          objectId: params.object_id,
        },
        output: `Transcription job submitted.

Job ID: ${response.id}
Status: ${response.status}
Vault: ${params.vault_id}
Source: ${params.object_id}

The transcription is processing asynchronously. When complete:
- Results will be saved to the vault
- Use casedev_transcribe_status with job_id="${response.id}" to check progress`,
      }
    }

    // For direct URL mode, also returns async job
    return {
      title: `Transcription job started: ${response.id}`,
      metadata: {
        jobId: response.id,
        status: response.status,
      },
      output: `Transcription job submitted.

Job ID: ${response.id}
Status: ${response.status}
Audio URL: ${params.audio_url}

The transcription is processing. Use casedev_transcribe_status with job_id="${response.id}" to check progress and get results.`,
    }
  },
})

export const TranscribeStatusTool = Tool.define("casedev_transcribe_status", {
  description: `Check the status of a Case.dev transcription job and get results when complete.

Returns the current status and, when completed, the full transcript with timestamps and speaker labels.`,
  parameters: z.object({
    job_id: z.string().describe("The transcription job ID returned from casedev_transcribe"),
  }),
  async execute(params, ctx) {
    const response = await CaseDevClient.request<TranscriptionResponse>(
      `/voice/transcription/${params.job_id}`,
    )

    const statusEmoji: Record<string, string> = {
      queued: "⏳",
      processing: "🔄",
      completed: "✅",
      error: "❌",
    }

    let output = `Transcription Status: ${statusEmoji[response.status] ?? "❓"} ${response.status}\n`
    output += `Job ID: ${response.id}\n`

    if (response.audio_duration) {
      output += `Duration: ${formatDuration(response.audio_duration)}\n`
    }
    if (response.language_code) {
      output += `Language: ${response.language_code}\n`
    }

    if (response.status === "completed") {
      output += `\n--- Transcript ---\n\n`

      if (response.utterances && response.utterances.length > 0) {
        // Format with timestamps and speakers
        for (const utterance of response.utterances) {
          const timestamp = formatTimestamp(utterance.start)
          output += `${timestamp} [${utterance.speaker}]: ${utterance.text}\n`
        }
      } else if (response.text) {
        output += response.text
      }
    } else if (response.status === "error") {
      output += `\nThe transcription failed. Please try again or contact support.`
    } else {
      output += `\nTranscription is still processing. Check back in a moment.`
    }

    return {
      title: `Transcription: ${response.status}`,
      metadata: {
        jobId: params.job_id,
        status: response.status,
        duration: response.audio_duration,
        language: response.language_code,
      },
      output,
    }
  },
})

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `[${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}]`
  }
  return `[${minutes}:${secs.toString().padStart(2, "0")}]`
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }
  return `${secs}s`
}
