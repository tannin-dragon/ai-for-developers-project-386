import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CallType } from "@/api/types"

const schema = z.object({
  name: z.string().trim().min(1, "Введите название"),
  description: z.string().trim().max(1000, "Слишком длинное описание"),
  durationMinutes: z.coerce
    .number({ message: "Укажите длительность" })
    .int("Целое число минут")
    .min(5, "Минимум 5 минут")
    .max(480, "Максимум 480 минут"),
  slotStepMinutes: z.enum(["15", "30"], { message: "Выберите шаг сетки" }),
})

export type CallTypeFormValues = {
  name: string
  description: string
  durationMinutes: number
  slotStepMinutes: 15 | 30
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  submitLabel: string
  initialValues: CallType | null
  onSubmit: (values: CallTypeFormValues) => Promise<void>
}

const toFormValues = (initial: CallType | null) => ({
  name: initial?.name ?? "",
  description: initial?.description ?? "",
  durationMinutes: initial?.durationMinutes ?? 30,
  slotStepMinutes: initial ? String(initial.slotStepMinutes) as "15" | "30" : ("30" as "15" | "30"),
})

export function CallTypeFormDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  initialValues,
  onSubmit,
}: Props) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(initialValues),
  })

  const handleSubmit = form.handleSubmit(async (values) => {
    const parsed = schema.parse(values)
    try {
      await onSubmit({
        name: parsed.name,
        description: parsed.description,
        durationMinutes: parsed.durationMinutes,
        slotStepMinutes: Number(parsed.slotStepMinutes) as 15 | 30,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка сохранения")
    }
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) form.reset(toFormValues(initialValues))
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Параметры типа звонка.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input placeholder="Консультация" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание</FormLabel>
                  <FormControl>
                    <Textarea className="min-h-16" placeholder="О чём звонок" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="durationMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Длительность (минут)</FormLabel>
                  <FormControl>
                    <Input type="number" min={5} max={480} step={5} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="slotStepMinutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Шаг сетки слотов</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Выберите шаг" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="15">15 минут</SelectItem>
                      <SelectItem value="30">30 минут</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit">{submitLabel}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}