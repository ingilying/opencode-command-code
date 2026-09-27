import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

import { Model, Plugin, Provider } from "@opencode/plugin"

const PROVIDER_ID = "command-code"
const PROVIDER_NAME = "Command Code"
const DEFAULT_BASE_URL = "https://api.commandcode.ai/provider/v1"
const OPENAI_PACKAGE = "@opencode/ai/providers/openai-compatible"
const AUTH_FILE = join(homedir(), ".commandcode", "auth.json")
const REFRESH_INTERVAL_MS = 60 * 60 * 1000
const DEFAULT_CONTEXT_WINDOW = 200_000
const DEFAULT_MAX_OUTPUT = 32_000

type CatalogEntry = {
  id: string
  name?: string
  context_length?: number
  supported_endpoints?: string[]
}

function text(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

async function apiKeyFromAuthFile() {
  try {
    const auth = JSON.parse(await readFile(AUTH_FILE, "utf8")) as { apiKey?: unknown }
    return text(auth.apiKey)
  } catch {
    return undefined
  }
}

async function fetchCatalog(baseURL: string, apiKey: string) {
  const response = await fetch(`${baseURL.replace(/\/+$/, "")}/models`, {
    headers: { authorization: `Bearer ${apiKey}` },
  })
  if (!response.ok) {
    throw new Error(`Command Code /models failed: ${response.status} ${response.statusText}`)
  }
  const body = (await response.json()) as { data?: CatalogEntry[] }
  return Array.isArray(body.data) ? body.data : []
}

// Models that only speak the Anthropic Messages wire are left out.
function openAICompatible(entry: CatalogEntry) {
  return entry.supported_endpoints === undefined || entry.supported_endpoints.includes("/chat/completions")
}

function toModel(entry: CatalogEntry, providerID: typeof Provider.ID.Type): Model.Info {
  return {
    ...Model.Info.default(providerID, Model.ID.make(entry.id)),
    name: entry.name ?? entry.id,
    limit: {
      context: entry.context_length ?? DEFAULT_CONTEXT_WINDOW,
      output: DEFAULT_MAX_OUTPUT,
    },
  }
}

export default Plugin.define({
  id: PROVIDER_ID,
  async setup(ctx) {
    const baseURL = text(ctx.options.baseURL) ?? process.env.COMMAND_CODE_BASE_URL ?? DEFAULT_BASE_URL
    const apiKey = text(ctx.options.apiKey) ?? process.env.COMMAND_CODE_API_KEY ?? (await apiKeyFromAuthFile())

    if (!apiKey) {
      console.error(
        "[command-code] no API key found. Run `cmd login`, set COMMAND_CODE_API_KEY, or set the apiKey plugin option.",
      )
      return
    }

    const providerID = Provider.ID.make(PROVIDER_ID)
    const catalog: { models: Model.Info[] } = { models: [] }

    await ctx.provider.transform((editor) => {
      editor.add({
        info: {
          ...Provider.Info.empty(providerID),
          name: PROVIDER_NAME,
          activation: "enabled",
          package: OPENAI_PACKAGE,
          settings: { baseURL, apiKey },
        },
        models: catalog.models,
      })
    })

    const refresh = async () => {
      catalog.models = (await fetchCatalog(baseURL, apiKey))
        .filter(openAICompatible)
        .map((entry) => toModel(entry, providerID))
      await ctx.provider.reload()
    }

    try {
      await refresh()
      console.error(`[command-code] registered ${catalog.models.length} models from ${baseURL}`)
    } catch (error) {
      console.error(`[command-code] ${error instanceof Error ? error.message : String(error)}`)
    }

    const timer = setInterval(() => {
      void refresh().catch((error) => {
        console.error(`[command-code] refresh failed: ${error instanceof Error ? error.message : String(error)}`)
      })
    }, REFRESH_INTERVAL_MS)

    return () => clearInterval(timer)
  },
})
