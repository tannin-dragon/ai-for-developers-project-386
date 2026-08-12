import { TZDate } from "@date-fns/tz"
import { overlaps } from "./store.js"
import type { Weekday, WorkSchedule } from "./types.js"

const DAY_MS = 24 * 60 * 60 * 1000
const MINUTE_MS = 60_000

/** Окно записи по контракту: [сейчас, +14 дней). */
export const BOOKING_WINDOW_DAYS = 14

export interface Interval {
  startMs: number
  endMs: number
}

export interface SlotInput {
  durationMinutes: number
  slotStepMinutes: 15 | 30
  schedule: WorkSchedule
  timezone: string
  now: Date
  from?: Date | undefined
  to?: Date | undefined
  /** Занятые интервалы: активные бронирования всех типов + блокировки. */
  busy: Interval[]
}

/** ISO-день недели (1=Пн…7=Вс) календарного дня в таймзоне владельца. */
export function isoWeekday(day: TZDate): Weekday {
  return (day.getDay() === 0 ? 7 : day.getDay()) as Weekday
}

/**
 * Границы рабочего дня (по графику) для календарного дня `day` в таймзоне `tz`,
 * в UTC-миллисекундах. TZDate конструируется из «настенного» времени в tz,
 * поэтому переходы DST обрабатываются корректно.
 */
export function workDayBounds(
  day: TZDate,
  schedule: WorkSchedule,
  tz: string,
): { startMs: number; endMs: number } {
  const [sh = 0, sm = 0] = schedule.startTime.split(":").map(Number)
  const [eh = 0, em = 0] = schedule.endTime.split(":").map(Number)
  const y = day.getFullYear()
  const m = day.getMonth()
  const d = day.getDate()
  const start = new TZDate(y, m, d, sh, sm, 0, tz)
  const end = new TZDate(y, m, d, eh, em, 0, tz)
  return { startMs: start.getTime(), endMs: end.getTime() }
}

/**
 * Свободные слоты: сетка от начала рабочего дня с шагом типа звонка,
 * в окне [max(now, from), min(now + 14 дней, to)), без прошедших времён
 * и без пересечений с занятыми интервалами.
 */
export function generateSlots(input: SlotInput): Interval[] {
  const { schedule, timezone, now, busy } = input
  const durationMs = input.durationMinutes * MINUTE_MS
  const stepMs = input.slotStepMinutes * MINUTE_MS

  const windowStartMs = Math.max(now.getTime(), input.from?.getTime() ?? 0)
  const windowEndMs = Math.min(
    now.getTime() + BOOKING_WINDOW_DAYS * DAY_MS,
    input.to?.getTime() ?? Number.POSITIVE_INFINITY,
  )

  const slots: Interval[] = []
  const tzNow = new TZDate(now.getTime(), timezone)
  for (let i = 0; ; i++) {
    // Каждый день заново конструируется из календарных компонентов — устойчиво к DST.
    const day = new TZDate(tzNow.getFullYear(), tzNow.getMonth(), tzNow.getDate() + i, 0, 0, 0, timezone)
    const { startMs, endMs } = workDayBounds(day, schedule, timezone)
    if (startMs >= windowEndMs) break
    if (!schedule.weekdays.includes(isoWeekday(day))) continue

    for (let t = startMs; t + durationMs <= endMs; t += stepMs) {
      if (t < windowStartMs || t >= windowEndMs) continue
      if (busy.some((b) => overlaps(t, t + durationMs, b.startMs, b.endMs))) continue
      slots.push({ startMs: t, endMs: t + durationMs })
    }
  }
  return slots
}

/** Формат ответа API: ISO 8601 в UTC ("Z" — допустимое явное смещение). */
export function toApiTime(ms: number): string {
  return new Date(ms).toISOString()
}
