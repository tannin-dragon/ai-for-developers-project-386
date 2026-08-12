import { Hono } from "hono"
import { problems } from "../errors.js"
import { ownerAuth, readJson } from "../http.js"
import { hasActiveBookings } from "../rules.js"
import { generateSlots, toApiTime } from "../slots.js"
import { activeBookings, type Store } from "../store.js"
import type { CallType, Slot } from "../types.js"
import {
  callTypeCreateSchema,
  callTypeFieldCode,
  callTypeUpdateSchema,
  parseWith,
  slotsQueryCode,
  slotsQuerySchema,
} from "../validation.js"

/** Типы звонков: список/слоты — гостевые; create/update/delete — владелец. */
export function callTypesRoutes(store: Store, ownerKey: string): Hono {
  const r = new Hono()
  const auth = ownerAuth(ownerKey)

  r.get("/", (c) => c.json({ items: [...store.callTypes.values()] }))

  r.post("/", auth, async (c) => {
    const body = parseWith(callTypeCreateSchema, await readJson(c), callTypeFieldCode)
    const callType: CallType = { id: crypto.randomUUID(), ...body }
    store.callTypes.set(callType.id, callType)
    return c.json(callType)
  })

  r.patch("/:id", auth, async (c) => {
    const existing = store.callTypes.get(c.req.param("id"))
    if (!existing) throw problems.callTypeNotFound()
    const body = parseWith(callTypeUpdateSchema, await readJson(c), callTypeFieldCode)
    const updated: CallType = { ...existing, ...body }
    store.callTypes.set(updated.id, updated)
    return c.json(updated)
  })

  r.delete("/:id", auth, (c) => {
    const id = c.req.param("id")
    if (!store.callTypes.has(id)) throw problems.callTypeNotFound()
    if (hasActiveBookings(store, id, new Date())) throw problems.callTypeHasActiveBookings()
    store.callTypes.delete(id)
    return c.body(null, 204)
  })

  r.get("/:id/slots", (c) => {
    const callType = store.callTypes.get(c.req.param("id"))
    if (!callType) throw problems.callTypeNotFound()
    const query = parseWith(slotsQuerySchema, c.req.query(), slotsQueryCode)

    const busy = [
      ...activeBookings(store).map((b) => ({
        startMs: Date.parse(b.startTime),
        endMs: Date.parse(b.endTime),
      })),
      ...[...store.blockedSlots.values()].map((s) => ({
        startMs: Date.parse(s.startTime),
        endMs: Date.parse(s.endTime),
      })),
    ]
    const slots = generateSlots({
      durationMinutes: callType.durationMinutes,
      slotStepMinutes: callType.slotStepMinutes,
      schedule: store.profile.workSchedule,
      timezone: store.profile.timezone,
      now: new Date(),
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      busy,
    })
    const body: Slot[] = slots.map((s) => ({
      startTime: toApiTime(s.startMs),
      endTime: toApiTime(s.endMs),
    }))
    return c.json(body)
  })

  return r
}
