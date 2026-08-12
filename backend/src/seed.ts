import { createStore, type Store } from "./store.js"
import type { CallType, OwnerProfile } from "./types.js"

/** Профиль по умолчанию: рабочее время Пн–Пт 09:00–18:00 (из контракта), Europe/Moscow. */
export const defaultProfile: OwnerProfile = {
  name: "Владелец календаря",
  email: "owner@callendar.local",
  timezone: "Europe/Moscow",
  workSchedule: { weekdays: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "18:00" },
}

const demoCallTypes: ReadonlyArray<Omit<CallType, "id">> = [
  {
    name: "Интервью",
    description: "Короткое знакомство и первичное обсуждение",
    durationMinutes: 30,
    slotStepMinutes: 15,
  },
  {
    name: "Консультация",
    description: "Развёрнутая консультация по проекту",
    durationMinutes: 60,
    slotStepMinutes: 30,
  },
]

/** Демо-данные для немедленной работы гостевого сценария (хранилище в памяти). */
export function createSeededStore(seedDemo: boolean): Store {
  const store = createStore(structuredClone(defaultProfile))
  if (!seedDemo) return store
  for (const t of demoCallTypes) {
    const callType: CallType = { id: crypto.randomUUID(), ...t }
    store.callTypes.set(callType.id, callType)
  }
  return store
}
