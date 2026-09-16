import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fitbitStatus, fitbitSync } from '../lib/fitbit'

export function useFitbitStatus() {
  return useQuery({
    queryKey: ['fitbit', 'status'],
    queryFn: fitbitStatus,
    staleTime: 1000 * 60 * 5,
    retry: false,
  })
}

export function useFitbitSync() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fitbitSync,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['body_weights'] })
      qc.invalidateQueries({ queryKey: ['fitbit', 'status'] })
    },
  })
}
