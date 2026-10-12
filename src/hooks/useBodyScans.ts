import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { BodyScan, ScanConfidence } from '../lib/bodyScan'

const BUCKET = 'body-photos'

/** Fehlt die Tabelle noch (Migration 0031 nicht ausgeführt)? */
function isMissingTable(e: { code?: string; message?: string } | null): boolean {
  return !!e && (e.code === '42P01' || e.code === 'PGRST205' || /body_scans/.test(e.message ?? ''))
}

export function useBodyScans() {
  return useQuery({
    queryKey: ['body_scans'],
    queryFn: async (): Promise<BodyScan[]> => {
      const { data, error } = await supabase.from('body_scans').select('*').order('date', { ascending: true })
      if (error) {
        if (isMissingTable(error)) return []
        throw error
      }
      return data as BodyScan[]
    },
  })
}

/** Kurzlebige Links zu den privaten Fotos (1 h gültig, werden vorher erneuert). */
export function usePhotoUrls(paths: string[]) {
  const key = [...paths].sort()
  return useQuery({
    queryKey: ['body_photo_urls', key],
    enabled: key.length > 0,
    staleTime: 1000 * 60 * 50,
    // Fotos nicht in den persistierten Cache schreiben (Links laufen ab)
    meta: { persist: false },
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(key, 3600)
      if (error) throw error
      const out: Record<string, string> = {}
      for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl
      return out
    },
  })
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}

export interface NewScan {
  date: string
  /** Data-URL des Fotos; ohne = nur Werte speichern */
  photo?: string | null
  bf_low: number | null
  bf_high: number | null
  weight_kg: number | null
  confidence: ScanConfidence | null
  source: 'ai' | 'manual'
}

export function useAddBodyScan() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async ({ photo, ...row }: NewScan) => {
      let photo_path: string | null = null
      if (photo) {
        photo_path = `${user!.id}/${row.date}-${crypto.randomUUID().slice(0, 8)}.jpg`
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(photo_path, await dataUrlToBlob(photo), { contentType: 'image/jpeg', upsert: false })
        if (error)
          throw new Error('Foto konnte nicht gespeichert werden. Ist die Datenbank-Erweiterung (0031) eingerichtet?')
      }
      const { data, error } = await supabase
        .from('body_scans')
        .insert({ ...row, photo_path, user_id: user!.id })
        .select()
        .single()
      if (error) {
        if (photo_path) await supabase.storage.from(BUCKET).remove([photo_path])
        throw isMissingTable(error) ? new Error('Die Datenbank-Erweiterung (0031) fehlt noch.') : error
      }
      return data as BodyScan
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['body_scans'] }),
  })
}

/** Messung löschen – das Foto wird dabei endgültig aus dem Speicher entfernt. */
export function useDeleteBodyScan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (scan: BodyScan) => {
      if (scan.photo_path) {
        const { error } = await supabase.storage.from(BUCKET).remove([scan.photo_path])
        if (error) throw error
      }
      const { error } = await supabase.from('body_scans').delete().eq('id', scan.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['body_scans'] }),
  })
}
