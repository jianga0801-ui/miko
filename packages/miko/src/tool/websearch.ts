import { Effect, Schema } from "effect"
import { HttpClient, HttpClientRequest } from "effect/unstable/http"
import * as Tool from "./tool"
import * as McpWebSearch from "./mcp-websearch"
import DESCRIPTION from "./websearch.txt"
import { checksum } from "@miko-ai/core/util/encode"
import { InstallationVersion } from "@miko-ai/core/installation/version"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { Auth } from "../auth"

export function resolveTavilyKey(stored?: { type: string; key?: string }): string | undefined {
  if (process.env.TAVILY_API_KEY) return process.env.TAVILY_API_KEY
  if (stored?.type === "api" && stored.key) return stored.key
  return undefined
}

export const Parameters = Schema.Struct({
  query: Schema.String.annotate({ description: "Websearch query" }),
  numResults: Schema.optional(Schema.Number).annotate({
    description: "Number of search results to return (default: 8)",
  }),
  livecrawl: Schema.optional(Schema.Literals(["fallback", "preferred"])).annotate({
    description:
      "Live crawl mode - 'fallback': use live crawling as backup if cached content unavailable, 'preferred': prioritize live crawling (default: 'fallback')",
  }),
  type: Schema.optional(Schema.Literals(["auto", "fast", "deep"])).annotate({
    description: "Search type - 'auto': balanced search (default), 'fast': quick results, 'deep': comprehensive search",
  }),
  contextMaxCharacters: Schema.optional(Schema.Number).annotate({
    description: "Maximum characters for context string optimized for LLMs (default: 10000)",
  }),
})

const WebSearchProviderSchema = Schema.Literals(["exa", "parallel", "tavily"])
export type WebSearchProvider = Schema.Schema.Type<typeof WebSearchProviderSchema>

export interface WebSearchFlags {
  exa?: boolean
  parallel?: boolean
  tavily?: boolean
}

export function selectWebSearchProvider(sessionID: string, flags: WebSearchFlags = {}): WebSearchProvider {
  const override = process.env.MIKO_WEBSEARCH_PROVIDER
  if (override === "exa" || override === "parallel" || override === "tavily") return override
  // An explicitly configured Tavily key takes precedence — it's the deliberate
  // backend choice for providers (like MiMo) without a usable built-in search.
  if (flags.tavily) return "tavily"
  if (flags.parallel) return "parallel"
  if (flags.exa) return "exa"

  return Number.parseInt(checksum(sessionID) ?? "0", 36) % 2 === 0 ? "exa" : "parallel"
}

export function webSearchProviderLabel(provider: unknown) {
  if (provider === "parallel") return "Parallel Web Search"
  if (provider === "exa") return "Exa Web Search"
  if (provider === "tavily") return "Tavily Web Search"
  return "Web Search"
}

export function webSearchModelName(extra: Tool.Context["extra"]) {
  const model = extra?.model
  if (!model || typeof model !== "object") return undefined
  const api = "api" in model && model.api && typeof model.api === "object" ? model.api : undefined
  const apiID = api && "id" in api && typeof api.id === "string" ? api.id : undefined
  const id = "id" in model && typeof model.id === "string" ? model.id : undefined
  return (apiID ?? id)?.slice(0, 100)
}

function parallelAuthHeaders() {
  const headers = { "User-Agent": `miko/${InstallationVersion}` }
  if (!process.env.PARALLEL_API_KEY) return headers
  return { ...headers, Authorization: `Bearer ${process.env.PARALLEL_API_KEY}` }
}

const TAVILY_URL = "https://api.tavily.com/search"

/**
 * Format a Tavily `/search` response into an LLM-friendly text block: the
 * optional synthesized answer followed by numbered title/url/snippet entries.
 */
