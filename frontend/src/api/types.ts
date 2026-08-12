/** Модели контракта Callendar (см. main.tsp). */

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface WorkSchedule {
  weekdays: Weekday[]
  /** plainTime в формате "HH:MM:SS" */
  startTime: string
  /** plainTime в формате "HH:MM:SS" */
  endTime: string
}

export interface OwnerProfile {
  name: string
  email: string
  /** IANA-идентификатор временной зоны, например Europe/Moscow. */
  timezone: string
  workSchedule: WorkSchedule
}

export interface OwnerProfileUpdate {
  name?: string
  email?: string
  timezone?: string
  workSchedule?: WorkSchedule
}

export interface CallType {
  id: string
  name: string
  description: string
  durationMinutes: number
  slotStepMinutes: 15 | 30
}

export interface CallTypeCreate {
  name: string
  description: string
  durationMinutes: number
  slotStepMinutes: 15 | 30
}

export interface CallTypeUpdate {
  name?: string
  description?: string
  durationMinutes?: number
  slotStepMinutes?: 15 | 30
}

/** Свободный слот записи (начало/конец, ISO 8601 со смещением). */
export interface Slot {
  startTime: string
  endTime: string
}

export type BookingStatus = "confirmed" | "cancelled"

export interface Booking {
  id: string
  callTypeId: string
  callTypeName: string
  startTime: string
  endTime: string
  status: BookingStatus
  guestName: string
  guestEmail: string
  guestComment?: string
  createdAt: string
}

export interface BookingCreate {
  callTypeId: string
  startTime: string
  guestName: string
  guestEmail: string
  guestComment?: string
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

export interface BlockedSlotCreate {
  startTime: string
  endTime: string
  reason?: string
}

export interface ValidationError {
  field: string
  code: string
  message: string
}

/** Ошибка по RFC 7807 (application/problem+json). */
export interface ProblemDetails {
  type?: string
  title: string
  detail?: string
  errors?: ValidationError[]
}

/** Фильтры списка бронирований. */
export interface BookingListParams {
  callTypeId?: string
  status?: BookingStatus
  from?: string
  to?: string
  limit?: number
  offset?: number
}