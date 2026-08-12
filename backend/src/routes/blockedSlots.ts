import { Hono } from "hono"
import { problems } from "../errors.js"
import { ownerAuth, readJson } from "../http.js"
import { validateBlockedSlot } from "../rules.js"
import { toApiTime } from "../slots.js"
import type { Store } from "../store.js"
import type { BlockedSlot } from "../types.js"
import { blockedSlotCreateSchema, parseWith } from "../validation.js"

/** Блокировки времени: глобальны для всех типов звонков, все операции — владельца. */
export function blockedSlotsRoutes(store: Store, ownerKey: string): Hono {
  const r = new Hono()
  const auth = ownerAuth(ownerKey)

  r.get("/", auth, (c) => {
    const items = [...store.blockedSlots.values()].sort(
      (a, b) => Date.parse(a.startTime) - Date.parse(b.startTime),
    )
    return c.json({ items })
  })

  r.post("/", auth, async (c) => {
    const body = parseWith(blockedSlotCreateSchema, await readJson(c))
    const startMs = Date.parse(body.startTime)
    const endMs = Date.parse(body.endTime)

    const problem = validateBlockedSlot(store, startMs, endMs, new Date())
    if (problem) throw problem

    const blocked: BlockedSlot = {
      id: crypto.randomUUID(),
      startTime: toApiTime(startMs),
      endTime: toApiTime(endMs),
      createdAt: new Date().toISOString(),
    }
    if (body.reason !== undefined) blocked.reason = body.reason
    store.blockedSlots.set(blocked.id, blocked)
    return c.json(blocked)
  })

  r.delete("/:id", auth, (c) => {
    if (!store.blockedSlots.delete(c.req.param("id"))) throw problems.blockedSlotNotFound()
    return c.body(null, 204)
  })

  return r
}
