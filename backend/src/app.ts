import { Hono } from "hono"
import { Problem } from "./errors.js"
import { problemResponse } from "./http.js"
import { blockedSlotsRoutes } from "./routes/blockedSlots.js"
import { bookingsRoutes } from "./routes/bookings.js"
import { callTypesRoutes } from "./routes/callTypes.js"
import { ownerProfileRoutes } from "./routes/ownerProfile.js"
import type { Store } from "./store.js"

/** Собирает приложение: все операции контракта под префиксом /v1. */
export function createApp(store: Store, ownerKey: string): Hono {
  const app = new Hono()

  app.onError((err, c) => {
    if (err instanceof Problem) return problemResponse(c, err)
    console.error("[callendar-api] unhandled error:", err)
    return c.json({ title: "INTERNAL_ERROR", detail: "Внутренняя ошибка сервера" }, 500)
  })

  app.route("/v1/call-types", callTypesRoutes(store, ownerKey))
  app.route("/v1/bookings", bookingsRoutes(store, ownerKey))
  app.route("/v1/blocked-slots", blockedSlotsRoutes(store, ownerKey))
  app.route("/v1/owner/profile", ownerProfileRoutes(store, ownerKey))

  return app
}
