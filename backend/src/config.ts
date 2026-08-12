const toPort = (value: string | undefined, fallback: number): number => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 && n <= 65535 ? n : fallback
}

export const config = {
  port: toPort(process.env.PORT, 3000),
  /** Фиксированный ключ владельца (секрет в конфигурации сервера, по контракту). */
  ownerKey: process.env.OWNER_KEY?.trim() || "dev-owner-key",
  /** Сидировать профиль и два демо-типа звонков при старте. */
  seedDemo: (process.env.SEED_DEMO ?? "true").toLowerCase() !== "false",
} as const
