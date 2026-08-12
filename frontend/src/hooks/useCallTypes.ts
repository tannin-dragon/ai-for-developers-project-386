import { useEffect, useState } from "react"
import { callTypesApi } from "@/api/endpoints"
import type { CallType } from "@/api/types"

export function useCallTypes() {
  const [types, setTypes] = useState<CallType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await callTypesApi.list()
      setTypes(res.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось загрузить типы звонков")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return { types, loading, error, reload: load }
}