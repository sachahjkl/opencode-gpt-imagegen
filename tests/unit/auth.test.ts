import { describe, expect, test } from "bun:test"
import { loadOpenAIAuth } from "../../src/auth"

type IntegrationContext = Parameters<typeof loadOpenAIAuth>[0]

function integration(active: unknown, credential: unknown): IntegrationContext {
  return {
    connection: {
      active: async () => active,
      resolve: async () => credential,
    },
  } as IntegrationContext
}

describe("loadOpenAIAuth", () => {
  test("returns undefined when no OpenAI connection is active", async () => {
    expect(await loadOpenAIAuth(integration(undefined, undefined))).toBeUndefined()
  })

  test("returns undefined when the active connection has no credential", async () => {
    expect(await loadOpenAIAuth(integration({ id: "connection" }, undefined))).toBeUndefined()
  })

  test("returns undefined for a key credential", async () => {
    expect(await loadOpenAIAuth(integration({ id: "connection" }, { type: "key", key: "secret" }))).toBeUndefined()
  })

  test("returns an OAuth access token and account ID", async () => {
    const auth = await loadOpenAIAuth(
      integration(
        { id: "connection" },
        {
          type: "oauth",
          methodID: "browser",
          refresh: "refresh",
          access: "access",
          expires: Date.now() + 60_000,
          metadata: { accountID: "account" },
        },
      ),
    )

    expect(auth).toEqual({ type: "oauth", access: "access", accountID: "account" })
  })

  test("omits a non-string account ID", async () => {
    const auth = await loadOpenAIAuth(
      integration(
        { id: "connection" },
        {
          type: "oauth",
          methodID: "browser",
          refresh: "refresh",
          access: "access",
          expires: Date.now() + 60_000,
          metadata: { accountID: 123 },
        },
      ),
    )

    expect(auth).toEqual({ type: "oauth", access: "access" })
  })

  test("resolves the active connection for each request", async () => {
    let activeCalls = 0
    let resolveCalls = 0
    const context = {
      connection: {
        active: async (integrationID: string) => {
          expect(integrationID).toBe("openai")
          activeCalls += 1
          return { id: "connection" }
        },
        resolve: async () => {
          resolveCalls += 1
          return {
            type: "oauth",
            methodID: "browser",
            refresh: "refresh",
            access: "access",
            expires: Date.now() + 60_000,
          }
        },
      },
    } as unknown as IntegrationContext

    await loadOpenAIAuth(context)
    await loadOpenAIAuth(context)

    expect(activeCalls).toBe(2)
    expect(resolveCalls).toBe(2)
  })

  test("propagates credential resolution errors", async () => {
    const context = {
      connection: {
        active: async () => ({ id: "connection" }),
        resolve: async () => {
          throw new Error("refresh failed")
        },
      },
    } as unknown as IntegrationContext

    expect(loadOpenAIAuth(context)).rejects.toThrow("refresh failed")
  })
})
