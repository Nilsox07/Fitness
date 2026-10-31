// Dateien teilen bzw. speichern – im Browser per Web-Share oder Download, in der
// Android-App über den Cache + das System-Teilen-Menü (Downloads per <a download>
// funktionieren im WebView nicht).

import { isNative } from './native'

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed'

/** Kurzer Hinweis zum Ergebnis (null = nichts anzeigen). */
export function shareOutcomeText(r: ShareOutcome, what = 'Bild'): string | null {
  if (r === 'downloaded') return `${what} gespeichert – du findest es in deinen Downloads.`
  if (r === 'failed') return `${what} konnte nicht geteilt werden. Versuch es bitte nochmal.`
  return null
}

/** Abbruch im Teilen-Menü (Web: AbortError, Capacitor: „Share canceled“)? */
export function isShareCancel(e: unknown): boolean {
  const name = (e as { name?: string } | null)?.name ?? ''
  const msg = String((e as { message?: string } | null)?.message ?? e ?? '')
  return name === 'AbortError' || /cancel/i.test(msg)
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** Datei teilen (Bild, CSV …). Im Browser: Web-Share mit Datei, sonst Download. */
export async function shareFile(
  blob: Blob,
  filename: string,
  opts: { title?: string; text?: string } = {},
): Promise<ShareOutcome> {
  if (isNative()) {
    try {
      const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share'),
      ])
      const { uri } = await Filesystem.writeFile({
        path: filename,
        data: await blobToBase64(blob),
        directory: Directory.Cache,
      })
      await Share.share({ title: opts.title, text: opts.text, files: [uri], dialogTitle: opts.title })
      return 'shared'
    } catch (e) {
      return isShareCancel(e) ? 'cancelled' : 'failed'
    }
  }

  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean
    share?: (data: { files: File[]; title?: string; text?: string }) => Promise<void>
  }
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: opts.title, text: opts.text })
      return 'shared'
    } catch (e) {
      return isShareCancel(e) ? 'cancelled' : 'failed'
    }
  }
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return 'downloaded'
  } catch {
    return 'failed'
  }
}
