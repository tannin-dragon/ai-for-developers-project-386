import { useEffect, useState } from "react"
import { callTypesApi } from "@/api/endpoints"
import type { CallType, Slot } from "@/api/types"

/** Загрузка свободных слотов для выбранного типа. */
export function useSlots(callType: CallType | null) {
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!callType) {
      setSlots([])
      setError(null)
      return
    }

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const now = new Date()
        const from = now.toISOString()
        const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
        const res = await callTypesApi.listSlots(callType.id, from, to)
        if (!cancelled) setSlots(res)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Не удалось загрузить слоты")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [callType])

  return { slots, loading, error }
}