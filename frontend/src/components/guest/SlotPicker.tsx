import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { CallType, Slot } from "@/api/types"
import { groupSlotsByDay, localDayKey, formatTime, formatDelay } from "@/lib/time"

interface Props {
  callType: CallType
  slots: Slot[]
  loading: boolean
  error: string | null
  selected: Slot | null
  initialDay: Date
  onSelect: (slot: Slot) => void
  onBack: () => void
}

export function SlotPicker({
  callType,
  slots,
  loading,
  error,
  selected,
  initialDay,
  onSelect,
  onBack,
}: Props) {
  const [month, setMonth] = useState<Date>(initialDay)
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)

  const grouped = groupSlotsByDay(slots)
  const availableDates = [...grouped.keys()].sort()

  const dayHasSlots = (date: Date) => {
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-")
    return availableDates.includes(key)
  }

  const daySlots = selectedDayKey ? (grouped.get(selectedDayKey) ?? []) : []

  const handleDaySelect = (date: Date | undefined) => {
    if (!date) return
    setSelectedDayKey(localDayKey(date.toISOString()))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Свободные слоты — {callType.name}</CardTitle>
        <CardDescription>
          {callType.durationMinutes} мин, окно записи 14 дней
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 md:flex-row">
          <Calendar
            mode="single"
            month={month}
            onMonthChange={setMonth}
            onSelect={handleDaySelect}
            disabled={(date) => !dayHasSlots(date)}
          />
          <div className="flex-1">
            <div className="mb-2 text-sm font-medium text-muted-foreground">
              {loading
                ? "Загрузка слотов…"
                : availableDates.length === 0
                  ? "Свободных слотов нет на ближайшие 14 дней"
                  : "Выберите день, затем слот"}
            </div>
            {loading && <SlotsSkeleton />}
            {error && <div className="text-sm text-destructive">{error}</div>}
            {!loading && !error && daySlots.length === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                {selectedDayKey
                  ? "В этот день свободных слотов нет."
                  : "Выберите день в календаре."}
              </div>
            )}
            {!loading && !error && daySlots.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {daySlots.map((slot) => (
                  <Button
                    key={slot.startTime}
                    type="button"
                    variant={selected?.startTime === slot.startTime ? "default" : "outline"}
                    onClick={() => onSelect(slot)}
                  >
                    {formatTime(slot.startTime)}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}>← К типам звонков</Button>
          {selected && (
            <span className="text-sm text-muted-foreground">
              Выбрано: {formatDelay(selected, callType)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function SlotsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-9" />
      ))}
    </div>
  )
}