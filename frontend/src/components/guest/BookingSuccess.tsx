import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { Booking } from "@/api/types"
import { formatDateTime } from "@/lib/time"

interface Props {
  booking: Booking
  onReset: () => void
}

export function BookingSuccess({ booking, onReset }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-green-600 dark:text-green-500">
          Запись подтверждена
        </CardTitle>
        <CardDescription>
          Мы отправили подтверждение на {booking.guestEmail}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Номер записи</span>
          <Badge variant="outline">{booking.id}</Badge>
        </div>
        <Separator />
        <InfoRow label="Тип звонка" value={booking.callTypeName} />
        <InfoRow label="Начало" value={formatDateTime(booking.startTime)} />
        <InfoRow label="Окончание" value={formatDateTime(booking.endTime)} />
        <InfoRow label="Имя" value={booking.guestName} />
        {booking.guestComment && (
          <InfoRow label="Комментарий" value={booking.guestComment} />
        )}
        <Separator />
        <Button variant="outline" onClick={onReset} className="mt-2">
          Записаться ещё раз
        </Button>
      </CardContent>
    </Card>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  )
}