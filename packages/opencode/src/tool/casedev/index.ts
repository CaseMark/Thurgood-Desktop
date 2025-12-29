// Case.dev API Tools for Thurgood Desktop
// These tools provide access to Case.dev's legal AI infrastructure

export { CaseDevClient } from "./client"

// OCR Tools
export { OcrProcessTool, OcrStatusTool, OcrDownloadTool } from "./ocr"

// Voice/Transcription Tools
export { TranscribeTool, TranscribeStatusTool } from "./transcribe"

// Vault (RAG) Tools
export {
  VaultCreateTool,
  VaultListTool,
  VaultUploadTool,
  VaultSearchTool,
  VaultIngestTool,
  VaultObjectsListTool,
  VaultObjectTextTool,
  VaultObjectDownloadTool,
} from "./vault"

// Web Search Tool
export { LegalSearchTool } from "./search"

// Document Format Tool
export { FormatDocumentTool } from "./format"

// All tools as an array for easy registration
import { OcrProcessTool, OcrStatusTool, OcrDownloadTool } from "./ocr"
import { TranscribeTool, TranscribeStatusTool } from "./transcribe"
import {
  VaultCreateTool,
  VaultListTool,
  VaultUploadTool,
  VaultSearchTool,
  VaultIngestTool,
  VaultObjectsListTool,
  VaultObjectTextTool,
  VaultObjectDownloadTool,
} from "./vault"
import { LegalSearchTool } from "./search"
import { FormatDocumentTool } from "./format"

export const CaseDevTools = [
  OcrProcessTool,
  OcrStatusTool,
  OcrDownloadTool,
  TranscribeTool,
  TranscribeStatusTool,
  VaultCreateTool,
  VaultListTool,
  VaultUploadTool,
  VaultSearchTool,
  VaultIngestTool,
  VaultObjectsListTool,
  VaultObjectTextTool,
  VaultObjectDownloadTool,
  LegalSearchTool,
  FormatDocumentTool,
]
