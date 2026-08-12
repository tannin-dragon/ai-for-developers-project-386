import { Hono } from "hono"
import { ownerAuth, readJson } from "../http.js"
import type { Store } from "../store.js"
import type { Weekday } from "../types.js"
import { ownerProfileUpdateSchema, parseWith } from "../validation.js"

/** Профиль владельца: единый, заранее заданный. Обе операции — владельца. */
export function ownerProfileRoutes(store: Store, ownerKey: string): Hono {
  const r = new Hono()
  const auth = ownerAuth(ownerKey)

  r.get("/", auth, (c) => c.json(store.profile))

  r.patch("/", auth, async (c) => {
    const body = parseWith(ownerProfileUpdateSchema, await readJson(c))
    const current = store.profile

    store.profile = {
      name: body.name ?? current.name,
      email: body.email ?? current.email,
      timezone: body.timezone ?? current.timezone,
      workSchedule: body.workSchedule
        ? {
            // Дедупликация + сортировка — детерминированный график для слотов.
            weekdays: [...new Set(body.workSchedule.weekdays)].sort((a, b) => a - b) as Weekday[],
            startTime: body.workSchedule.startTime,
            endTime: body.workSchedule.endTime,
          }
        : current.workSchedule,
    }
    return c.json(store.profile)
  })

  return r
}
