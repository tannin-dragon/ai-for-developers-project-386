import type { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { problems, Problem } from "./errors.js"

/** Читает JSON-тело запроса; битый JSON → 400 VALIDATION_ERROR. */
export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json()
  } catch {
    throw problems.invalidJson()
  }
}

/** Проверка ключа владельца для Owner-операций (заголовок X-Owner-Key). */
export const ownerAuth = (ownerKey: string) =>
  createMiddleware(async (c, next) => {
    if (c.req.header("X-Owner-Key") !== ownerKey) throw problems.invalidOwnerKey()
    await next()
  })

/** Ответ об ошибке строго в формате RFC 7807 (application/problem+json). */
export function problemResponse(c: Context, problem: Problem): Response {
  return new Response(JSON.stringify(problem.toBody()), {
    status: problem.status,
    headers: { "Content-Type": "application/problem+json" },
  })
}
