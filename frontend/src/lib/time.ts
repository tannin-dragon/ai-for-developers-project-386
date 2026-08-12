import type { CallType, Slot } from "@/api/types"

/** Форматирование ISO timestamp в локальное время, например "14:30". */
export function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

/** Форматирование ISO timestamp в локальную дату, например "ср, 13 авг". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })
}

/** Форматирование ISO timestamp в локальную дату и время. */
export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} ${formatTime(iso)}`
}

/**
 * Группировка свободных слотов по локальным датам.
 * Ключ — "YYYY-MM-DD" локальной даты слота.
 */
export function groupSlotsByDay(
  slots: Slot[],
): Map<string, Slot[]> {
  const map = new Map<string, Slot[]>()
  for (const slot of slots) {
    const d = new Date(slot.startTime)
    const key = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-")
    const arr = map.get(key)
    if (arr) {
      arr.push(slot)
    } else {
      map.set(key, [slot])
    }
  }
  return map
}

/** Локальная дата (ключ дня) ISO-строки. */
export function localDayKey(iso: string): string {
  const d = new Date(iso)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-")
}

/** Сортировка дат по возрастанию. */
export function compareIso(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime()
}

/** Человекочитаемый диапазон слота с учётом длительности типа звонка. */
export function formatDelay(slot: Slot, callType: CallType): string {
  const start = new Date(slot.startTime)
  const end = new Date(slot.endTime)
  const fmt = (d: Date) =>
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  const day = start.toLocaleDateString([], { day: "numeric", month: "short" })
  return `${day}, ${fmt(start)}–${fmt(end)} (${callType.durationMinutes} мин)`
}