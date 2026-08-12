/**
 * Модели по контракту main.tsp (namespace CalendarApi).
 * Времена в API — ISO 8601 с явным смещением (offsetDateTime), на проводе — строки.
 */

export type BookingStatus = "confirmed" | "cancelled"

export interface CallType {
  id: string
  name: string
  description: string
  durationMinutes: number
  slotStepMinutes: 15 | 30
}

export interface Slot {
  startTime: string
  endTime: string
}

export interface Booking {
  id: string
  callTypeId: string
  /** Денормализовано для списков: переживает удаление типа звонка. */
  callTypeName: string
  startTime: string
  endTime: string
  status: BookingStatus
  guestName: string
  guestEmail: string
  guestComment?: string
  createdAt: string
}

export interface BookingPage {
  items: Booking[]
  total: number
  limit: number
  offset: number
}

export interface BlockedSlot {
  id: string
  startTime: string
  endTime: string
  reason?: string
  createdAt: string
}

/** День недели по ISO 8601: 1 = Пн, ..., 7 = Вс. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** Границы рабочего дня — "HH:MM" в таймзоне владельца. */
export interface WorkSchedule {
  weekdays: Weekday[]
  startTime: string
  endTime: string
}

export interface OwnerProfile {
  name: string
  email: string
  /** IANA-идентификатор, например Europe/Moscow. */
  timezone: string
  workSchedule: WorkSchedule
}

export interface ValidationError {
  field: string
  code: string
  message: string
}

/** RFC 7807; машинный код ошибки кладём в title — этого ждёт фронт (hasProblemCode). */
export interface ProblemDetails {
  type?: string
  title: string
  detail?: string
  errors?: ValidationError[]
}
