import type { BlockedSlot, Booking, CallType, OwnerProfile } from "./types.js"

/** Запись идемпотентности: ответ на первый запрос с данным ключом. */
export interface IdempotencyRecord {
  /** Каноничный JSON тела первого запроса. */
  bodyHash: string
  status: number
  body: unknown
}

/**
 * Хранилище в памяти (по ТЗ БД не нужна): после перезапуска данные сбрасываются.
 * Map сохраняет порядок вставки — используем как порядок создания.
 */
export interface Store {
  callTypes: Map<string, CallType>
  bookings: Map<string, Booking>
  blockedSlots: Map<string, BlockedSlot>
  profile: OwnerProfile
  idempotency: Map<string, IdempotencyRecord>
}

export function createStore(profile: OwnerProfile): Store {
  return {
    callTypes: new Map(),
    bookings: new Map(),
    blockedSlots: new Map(),
    profile,
    idempotency: new Map(),
  }
}

/** Пересечение полуоткрытых интервалов [aStart, aEnd) и [bStart, bEnd), миллисекунды UTC. */
export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd
}

/** Подтверждённые бронирования — «активные» по контракту (отменённые слот освобождают). */
export function activeBookings(store: Store): Booking[] {
  return [...store.bookings.values()].filter((b) => b.status === "confirmed")
}

export function overlapsActiveBooking(store: Store, startMs: number, endMs: number): boolean {
  return activeBookings(store).some((b) =>
    overlaps(startMs, endMs, Date.parse(b.startTime), Date.parse(b.endTime)),
  )
}

export function overlapsBlockedSlot(store: Store, startMs: number, endMs: number): boolean {
  return [...store.blockedSlots.values()].some((s) =>
    overlaps(startMs, endMs, Date.parse(s.startTime), Date.parse(s.endTime)),
  )
}

/**
 * Каноничная сериализация тела для сравнения при идемпотентности:
 * ключи сортируются, undefined-поля отбрасываются.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`)
    return `{${entries.join(",")}}`
  }
  return JSON.stringify(value) ?? "null"
}
