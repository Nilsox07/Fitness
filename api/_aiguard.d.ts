export const TOPIC_GUARD: string
export const LIMITS: {
  promptChars: number
  systemChars: number
  images: number
  imageChars: number
  maxTokens: number
  perMinute: number
  perDay: number
}
export function sanitizeRequest(body: unknown): {
  error?: string
  req?: {
    system: string
    prompt: string
    json: boolean
    temperature?: number
    image?: string
    images?: string[]
    maxTokens?: number
  }
}
export function quotaError(c: { lastMinute: number; today: number; unlimited: boolean }): string | null
export function envList(v: string | undefined): string[]
