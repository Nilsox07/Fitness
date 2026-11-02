// Typen für die Tests (api/_account.js ist reines JS für die Serverless-Funktionen).
export const USER_BUCKETS: string[]
export const ANALYTICS_SALT: string
export function analyticsHashInput(userId: string): string
export function isUuid(v: unknown): boolean
export function storagePaths(userId: string, files: unknown): string[]
