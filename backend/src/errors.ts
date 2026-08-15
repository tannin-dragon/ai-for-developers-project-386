import type { ProblemDetails, ValidationError } from "./types.js"

/** Ошибка уровня API: статус + машинный код + человекочитаемое сообщение. */
export class Problem extends Error {
  constructor(
    readonly status: 400 | 401 | 404 | 409,
    readonly code: string,
    message: string,
    readonly errors?: ValidationError[],
  ) {
    super(message)
    this.name = "Problem"
  }

  toBody(): ProblemDetails {
    const body: ProblemDetails = { title: this.code, detail: this.message }
    if (this.errors?.length) body.errors = this.errors
    return body
  }
}

/** Фабрики ошибок по кодам контракта (см. @doc в main.tsp). */
export const problems = {
  // 400
  validation: (errors: ValidationError[]) =>
    new Problem(400, "VALIDATION_ERROR", "Ошибка валидации запроса", errors),
  invalidJson: () =>
    new Problem(400, "VALIDATION_ERROR", "Тело запроса не является валидным JSON", [
      { field: "(body)", code: "VALIDATION_ERROR", message: "Некорректный JSON" },
    ]),
  invalidStartTime: () =>
    new Problem(400, "INVALID_START_TIME", "Начало слота в прошлом"),
  outsideBookingWindow: () =>
    new Problem(400, "OUTSIDE_BOOKING_WINDOW", "Слот вне окна записи [сейчас, +14 дней)"),
  outsideWorkingHours: () =>
    new Problem(400, "OUTSIDE_WORKING_HOURS", "Интервал вне рабочего графика владельца"),
  notAlignedToGrid: () =>
    new Problem(400, "NOT_ALIGNED_TO_GRID", "Слот не совпадает с сеткой типа звонка"),
  invalidBlockRange: () =>
    new Problem(400, "INVALID_BLOCK_RANGE", "Конец блокировки должен быть позже начала, начало — не в прошлом"),
  // 401
  invalidOwnerKey: () =>
    new Problem(401, "INVALID_OWNER_KEY", "Отсутствует или неверен заголовок X-Owner-Key"),
  // 404
  callTypeNotFound: () =>
    new Problem(404, "CALL_TYPE_NOT_FOUND", "Тип звонка не найден"),
  bookingNotFound: () =>
    new Problem(404, "BOOKING_NOT_FOUND", "Бронирование не найдено"),
  blockedSlotNotFound: () =>
    new Problem(404, "BLOCKED_SLOT_NOT_FOUND", "Блокировка не найдена"),
  notFound: () =>
    new Problem(404, "NOT_FOUND", "Ресурс не найден"),
  // 409
  slotUnavailable: () =>
    new Problem(409, "SLOT_UNAVAILABLE", "Выбранное время уже занято другим бронированием"),
  slotBlocked: () =>
    new Problem(409, "SLOT_BLOCKED", "Выбранное время заблокировано владельцем"),
  blockConflicts: () =>
    new Problem(409, "BLOCK_CONFLICTS", "Диапазон пересекается с подтверждённым бронированием или другой блокировкой"),
  bookingAlreadyCancelled: () =>
    new Problem(409, "BOOKING_ALREADY_CANCELLED", "Бронирование уже отменено"),
  callTypeHasActiveBookings: () =>
    new Problem(409, "CALL_TYPE_HAS_ACTIVE_BOOKINGS", "У типа есть предстоящие подтверждённые бронирования"),
  idempotencyKeyReused: () =>
    new Problem(409, "IDEMPOTENCY_KEY_REUSED", "Ключ идемпотентности уже использован с другим телом запроса"),
} as const
