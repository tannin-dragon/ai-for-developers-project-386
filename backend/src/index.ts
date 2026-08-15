import { serve } from "@hono/node-server"
import { createApp } from "./app.js"
import { config } from "./config.js"
import { createSeededStore } from "./seed.js"

const store = createSeededStore(config.seedDemo)
const app = createApp(store, config.ownerKey, config.staticDir)

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(
    `[callendar-api] listening on :${info.port} (seed=${config.seedDemo}, tz=${store.profile.timezone})`,
  )
})
