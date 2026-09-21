export type OpenAIAuth = { type: "oauth"; access: string; accountID?: string }

export type GenerateArgs = {
  prompt: string
  out: string
  quality: "low" | "medium" | "high" | "auto"
  size?: string
  images?: string[]
}
