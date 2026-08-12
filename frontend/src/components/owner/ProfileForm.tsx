import { useEffect, useState, type FormEvent } from "react"
import { ownerApi } from "@/api/endpoints"
import type { OwnerProfile, Weekday } from "@/api/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface Props {
  ownerKey: string
}

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 7, label: "Вс" },
]

const toTimeInput = (time: string): string => time.slice(0, 5)
const fromTimeInput = (time: string): string => (time ? `${time}:00` : "")

export function ProfileForm({ ownerKey }: Props) {
  const [profile, setProfile] = useState<OwnerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [timezone, setTimezone] = useState("")
  const [weekdays, setWeekdays] = useState<Weekday[]>([])
  const [startTime, setStartTime] = useState("09:00")
  const [endTime, setEndTime] = useState("18:00")

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerKey])

  const load = async () => {
    setLoading(true)
    try {
      const p = await ownerApi.get(ownerKey)
      setProfile(p)
      setName(p.name)
      setEmail(p.email)
      setTimezone(p.timezone)
      setWeekdays(p.workSchedule.weekdays)
      setStartTime(toTimeInput(p.workSchedule.startTime))
      setEndTime(toTimeInput(p.workSchedule.endTime))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить профиль")
    } finally {
      setLoading(false)
    }
  }

  const toggleWeekday = (day: Weekday) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (weekdays.length === 0) {
      toast.error("Выберите хотя бы один рабочий день")
      return
    }
    if (!startTime || !endTime || endTime <= startTime) {
      toast.error("Конец рабочего дня должен быть позже начала")
      return
    }
    setSaving(true)
    try {
      const updated = await ownerApi.update(ownerKey, {
        name: name.trim(),
        email: email.trim(),
        timezone: timezone.trim(),
        workSchedule: {
          weekdays,
          startTime: fromTimeInput(startTime),
          endTime: fromTimeInput(endTime),
        },
      })
      setProfile(updated)
      toast.success("Профиль обновлён")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить профиль")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (!profile) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Профиль владельца</CardTitle>
        <CardDescription>
          Рабочий график и временная зона, в которых формируются слоты.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="owner-name">Имя</Label>
              <Input id="owner-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="owner-email">Email</Label>
              <Input id="owner-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="owner-tz">Временная зона (IANA)</Label>
              <Input
                id="owner-tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Europe/Moscow"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Рабочие дни</Label>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => toggleWeekday(d.value)}
                  className={cn(
                    "h-9 min-w-9 rounded-lg border px-2 text-sm transition-colors",
                    weekdays.includes(d.value)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-transparent hover:bg-muted"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex flex-col gap-2">
              <Label>Начало рабочего дня</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Конец рабочего дня</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <Button type="submit" disabled={saving} className="w-fit">
            {saving ? "Сохранение…" : "Сохранить"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}