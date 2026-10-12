// Typen für die Tests (api/_notify.js ist reines JS für die Serverless-Funktionen).
export const NOTIFY_DEFAULTS: Record<string, { on: boolean; time?: string; days?: number[] }>
export const NOTIFY_KINDS: string[]
export function normalizeNotify(raw: unknown): Record<string, { on: boolean; time?: string; days?: number[] }>
export function localNow(tz: string | null | undefined, now?: Date): { date: string; min: number; weekday: number }
export function inWindow(nowMin: number, targetMin: number | null): boolean
export function dueKinds(notify: Record<string, { on: boolean; time?: string; days?: number[] }>, local: { date: string; min: number; weekday: number }): string[]
export function fastingDue(fasting: string, fastingStart: string, local: { min: number }): 'open' | 'close' | null
export function message(kind: string, ctx?: Record<string, unknown>, seed?: number): { title: string; body: string; url: string } | null
