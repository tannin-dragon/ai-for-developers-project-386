import { z } from "zod"
import { Problem, problems } from "./errors.js"
import type { ValidationError } from "./types.js"

/** offsetDateTime по контракту: ISO 8601 с явным смещением ("Z" или "±HH:MM"). */
export const isoDateTime = z
  .string()
  .datetime({ offset: true, message: "Ожидается ISO 8601 с явным смещением" })

/** plainTime по контракту: "HH:MM". */
const plainTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Ожидается время в формате HH:MM")

/** Пустые/пробельные необязательные строки трактуем как отсутствие значения. */
const optionalTrimmed = (schema: z.ZodString) =>
  schema.trim().optional().transform((v) => (v ? v : undefined))

const durationMinutes = z
  .number({
    invalid_type_error: "Ожидается целое число минут",
    required_error: "Укажите длительность в минутах",
  })
  .int("Ожидается целое число минут")
  .min(1)
  .max(2_147_483_647)

const slotStepMinutes = z.union([z.literal(15), z.literal(30)], {
  errorMap: () => ({ message: "Шаг сетки — 15 или 30 минут" }),
})

export const callTypeCreateSchema = z.object({
  name: z.string().trim().min(1, "Название обязательно"),
  description: z.string(),
  durationMinutes,
  slotStepMinutes,
})

export const callTypeUpdateSchema = callTypeCreateSchema.partial()

export const bookingCreateSchema = z.object({
  callTypeId: z.string().min(1),
  startTime: isoDateTime,
  guestName: z.string().trim().min(1, "Имя гостя обязательно"),
  guestEmail: z.string().trim().email("Некорректный email"),
  guestComment: optionalTrimmed(z.string().trim().max(1000, "Комментарий длиннее 1000 символов")),
})

export const blockedSlotCreateSchema = z.object({
  startTime: isoDateTime,
  endTime: isoDateTime,
  reason: optionalTrimmed(z.string().trim()),
})

const workScheduleSchema = z
  .object({
    weekdays: z.array(z.number().int().min(1).max(7)).min(1, "Нужен хотя бы один рабочий день"),
    startTime: plainTime,
    endTime: plainTime,
  })
  .refine((w) => w.startTime < w.endTime, {
    message: "startTime должен быть раньше endTime",
    path: ["endTime"],
  })

const isValidIanaTimezone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export const ownerProfileUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email("Некорректный email").optional(),
  timezone: z
    .string()
    .trim()
    .min(1)
    .refine(isValidIanaTimezone, "Неизвестная IANA-таймзона")
    .optional(),
  workSchedule: workScheduleSchema.optional(),
})

/** Query GET /bookings: limit/offset приходят строками. */
export const bookingsQuerySchema = z.object({
  callTypeId: z.string().min(1).optional(),
  status: z.enum(["confirmed", "cancelled"]).optional(),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

/** Query GET /call-types/{id}/slots. */
export const slotsQuerySchema = z.object({
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
})

/** Маппинг пути поля в код ошибки для конкретной операции. */
export type CodeFor = (field: string) => string

/** Превращает ZodError в Problem 400 с errors[] по контракту. */
export function parseWith<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
  codeFor?: CodeFor,
): z.output<S> {
  const result = schema.safeParse(data)
  if (result.success) return result.data

  const errors: ValidationError[] = result.error.issues.map((issue) => {
    const field = issue.path.join(".") || "(body)"
    return { field, code: codeFor?.(field) ?? "VALIDATION_ERROR", message: issue.message }
  })
  throw problems.validation(errors)
}

/** Коды для тела POST /bookings. */
export const bookingFieldCode: CodeFor = (field) => {
  if (field === "guestEmail") return "INVALID_EMAIL"
  return "VALIDATION_ERROR"
}

/** Коды для тел типов звонков. */
export const callTypeFieldCode: CodeFor = (field) => {
  if (field === "durationMinutes") return "INVALID_DURATION"
  return "VALIDATION_ERROR"
}

/** Коды для query GET /bookings. */
export const bookingsQueryCode: CodeFor = (field) => {
  if (field === "limit" || field === "offset") return "INVALID_LIMIT_OFFSET"
  return "INVALID_FILTER"
}

/** Коды для query GET /call-types/{id}/slots. */
export const slotsQueryCode: CodeFor = () => "INVALID_FILTER"
