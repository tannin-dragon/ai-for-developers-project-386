import { useEffect, useState, type ReactNode } from "react"
import { bookingsApi } from "@/api/endpoints"
import type { Booking, BookingStatus, CallType } from "@/api/types"
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
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  callTypes: CallType[]
}

export function BookingsTable({ ownerKey, callTypes }: Props) {
  const [items, setItems] = useState<Booking[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<BookingStatus | "all">("all")
  const [callTypeId, setCallTypeId] = useState<string>("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [limit] = useState(50)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerKey, status, callTypeId, from, to, limit, offset])

  const load = async () => {
    setLoading(true)
    try {
      const res = await bookingsApi.list(ownerKey, {
        status: status === "all" ? undefined : status,
        callTypeId: callTypeId === "all" ? undefined : callTypeId,
        from: from || undefined,
        to: to || undefined,
        limit,
        offset,
      })
      setItems(res.items)
      setTotal(res.total)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить бронирования")
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async (booking: Booking) => {
    try {
      const updated = await bookingsApi.cancel(ownerKey, booking.id)
      toast.success(`Бронирование ${updated.id} отменено`)
      void load()
    } catch (e) {
      let message = e instanceof Error ? e.message : "Не удалось отменить бронирование"
      if (hasProblemCode(e, "BOOKING_ALREADY_CANCELLED")) {
        message = "Бронирование уже отменено"
      }
      toast.error(message)
    }
  }

  const totalPages = Math.ceil(total / limit)
  const page = Math.floor(offset / limit) + 1

  return (
    <Card>
      <CardHeader>
        <CardTitle>Бронирования</CardTitle>
        <CardDescription>
          {total} записей · страница {page} из {Math.max(totalPages, 1)}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <FilterField label="Статус">
            <Select value={status} onValueChange={(v) => { setStatus(v as BookingStatus | "all"); setOffset(0) }}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="confirmed">Подтверждённые</SelectItem>
                <SelectItem value="cancelled">Отменённые</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Тип звонка">
            <Select value={callTypeId} onValueChange={(v) => { setCallTypeId(v); setOffset(0) }}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Все типы" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                {callTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="С">
            <Input
              type="datetime-local"
              className="w-52"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setOffset(0) }}
            />
          </FilterField>
          <FilterField label="По">
            <Input
              type="datetime-local"
              className="w-52"
              value={to}
              onChange={(e) => { setTo(e.target.value); setOffset(0) }}
            />
          </FilterField>
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Бронирования не найдены.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Тип</TableHead>
                <TableHead>Начало</TableHead>
                <TableHead>Окончание</TableHead>
                <TableHead>Гость</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="w-28 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.callTypeName}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(b.startTime)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(b.endTime)}</TableCell>
                  <TableCell>
                    <div>{b.guestName}</div>
                    <div className="text-xs text-muted-foreground">{b.guestEmail}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={b.status === "confirmed" ? "default" : "secondary"}>
                      {b.status === "confirmed" ? "подтверждено" : "отменено"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {b.status === "confirmed" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">Отменить</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Отменить бронирование?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Слот {b.callTypeName} будет освобождён и снова доступен для записи.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Закрыть</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void handleCancel(b)}>
                              Отменить запись
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            disabled={offset === 0 || loading}
            onClick={() => setOffset((o) => Math.max(0, o - limit))}
          >
            ← Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            {offset + 1}–{Math.min(offset + limit, total)} из {total}
          </span>
          <Button
            variant="outline"
            disabled={offset + limit >= total || loading}
            onClick={() => setOffset((o) => o + limit)}
          >
            Вперёд →
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}