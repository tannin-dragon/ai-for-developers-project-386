import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { CallType, Slot } from "@/api/types"
import { formatDelay } from "@/lib/time"

const bookingSchema = z.object({
  guestName: z.string().trim().min(1, "Введите имя"),
  guestEmail: z.string().trim().email("Введите корректный email"),
  guestComment: z.string().trim().max(1000, "Слишком длинный комментарий").optional().or(z.literal("")),
})

type BookingFormValues = z.infer<typeof bookingSchema>

interface Props {
  callType: CallType
  slot: Slot
  submitting: boolean
  serverError: string | null
  onSubmit: (values: { guestName: string; guestEmail: string; guestComment?: string }) => Promise<void>
  onBack: () => void
}

export function BookingForm({ callType, slot, submitting, serverError, onSubmit, onBack }: Props) {
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: { guestName: "", guestEmail: "", guestComment: "" },
  })

  const handleSubmit = form.handleSubmit(async (values) => {
    await onSubmit({
      guestName: values.guestName,
      guestEmail: values.guestEmail,
      guestComment: values.guestComment?.trim() || undefined,
    })
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Подтверждение записи</CardTitle>
        <CardDescription>
          {callType.name} · {formatDelay(slot, callType)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="guestName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Имя</FormLabel>
                  <FormControl>
                    <Input placeholder="Иван Петров" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="guestEmail"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="ivan@example.com" {...field} />
                  </FormControl>
                  <FormDescription>
                    На этот адрес будет отправлено подтверждение.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="guestComment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Комментарий (необязательно)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Что хотите обсудить?"
                      className="min-h-20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {serverError && (
              <Alert variant="destructive">
                <AlertTitle>Не удалось создать запись</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}
            <div className="flex items-center justify-between">
              <Button type="button" variant="outline" onClick={onBack} disabled={submitting}>
                ← Назад к слотам
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Отправка…" : "Записаться"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}