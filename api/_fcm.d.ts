// Typen für die Tests (api/_fcm.js ist reines JS für die Serverless-Funktionen).
export interface ServiceAccount {
  project_id: string
  client_email: string
  private_key: string
}
export interface PushSub {
  endpoint: string
  platform?: string | null
  local_until?: string | null
}
export function readServiceAccount(raw: unknown): ServiceAccount | null
export function serviceJwt(sa: ServiceAccount, nowSec?: number): string
export function fcmMessage(
  token: string,
  payload: { title?: string; body?: string; tag?: string; url?: string },
): {
  message: {
    token: string
    notification: { title: string; body: string }
    data: Record<string, string>
    android: { priority: string; notification: Record<string, string> }
  }
}
export function isFcmSub(sub: PushSub): boolean
export function fcmToken(sub: PushSub): string
export function serverSends(sub: PushSub, kind: string, today: string): boolean
export function sendFcm(
  sa: ServiceAccount,
  token: string,
  payload: object,
): Promise<{ ok: boolean; gone: boolean; status: number }>
