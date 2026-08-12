import { describe, expect, it } from "vitest"
import { generateSlots, isoWeekday, workDayBounds } from "./slots.js"
import { TZDate } from "@date-fns/tz"
import type { WorkSchedule } from "./types.js"

const MSK = "Europe/Moscow"
const monFri: WorkSchedule = { weekdays: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "18:00" }

/** Четверг 13.08.2026 12:00 UTC — рабочий день в Москве (15:00 MSK). */
const NOW = new Date("2026-08-13T12:00:00Z")

const base = {
  durationMinutes: 30,
  slotStepMinutes: 15,
  schedule: monFri,
  timezone: MSK,
  now: NOW,
  busy: [],
} as const

describe("generateSlots", () => {
  it("сегодня отдаёт только непрошедшие слоты: первый — ровно 15:00 MSK (окно [сейчас, ...))", () => {
    const slots = generateSlots({ ...base })
    expect(slots.length).toBeGreaterThan(0)
    // now = 15:00 MSK ровно; окно включает левую границу → первый слот 15:00 MSK = 12:00Z.
    expect(slots[0]).toEqual({
      startMs: Date.parse("2026-08-13T12:00:00Z"),
      endMs: Date.parse("2026-08-13T12:30:00Z"),
    })
  })

  it("слоты не выходят за рабочий день и лежат только в буднях MSK", () => {
    const slots = generateSlots({ ...base })
    for (const s of slots) {
      const day = new TZDate(s.startMs, MSK)
      expect([1, 2, 3, 4, 5]).toContain(isoWeekday(day))
      const { startMs, endMs } = workDayBounds(day, monFri, MSK)
      expect(s.startMs).toBeGreaterThanOrEqual(startMs)
      expect(s.endMs).toBeLessThanOrEqual(endMs)
      // сетка 15 минут от начала рабочего дня
      expect((s.startMs - startMs) % (15 * 60_000)).toBe(0)
    }
  })

  it("не выходит за окно [now, +14 дней)", () => {
    const slots = generateSlots({ ...base })
    const windowEnd = NOW.getTime() + 14 * 24 * 60 * 60 * 1000
    for (const s of slots) {
      expect(s.startMs).toBeGreaterThanOrEqual(NOW.getTime())
      expect(s.startMs).toBeLessThan(windowEnd)
    }
    // окно закрывается 27.08 12:00Z (чт): утро четверга ещё внутри окна,
    // последний слот стартует в 11:45Z (14:45 MSK); конец может выйти за границу окна.
    const last = slots.at(-1)
    expect(last?.startMs).toBe(Date.parse("2026-08-27T11:45:00Z"))
  })

  it("выходные исключены: 15–16.08 (сб/вс) слотов нет", () => {
    const slots = generateSlots({ ...base })
    const weekend = slots.filter((s) => {
      const d = new TZDate(s.startMs, MSK)
      return isoWeekday(d) >= 6
    })
    expect(weekend).toEqual([])
  })

  it("busy-интервал вырезает пересекающиеся слоты, соседние остаются", () => {
    // Занято 14.08 12:00–13:00 MSK (09:00–10:00Z). Интервалы полуоткрытые:
    // выпадают слоты 11:45, 12:00, 12:15, 12:30, 12:45 MSK;
    // впритык смыкающиеся 11:30 (конец = началу busy) и 13:00 (начало = концу busy) остаются.
    const busy = [{ startMs: Date.parse("2026-08-14T09:00:00Z"), endMs: Date.parse("2026-08-14T10:00:00Z") }]
    const slots = generateSlots({ ...base, busy })
    const thatDay = slots.filter((s) => {
      const d = new TZDate(s.startMs, MSK)
      return d.getDate() === 14 && d.getMonth() === 7
    })
    const starts = thatDay.map((s) => s.startMs)
    for (const taken of ["08:45", "09:00", "09:15", "09:30", "09:45"]) {
      expect(starts).not.toContain(Date.parse(`2026-08-14T${taken}:00Z`))
    }
    expect(starts).toContain(Date.parse("2026-08-14T08:30:00Z")) // 11:30–12:00 MSK, смыкается с busy
    expect(starts).toContain(Date.parse("2026-08-14T10:00:00Z")) // 13:00 MSK, впритык к концу busy
  })

  it("from/to сужают окно", () => {
    const slots = generateSlots({
      ...base,
      from: new Date("2026-08-17T06:00:00Z"), // пн 09:00 MSK
      to: new Date("2026-08-17T15:00:00Z"), // пн 18:00 MSK
    })
    expect(slots.length).toBe(35) // 09:00–17:30 MSK с шагом 15 при длительности 30
    expect(slots[0]?.startMs).toBe(Date.parse("2026-08-17T06:00:00Z"))
  })

  it("шаг 30 и длительность 60: сетка по полчаса", () => {
    const slots = generateSlots({
      ...base,
      durationMinutes: 60,
      slotStepMinutes: 30,
      from: new Date("2026-08-17T06:00:00Z"),
      to: new Date("2026-08-17T15:00:00Z"),
    })
    expect(slots.length).toBe(17) // 09:00–17:00 MSK с шагом 30 при длительности 60
    expect(slots[1]?.startMs).toBe(Date.parse("2026-08-17T06:30:00Z"))
  })

  it("DST: America/New_York, неделя перевода часов — рабочее время держится в локальных часах", () => {
    // 09.03.2026 (пн) — неделя перехода на летнее время в США (08.03.2026).
    const schedule: WorkSchedule = { weekdays: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "12:00" }
    const slots = generateSlots({
      durationMinutes: 30,
      slotStepMinutes: 30,
      schedule,
      timezone: "America/New_York",
      now: new Date("2026-03-09T12:00:00Z"),
      busy: [],
    })
    expect(slots.length).toBeGreaterThan(0)
    // Каждый слот начинается в 09:00–11:30 по местному времени Нью-Йорка, несмотря на DST.
    for (const s of slots) {
      const local = new TZDate(s.startMs, "America/New_York")
      expect(local.getHours()).toBeGreaterThanOrEqual(9)
      expect(local.getHours()).toBeLessThan(12)
    }
    // 09.03 (пн, EDT UTC-4) первый слот 09:00; 06.03 (пт, ещё EST UTC-5) — вне окна, проверяем 09.03.
    expect(slots[0]?.startMs).toBe(Date.parse("2026-03-09T13:00:00Z"))
  })
})
