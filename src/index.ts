import { Plugin } from "@opencode/plugin"
import { loadOpenAIAuth } from "./auth"
import { callViaCodexResponses } from "./codex"
import { readReferenceImages } from "./input-image"
import { saveGeneratedImage } from "./output-image"
import type { GenerateArgs } from "./types"

const description = [
  "Generate raster images using OpenAI's hosted image_generation tool.",
  "Use for AI-created bitmap visuals such as photos, illustrations, textures, sprites, and mockups.",
  "Do not use when the task is better handled by editing existing SVG/vector/code-native assets, extending an established icon or logo system, or building the visual directly in HTML/CSS/canvas.",
  "Reference images may be attached through `images`; label each image's role inline in `prompt`, for example: 'Image 1: reference image'.",
  "For many distinct assets, invoke gpt_imagegen once per requested asset rather than relying on multi-image output; gpt_imagegen returns one image per call.",
  "Requires OpenCode to be authenticated with ChatGPT OAuth. Returns the absolute path of the saved PNG.",
].join(" ")

const inputSchema = {
  type: "object",
  properties: {
    prompt: {
      type: "string",
      description: "Description of the image to generate.",
    },
    out: {
      type: "string",
      description: "Output file path, relative to the project directory unless absolute. The plugin writes a PNG.",
    },
    quality: {
      type: "string",
      enum: ["low", "medium", "high", "auto"],
      description: "Generation quality passed to the hosted image_generation tool.",
    },
    size: {
      type: "string",
      description:
        "Optional image size. Use `auto` or `WIDTHxHEIGHT`; dimensions must be multiples of 16, each edge must not exceed 3840px, the ratio must not exceed 3:1, and the total must contain 655,360 to 8,294,400 pixels.",
    },
    images: {
      type: "array",
      items: { type: "string" },
      description: "Optional reference image paths, relative to the project directory unless absolute.",
    },
  },
  required: ["prompt", "out", "quality"],
  additionalProperties: false,
} as const

export default Plugin.define({
  id: "opencode-gpt-imagegen",
  async setup(ctx) {
    const directory = ctx.location.directory

    await ctx.tool.transform((editor) => {
      editor.add({
        name: "gpt_imagegen",
        description,
        input: inputSchema,
        async execute(input, toolContext) {
          const args = input as GenerateArgs
          const auth = await loadOpenAIAuth(ctx.integration)
          if (!auth) {
            throw new Error("OpenAI ChatGPT OAuth credentials are not configured. Run `opencode2 auth login openai`.")
          }

          const inputImageDataUrls = await readReferenceImages(args.images, directory)
          const signal = (toolContext as typeof toolContext & { readonly signal?: AbortSignal }).signal
          const base64 = await callViaCodexResponses(auth, args, inputImageDataUrls, signal)
          const { savedPath, versioned, message } = await saveGeneratedImage(args.out, directory, base64)

          return {
            content: message,
            metadata: {
              out: savedPath,
              versioned,
              billing: "subscription",
            },
          }
        },
      })
    })
  },
})