export function formatTavilyResponse(body: string, maxCharacters?: number): string {
  let data: any
  try {
    data = JSON.parse(body)
  } catch {
    return body
  }
  const parts: string[] = []
  if (typeof data?.answer === "string" && data.answer.trim()) parts.push(`Answer: ${data.answer.trim()}`)
  const results = Array.isArray(data?.results) ? data.results : []
  results.forEach((r: any, i: number) => {
    const title = typeof r?.title === "string" ? r.title : "(untitled)"
    const url = typeof r?.url === "string" ? r.url : ""
    const content = typeof r?.content === "string" ? r.content : ""
    parts.push([`[${i + 1}] ${title}`, url, content].filter(Boolean).join("\n"))
  })
  const out = parts.join("\n\n") || "No search results found."
  const limit = maxCharacters ?? 10000
  return out.length > limit ? out.slice(0, limit) : out
}

function callTavily(http: HttpClient.HttpClient, params: Schema.Schema.Type<typeof Parameters>, apiKey: string) {
  return Effect.gen(function* () {
    const request = yield* HttpClientRequest.post(TAVILY_URL).pipe(
      HttpClientRequest.setHeaders({ Authorization: `Bearer ${apiKey}` }),
      HttpClientRequest.bodyJson({
        query: params.query,
        max_results: params.numResults ?? 8,
        search_depth: params.type === "deep" ? "advanced" : "basic",
        include_answer: true,
        topic: "general",
      }),
    )
    const response = yield* HttpClient.filterStatusOk(http)
      .execute(request)
      .pipe(
        Effect.timeoutOrElse({
          duration: "25 seconds",
          orElse: () => Effect.die(new Error("tavily request timed out")),
        }),
      )
    const body = yield* response.text
    return formatTavilyResponse(body, params.contextMaxCharacters)
  })
}

function callProvider(
  http: HttpClient.HttpClient,
  provider: WebSearchProvider,
  params: Schema.Schema.Type<typeof Parameters>,
  ctx: Tool.Context,
  tavilyKey: string,
) {
  if (provider === "tavily") {
    return callTavily(http, params, tavilyKey)
  }

  if (provider === "parallel") {
    return McpWebSearch.call(
      http,
      McpWebSearch.PARALLEL_URL,
      "web_search",
      McpWebSearch.ParallelSearchArgs,
      {
        objective: params.query,
        search_queries: [params.query],
        session_id: ctx.sessionID,
        model_name: webSearchModelName(ctx.extra),
      },
      "25 seconds",
      parallelAuthHeaders(),
    )
  }

  return McpWebSearch.call(
    http,
    McpWebSearch.EXA_URL,
    "web_search_exa",
    McpWebSearch.SearchArgs,
    {
      query: params.query,
      type: params.type || "auto",
      numResults: params.numResults || 8,
      livecrawl: params.livecrawl || "fallback",
      contextMaxCharacters: params.contextMaxCharacters,
    },
    "25 seconds",
  )
}

export const WebSearchTool = Tool.define(
  "websearch",
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient
    const flags = yield* RuntimeFlags.Service
    const auth = yield* Auth.Service

    return {
      get description() {
        return DESCRIPTION.replace("{{year}}", new Date().getFullYear().toString())
      },
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context) =>
        Effect.gen(function* () {
          const storedTavily = yield* auth.get("tavily").pipe(Effect.orElseSucceed(() => undefined))
          const tavilyKey = resolveTavilyKey(storedTavily)
          const provider = selectWebSearchProvider(ctx.sessionID, {
            exa: flags.enableExa,
            parallel: flags.enableParallel,
            tavily: Boolean(tavilyKey),
          })
          const title = webSearchProviderLabel(provider)
          yield* ctx.metadata({ title: `${title} "${params.query}"`, metadata: { provider } })

          yield* ctx.ask({
            permission: "websearch",
            patterns: [params.query],
            always: ["*"],
            metadata: {
              query: params.query,
              numResults: params.numResults,
              livecrawl: params.livecrawl,
              type: params.type,
              contextMaxCharacters: params.contextMaxCharacters,
              provider,
            },
          })

          const result = yield* callProvider(http, provider, params, ctx, tavilyKey ?? "")

          return {
            output: result ?? "No search results found. Please try a different query.",
            title: `${title}: ${params.query}`,
            metadata: { provider },
          }
        }).pipe(Effect.orDie),
    }
  }),
)
