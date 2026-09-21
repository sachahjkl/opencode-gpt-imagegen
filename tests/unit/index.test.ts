import { afterEach, describe, expect, mock, test } from "bun:test"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import plugin from "../../src/index"

type PluginContext = Parameters<typeof plugin.setup>[0]
type RegisteredTool = {
  name: string
  input: {
    properties: Record<string, unknown>
    required: readonly string[]
    additionalProperties: boolean
  }
  execute: (
    input: unknown,
    context: { signal: AbortSignal },
  ) => Promise<{
    content?: string | readonly unknown[]
    metadata?: Record<string, unknown>
  }>
}

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

async function registerTool(directory: string, credential: unknown): Promise<RegisteredTool> {
  let registered: RegisteredTool | undefined
  const context = {
    location: { directory },
    integration: {
      connection: {
        active: async () => ({ id: "connection" }),
        resolve: async () => credential,
      },
    },
    tool: {
      transform: async (transform: (editor: { add: (tool: RegisteredTool) => void }) => void) => {
        transform({
          add(tool) {
            registered = tool
          },
        })
        return { dispose: async () => {} }
      },
    },
  } as unknown as PluginContext

  await plugin.setup(context)
  if (!registered) throw new Error("plugin did not register a tool")
  return registered
}

describe("OpenCode V2 plugin", () => {
  test("exports a stable V2 plugin definition", () => {
    expect(plugin.id).toBe("opencode-gpt-imagegen")
    expect(plugin.setup).toBeFunction()
    expect(plugin).not.toHaveProperty("server")
  })

  test("registers gpt_imagegen with a strict JSON Schema", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "imagegen-plugin-"))
    try {
      const tool = await registerTool(directory, undefined)
      expect(tool.name).toBe("gpt_imagegen")
      expect(Object.keys(tool.input.properties)).toEqual(["prompt", "out", "quality", "size", "images"])
      expect(tool.input.required).toEqual(["prompt", "out", "quality"])
      expect(tool.input.additionalProperties).toBe(false)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("uses V2 credentials, the plugin directory, and the cancellation signal", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "imagegen-plugin-"))
    const controller = new AbortController()
    const image = Buffer.from("generated image")
    const event = {
      type: "response.output_item.done",
      item: { type: "image_generation_call", result: image.toString("base64") },
    }
    const fetchMock = mock(async (_url: string, init: RequestInit) => {
      expect(init.signal).toBe(controller.signal)
      return new Response(`data: ${JSON.stringify(event)}\n\n`)
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const tool = await registerTool(directory, {
        type: "oauth",
        methodID: "browser",
        refresh: "refresh",
        access: "access",
        expires: Date.now() + 60_000,
        metadata: { accountID: "account" },
      })
      const result = await tool.execute(
        { prompt: "a cat", out: "cat.png", quality: "medium" },
        { signal: controller.signal },
      )

      const output = path.join(directory, "cat.png")
      expect(await readFile(output)).toEqual(image)
      expect(result.content).toContain(output)
      expect(result.metadata).toEqual({ out: output, versioned: false, billing: "subscription" })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
