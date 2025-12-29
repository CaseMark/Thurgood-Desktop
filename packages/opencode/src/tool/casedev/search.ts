import z from "zod"
import { Tool } from "../tool"
import { CaseDevClient } from "./client"

interface ResearchResponse {
  researchId: string
  model: string
  results: {
    summary?: string
    sources?: string[]
    analysis?: string
    [key: string]: unknown
  }
}

export const LegalSearchTool = Tool.define("casedev_search", {
  description: `Perform deep web research using Case.dev Search API.

This tool conducts comprehensive multi-step research, gathering information from multiple sources
and providing detailed insights with citations. Ideal for legal research, case analysis, and due diligence.

Research modes:
- fast: Quick results (~30 seconds) - good for simple queries
- normal: Balanced depth (~2 minutes) - recommended for most research
- pro: Deep research (~5 minutes) - comprehensive analysis for complex topics

Example usage:
- Research case law: casedev_search with query="HIPAA breach notification requirements" mode="normal"
- Quick lookup: casedev_search with query="California statute of limitations personal injury" mode="fast"
- Deep research: casedev_search with query="federal court precedents software licensing damages" mode="pro"`,
  parameters: z.object({
    query: z.string().describe("The research question or search query"),
    mode: z
      .enum(["fast", "normal", "pro"])
      .optional()
      .describe("Research depth: fast (~30s), normal (~2min), or pro (~5min). Defaults to 'normal'"),
  }),
  async execute(params, ctx) {
    ctx.metadata({
      title: `Researching: ${params.query.slice(0, 40)}...`,
      metadata: { mode: params.mode, status: "searching" },
    })

    // For pro mode, we need longer timeout
    const timeout = params.mode === "pro" ? 360000 : params.mode === "normal" ? 180000 : 60000

    const response = await CaseDevClient.request<ResearchResponse>("/search/v1/research", {
      method: "POST",
      body: {
        instructions: params.query,
        model: params.mode ?? "normal",
      },
      timeout,
    })

    if (!response.results) {
      return {
        title: "No results found",
        metadata: {
          query: params.query,
          mode: params.mode,
          resultCount: 0,
        },
        output: `No results found for: "${params.query}"

Try:
- Rephrasing your query
- Using more specific legal terms
- Breaking complex questions into simpler parts`,
      }
    }

    let output = `Research results for: "${params.query}"\n`
    output += `Mode: ${response.model}\n`
    output += `Research ID: ${response.researchId}\n\n`

    // Show summary if available
    if (response.results.summary) {
      output += `--- Summary ---\n${response.results.summary}\n\n`
    }

    // Show analysis if available
    if (response.results.analysis) {
      output += `--- Analysis ---\n${response.results.analysis}\n\n`
    }

    // Show sources if available
    if (response.results.sources && response.results.sources.length > 0) {
      output += `--- Sources ---\n`
      for (const source of response.results.sources) {
        output += `• ${source}\n`
      }
    }

    // Show any other results
    const knownKeys = ["summary", "sources", "analysis"]
    for (const [key, value] of Object.entries(response.results)) {
      if (!knownKeys.includes(key) && value) {
        output += `\n--- ${key.charAt(0).toUpperCase() + key.slice(1)} ---\n`
        if (typeof value === "string") {
          output += `${value}\n`
        } else if (Array.isArray(value)) {
          for (const item of value) {
            output += `• ${typeof item === "string" ? item : JSON.stringify(item)}\n`
          }
        } else {
          output += `${JSON.stringify(value, null, 2)}\n`
        }
      }
    }

    return {
      title: `Research complete: "${params.query.slice(0, 30)}..."`,
      metadata: {
        query: params.query,
        mode: response.model,
        researchId: response.researchId,
      },
      output,
    }
  },
})
