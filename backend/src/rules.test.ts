import { describe, expect, it } from "vitest"
import { hasActiveBookings, validateBlockedSlot, validateBookingSlot } from "./rules.js"
import { defaultProfile } from "./seed.js"
import { createStore, type Store } from "./store.js"
import type { Booking, CallType } from "./types.js"

/** NOW — четверг 13.08.2026 12:00 UTC = 15:00 MSK (рабочий день). */
const NOW = new Date("2026-08-13T12:00:00Z")

const interview: CallType = {
  id: "ct-interview",
  name: "Интервью",
  description: "",
  durationMinutes: 30,
  slotStepMinutes: 15,
}

function freshStore(): Store {
  return createStore(structuredClone(defaultProfile)) // MSK, Пн–Пт 09:00–18:00
}

function bookingAt(startIso: string, endIso: string, status: "confirmed" | "cancelled" = "confirmed"): Booking {
  return {
    id: crypto.randomUUID(),
    callTypeId: interview.id,
    callTypeName: interview.name,
    startTime: startIso,
    endTime: endIso,
    status,
    guestName: "Гость",
    guestEmail: "guest@example.com",
    createdAt: NOW.toISOString(),
  }
}

describe("validateBookingSlot: порядок и коды ошибок по контракту", () => {
  it("свободный слот в графике → null", () => {
    expect(validateBookingSlot(freshStore(), interview, Date.parse("2026-08-13T12:15:00Z"), NOW)).toBeNull()
  })

  it("начало в прошлом → INVALID_START_TIME", () => {
    const p = validateBookingSlot(freshStore(), interview, Date.parse("2026-08-13T11:45:00Z"), NOW)
    expect(p?.code).toBe("INVALID_START_TIME")
    expect(p?.status).toBe(400)
  })

  it("за окном +14 дней → OUTSIDE_BOOKING_WINDOW", () => {
    // 28.08 (пт) 09:00 MSK — за пределами окна (now + 14д = 27.08 12:00Z).
    const p = validateBookingSlot(freshStore(), interview, Date.parse("2026-08-28T06:00:00Z"), NOW)
    expect(p?.code).toBe("OUTSIDE_BOOKING_WINDOW")
  })

  it("вне сетки 15 мин → NOT_ALIGNED_TO_GRID", () => {
    const p = validateBookingSlot(freshStore(), interview, Date.parse("2026-08-13T12:07:00Z"), NOW)
    expect(p?.code).toBe("NOT_ALIGNED_TO_GRID")
  })

  it("суббота, хоть и на сетке → OUTSIDE_WORKING_HOURS", () => {
    const p = validateBookingSlot(freshStore(), interview, Date.parse("2026-08-15T09:00:00Z"), NOW)
    expect(p?.code).toBe("OUTSIDE_WORKING_HOURS")
  })

  it("до начала рабочего дня (завтра 08:45 MSK) → OUTSIDE_WORKING_HOURS", () => {
    // NB: «сегодня до рабочего дня» невалидно как тест — то время уже в прошлом от NOW.
    const p = validateBookingSlot(freshStore(), interview, Date.parse("2026-08-14T05:45:00Z"), NOW)
    expect(p?.code).toBe("OUTSIDE_WORKING_HOURS")
  })

  it("конец за пределами рабочего дня (17:45+30 мин MSK) → OUTSIDE_WORKING_HOURS", () => {
    const p = validateBookingSlot(freshStore(), interview, Date.parse("2026-08-13T14:45:00Z"), NOW)
    expect(p?.code).toBe("OUTSIDE_WORKING_HOURS")
  })

  it("пересечение с подтверждённой бронью → 409 SLOT_UNAVAILABLE", () => {
    const store = freshStore()
    const taken = bookingAt("2026-08-14T09:00:00Z", "2026-08-14T09:30:00Z")
    store.bookings.set(taken.id, taken)
    const p = validateBookingSlot(store, interview, Date.parse("2026-08-14T09:15:00Z"), NOW)
    expect(p?.code).toBe("SLOT_UNAVAILABLE")
    expect(p?.status).toBe(409)
  })

  it("отменённая бронь слот не держит → null", () => {
    const store = freshStore()
    const cancelled = bookingAt("2026-08-14T09:00:00Z", "2026-08-14T09:30:00Z", "cancelled")
    store.bookings.set(cancelled.id, cancelled)
    expect(validateBookingSlot(store, interview, Date.parse("2026-08-14T09:15:00Z"), NOW)).toBeNull()
  })

  it("пересечение с блокировкой → 409 SLOT_BLOCKED", () => {
    const store = freshStore()
    store.blockedSlots.set("b1", {
      id: "b1",
      startTime: "2026-08-14T10:00:00Z",
      endTime: "2026-08-14T11:00:00Z",
      createdAt: NOW.toISOString(),
    })
    const p = validateBookingSlot(store, interview, Date.parse("2026-08-14T10:30:00Z"), NOW)
    expect(p?.code).toBe("SLOT_BLOCKED")
    expect(p?.status).toBe(409)
  })

  it("и бронь, и блокировка одновременно → приоритет SLOT_UNAVAILABLE (порядок контракта)", () => {
    const store = freshStore()
    const taken = bookingAt("2026-08-14T09:00:00Z", "2026-08-14T09:30:00Z")
    store.bookings.set(taken.id, taken)
    store.blockedSlots.set("b1", {
      id: "b1",
      startTime: "2026-08-14T09:00:00Z",
      endTime: "2026-08-14T12:00:00Z",
      createdAt: NOW.toISOString(),
    })
    const p = validateBookingSlot(store, interview, Date.parse("2026-08-14T09:15:00Z"), NOW)
    expect(p?.code).toBe("SLOT_UNAVAILABLE")
  })
})

