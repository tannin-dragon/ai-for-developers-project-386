import { TZDate } from "@date-fns/tz"
import { Problem, problems } from "./errors.js"
import { BOOKING_WINDOW_DAYS, isoWeekday, workDayBounds } from "./slots.js"
import { overlapsActiveBooking, overlapsBlockedSlot, type Store } from "./store.js"
import type { CallType } from "./types.js"

const DAY_MS = 24 * 60 * 60 * 1000
const MINUTE_MS = 60_000

/**
 * Бизнес-правила создания бронирования в порядке проверки из контракта
 * (док операции Bookings.create в main.tsp). Возвращает Problem или null.
 * Проверка существования типа (404) и полей гостя (400) — в маршруте,
 * до и после этой функции соответственно.
 */
export function validateBookingSlot(
  store: Store,
  callType: CallType,
  startMs: number,
  now: Date,
): Problem | null {
  const durationMs = callType.durationMinutes * MINUTE_MS
  const endMs = startMs + durationMs
  const { timezone, workSchedule } = store.profile

  // Начало в прошлом.
  if (startMs < now.getTime()) return problems.invalidStartTime()

  // Вне окна [сейчас, +14 дней).
  if (startMs >= now.getTime() + BOOKING_WINDOW_DAYS * DAY_MS) return problems.outsideBookingWindow()

  // Сетка: смещение от начала рабочего дня кратно шагу типа.
  const day = new TZDate(startMs, timezone)
  const { startMs: workStartMs, endMs: workEndMs } = workDayBounds(day, workSchedule, timezone)
  if ((startMs - workStartMs) % (callType.slotStepMinutes * MINUTE_MS) !== 0) {
    return problems.notAlignedToGrid()
  }

  // Рабочие часы: день недели в графике и интервал целиком внутри рабочего дня.
  if (
    !workSchedule.weekdays.includes(isoWeekday(day)) ||
    startMs < workStartMs ||
    endMs > workEndMs
  ) {
    return problems.outsideWorkingHours()
  }

  // Конфликты: сначала бронирования, затем блокировки (порядок из контракта).
  if (overlapsActiveBooking(store, startMs, endMs)) return problems.slotUnavailable()
  if (overlapsBlockedSlot(store, startMs, endMs)) return problems.slotBlocked()

  return null
}

/**
 * Правила создания блокировки: end > start, начало не в прошлом (400 INVALID_BLOCK_RANGE),
 * без пересечений с подтверждёнными бронированиями и другими блокировками (409 BLOCK_CONFLICTS).
 */
export function validateBlockedSlot(
  store: Store,
  startMs: number,
  endMs: number,
  now: Date,
): Problem | null {
  if (endMs <= startMs || startMs < now.getTime()) return problems.invalidBlockRange()
  if (overlapsActiveBooking(store, startMs, endMs) || overlapsBlockedSlot(store, startMs, endMs)) {
    return problems.blockConflicts()
  }
  return null
}

/**
 * «Активные бронирования типа» для удаления: подтверждённые и ещё не завершившиеся.
 * Прошедшие подтверждённые брони не блокируют удаление — иначе тип с историей
 * нельзя было бы удалить никогда (callTypeName денормализован, списки не сломаются).
 */
export function hasActiveBookings(store: Store, callTypeId: string, now: Date): boolean {
  const nowMs = now.getTime()
  return [...store.bookings.values()].some(
    (b) => b.callTypeId === callTypeId && b.status === "confirmed" && Date.parse(b.endTime) >= nowMs,
  )
}
