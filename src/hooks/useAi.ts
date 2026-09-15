import { useQuery } from '@tanstack/react-query'
import { getAiStatus } from '../lib/ai'

/** Ist die KI serverseitig konfiguriert? Steuert, ob KI-Buttons angezeigt werden. */
export function useAiStatus() {
  return useQuery({
    queryKey: ['ai', 'status'],
    queryFn: getAiStatus,
    staleTime: 1000 * 60 * 10,
    retry: false,
  })
}
