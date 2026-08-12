import { Hono } from "hono"
import { z } from "zod"
import { problems } from "../errors.js"
import { ownerAuth, readJson } from "../http.js"
import { validateBookingSlot } from "../rules.js"
import { toApiTime } from "../slots.js"
import { canonicalJson, type Store } from "../store.js"
import type { Booking, BookingPage } from "../types.js"
import {
  bookingCreateSchema,
  bookingFieldCode,
  bookingsQueryCode,
  bookingsQuerySchema,
  isoDateTime,
  parseWith,
} from "../validation.js"

/**
 * Шаг 1 парсинга тела брони: только то, что нужно для проверки слота.
 * Поля гостя проверяются ПОСЛЕ бизнес-правил — порядок ошибок зафиксирован в контракте.
 */
const bookingSlotSchema = z.object({
  callTypeId: z.string().min(1),
  startTime: isoDateTime,
})

const MINUTE_MS = 60_000

/** Бронирования: list/cancel — владелец; read/create — гость. */
export function bookingsRoutes(store: Store, ownerKey: string): Hono {
  const r = new Hono()
  const auth = ownerAuth(ownerKey)

  r.get("/", auth, (c) => {
    const q = parseWith(bookingsQuerySchema, c.req.query(), bookingsQueryCode)

    // По контракту без фильтров дат — «предстоящие»: неявный from = now.
    const fromMs = q.from ? Date.parse(q.from) : q.to ? undefined : Date.now()
    const toMs = q.to ? Date.parse(q.to) : undefined

    let items = [...store.bookings.values()]
    if (q.callTypeId) items = items.filter((b) => b.callTypeId === q.callTypeId)
    if (q.status) items = items.filter((b) => b.status === q.status)
    if (fromMs !== undefined) items = items.filter((b) => Date.parse(b.startTime) >= fromMs)
    if (toMs !== undefined) items = items.filter((b) => Date.parse(b.startTime) <= toMs)
    items.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime))

    const page: BookingPage = {
      items: items.slice(q.offset, q.offset + q.limit),
      total: items.length,
      limit: q.limit,
      offset: q.offset,
    }
    return c.json(page)
  })

  r.get("/:id", (c) => {
    const booking = store.bookings.get(c.req.param("id"))
    if (!booking) throw problems.bookingNotFound()
    return c.json(booking)
  })

  r.post("/", async (c) => {
    const idempotencyKey = c.req.header("Idempotency-Key")?.trim()
    if (!idempotencyKey) {
      throw problems.validation([
        {
          field: "Idempotency-Key",
          code: "VALIDATION_ERROR",
          message: "Обязательный заголовок Idempotency-Key",
        },
      ])
    }

    // Идемпотентность — до валидации: реплей обязан вернуть исходный ответ,
    // даже если данные с тех пор перестали бы пройти проверки (слот ушёл в прошлое).
    const raw = await readJson(c)
    const bodyHash = canonicalJson(raw)
    const seen = store.idempotency.get(idempotencyKey)
    if (seen) {
      if (seen.bodyHash !== bodyHash) throw problems.idempotencyKeyReused()
      return new Response(JSON.stringify(seen.body), {
        status: seen.status,
        headers: { "Content-Type": "application/json" },
      })
    }

    const slotPart = parseWith(bookingSlotSchema, raw)
    const callType = store.callTypes.get(slotPart.callTypeId)
    if (!callType) throw problems.callTypeNotFound()

    const startMs = Date.parse(slotPart.startTime)
    const now = new Date()
    const slotProblem = validateBookingSlot(store, callType, startMs, now)
    if (slotProblem) throw slotProblem

    // Поля гостя — последний шаг валидации по контракту.
    const body = parseWith(bookingCreateSchema, raw, bookingFieldCode)

    // Между проверками и вставкой нет await: в однопоточном процессе это атомарно.
    const booking: Booking = {
      id: crypto.randomUUID(),
      callTypeId: callType.id,
      callTypeName: callType.name,
      startTime: toApiTime(startMs),
      endTime: toApiTime(startMs + callType.durationMinutes * MINUTE_MS),
      status: "confirmed",
      guestName: body.guestName,
      guestEmail: body.guestEmail,
      createdAt: now.toISOString(),
    }
    if (body.guestComment !== undefined) booking.guestComment = body.guestComment

    store.bookings.set(booking.id, booking)
    store.idempotency.set(idempotencyKey, { bodyHash, status: 201, body: booking })
    return c.json(booking, 201)
  })

  r.post("/:id/cancel", auth, (c) => {
    const booking = store.bookings.get(c.req.param("id"))
    if (!booking) throw problems.bookingNotFound()
    if (booking.status === "cancelled") throw problems.bookingAlreadyCancelled()
    booking.status = "cancelled"
    return c.json(booking)
  })

  return r
}
