import type { Plugin } from "@opencode/plugin"
import type { OpenAIAuth } from "./types"

type IntegrationContext = Pick<Plugin.Context["integration"], "connection">

export async function loadOpenAIAuth(integration: IntegrationContext): Promise<OpenAIAuth | undefined> {
  const connection = await integration.connection.active("openai")
  if (!connection) return undefined

  const credential = await integration.connection.resolve(connection)
  if (credential?.type !== "oauth" || typeof credential.access !== "string") return undefined

  const accountID = credential.metadata?.accountID
  return {
    type: "oauth",
    access: credential.access,
    ...(typeof accountID === "string" ? { accountID } : {}),
  }
}
