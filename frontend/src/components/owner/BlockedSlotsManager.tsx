import { useEffect, useState, type FormEvent } from "react"
import { blockedSlotsApi } from "@/api/endpoints"
import type { BlockedSlot } from "@/api/types"
import { hasProblemCode } from "@/api/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { formatDateTime } from "@/lib/time"

interface Props {
  ownerKey: string
}

const fromLocalInput = (value: string): string => {
  if (!value) return ""
  const d = new Date(value)
  return d.toISOString()
}

export function BlockedSlotsManager({ ownerKey }: Props) {
  const [slots, setSlots] = useState<BlockedSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [reason, setReason] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerKey])

  const load = async () => {
    setLoading(true)
    try {
      const res = await blockedSlotsApi.list(ownerKey)
      setSlots(res.items)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить блокировки")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    const startIso = fromLocalInput(start)
    const endIso = fromLocalInput(end)
    if (!startIso || !endIso) {
      toast.error("Укажите начало и конец блокировки")
      return
    }
    setCreating(true)
    try {
      const created = await blockedSlotsApi.create(ownerKey, {
        startTime: startIso,
        endTime: endIso,
        reason: reason.trim() || undefined,
      })
      toast.success(`Заблокировано: ${formatDateTime(created.startTime)}`)
      setStart("")
      setEnd("")
      setReason("")
      void load()
    } catch (e) {
      let message = e instanceof Error ? e.message : "Не удалось создать блокировку"
      if (hasProblemCode(e, "BLOCK_CONFLICTS")) {
        message =
          "Диапазон пересекается с подтверждённым бронированием или другой блокировкой. Сначала отмените бронирование."
      } else if (hasProblemCode(e, "INVALID_BLOCK_RANGE")) {
        message = "Неверный диапазон: конец должен быть позже начала и в будущем."
      }
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (slot: BlockedSlot) => {
    try {
      await blockedSlotsApi.delete(ownerKey, slot.id)
      toast.success("Блокировка снята")
      void load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось снять блокировку")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Заблокировать время</CardTitle>
          <CardDescription>
            Блокировка глобальна для всех типов звонков и не пересекается с активными бронированиями.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Начало</Label>
                <Input
                  type="datetime-local"
                  className="w-52"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Конец</Label>
                <Input
                  type="datetime-local"
                  className="w-52"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Причина (необязательно)</Label>
                <Input
                  className="w-64"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Отпуск, встреча…"
                />
              </div>
            </div>
            <Button type="submit" disabled={creating} className="w-fit">
              {creating ? "Создание…" : "Заблокировать"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Активные блокировки</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Блокировок нет.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Начало</TableHead>
                  <TableHead>Конец</TableHead>
                  <TableHead>Причина</TableHead>
                  <TableHead className="w-20 text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slots.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(s.startTime)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(s.endTime)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.reason ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">Снять</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Снять блокировку?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Диапазон снова станет доступен для записи.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Закрыть</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void handleDelete(s)}>
                              Снять блокировку
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}