describe("validateBlockedSlot", () => {
  const start = Date.parse("2026-08-14T12:00:00Z") // пт 15:00 MSK, будущее
  const end = Date.parse("2026-08-14T13:00:00Z")

  it("валидный диапазон → null", () => {
    expect(validateBlockedSlot(freshStore(), start, end, NOW)).toBeNull()
  })

  it("end <= start → INVALID_BLOCK_RANGE", () => {
    expect(validateBlockedSlot(freshStore(), end, start, NOW)?.code).toBe("INVALID_BLOCK_RANGE")
    expect(validateBlockedSlot(freshStore(), start, start, NOW)?.code).toBe("INVALID_BLOCK_RANGE")
  })

  it("начало в прошлом → INVALID_BLOCK_RANGE", () => {
    const p = validateBlockedSlot(freshStore(), Date.parse("2026-08-13T06:00:00Z"), Date.parse("2026-08-13T07:00:00Z"), NOW)
    expect(p?.code).toBe("INVALID_BLOCK_RANGE")
  })

  it("пересечение с подтверждённой бронью → BLOCK_CONFLICTS", () => {
    const store = freshStore()
    const taken = bookingAt("2026-08-14T12:30:00Z", "2026-08-14T13:00:00Z")
    store.bookings.set(taken.id, taken)
    expect(validateBlockedSlot(store, start, end, NOW)?.code).toBe("BLOCK_CONFLICTS")
  })

  it("пересечение с другой блокировкой → BLOCK_CONFLICTS", () => {
    const store = freshStore()
    store.blockedSlots.set("b1", {
      id: "b1",
      startTime: "2026-08-14T12:30:00Z",
      endTime: "2026-08-14T14:00:00Z",
      createdAt: NOW.toISOString(),
    })
    expect(validateBlockedSlot(store, start, end, NOW)?.code).toBe("BLOCK_CONFLICTS")
  })

  it("отменённая бронь не мешает блокировке → null", () => {
    const store = freshStore()
    const cancelled = bookingAt("2026-08-14T12:30:00Z", "2026-08-14T13:00:00Z", "cancelled")
    store.bookings.set(cancelled.id, cancelled)
    expect(validateBlockedSlot(store, start, end, NOW)).toBeNull()
  })
})

describe("hasActiveBookings (защита удаления типа)", () => {
  it("предстоящая подтверждённая → true", () => {
    const store = freshStore()
    const b = bookingAt("2026-08-14T09:00:00Z", "2026-08-14T09:30:00Z")
    store.bookings.set(b.id, b)
    expect(hasActiveBookings(store, interview.id, NOW)).toBe(true)
  })

  it("прошедшая подтверждённая → false (история не блокирует удаление)", () => {
    const store = freshStore()
    const b = bookingAt("2026-08-13T06:00:00Z", "2026-08-13T06:30:00Z") // сегодня утром, уже конец в прошлом
    store.bookings.set(b.id, b)
    expect(hasActiveBookings(store, interview.id, NOW)).toBe(false)
  })

  it("предстоящая, но отменённая → false", () => {
    const store = freshStore()
    const b = bookingAt("2026-08-14T09:00:00Z", "2026-08-14T09:30:00Z", "cancelled")
    store.bookings.set(b.id, b)
    expect(hasActiveBookings(store, interview.id, NOW)).toBe(false)
  })
})
