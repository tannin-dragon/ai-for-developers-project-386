import type { ProblemDetails } from "./types"

const API_BASE: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "/v1"

export class ApiError extends Error {
  status: number
  problem?: ProblemDetails

  constructor(status: number, problem?: ProblemDetails, message?: string) {
    super(problem?.title ?? problem?.detail ?? message ?? `HTTP ${status}`)
    this.name = "ApiError"
    this.status = status
    this.problem = problem
  }
}

interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: unknown
  query?: object
  /** Создать заголовок идемпотентности, если не передан. */
  idempotencyKey?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", headers = {}, body, query, idempotencyKey } = options

  const url = new URL(API_BASE.replace(/\/$/, "") + path, window.location.origin)

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  }

  if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json"
  }

  if (idempotencyKey && !headers["Idempotency-Key"]) {
    finalHeaders["Idempotency-Key"] = crypto.randomUUID()
  }

  let response: Response
  try {
    response = await fetch(url.toString(), {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, undefined, "Сетевая ошибка, проверьте доступность API")
  }

  if (response.status === 204) {
    return undefined as T
  }

  let problem: ProblemDetails | undefined
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/problem+json")) {
    try {
      problem = (await response.json()) as ProblemDetails
    } catch {
      problem = undefined
    }
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`
    if (problem?.detail) message = problem.detail
    else if (problem?.title) message = problem.title
    else if (problem?.errors?.length) {
      message = problem.errors.map((e) => e.message).join("; ")
    }
    throw new ApiError(response.status, problem, message)
  }

  const text = await response.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

/** Проверка: содержит ли тело ошибки указанный код (title или field.code). */
export function hasProblemCode(error: unknown, code: string): boolean {
  if (error instanceof ApiError && error.problem) {
    return (
      error.problem.errors?.some((e) => e.code === code) === true ||
      error.problem.title === code
    )
  }
  return false
}

/** Извлечь сообщение для конкретного поля формы из problem.errors. */
export function fieldError(error: unknown, field: string): string | undefined {
  if (error instanceof ApiError && error.problem?.errors) {
    return error.problem.errors.find((e) => e.field === field)?.message
  }
  return undefined
}

export const OWNER_KEY_STORAGE = "callendar.ownerKey"

export { request }