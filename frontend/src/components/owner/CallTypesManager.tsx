import { useEffect, useState } from "react"
import { callTypesApi } from "@/api/endpoints"
import type { CallType } from "@/api/types"
import { ApiError } from "@/api/client"
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
import { CallTypeFormDialog, type CallTypeFormValues } from "./CallTypeFormDialog"

interface Props {
  ownerKey: string
}

export function CallTypesManager({ ownerKey }: Props) {
  const [types, setTypes] = useState<CallType[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<CallType | null>(null)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerKey])

  const load = async () => {
    setLoading(true)
    try {
      const res = await callTypesApi.list()
      setTypes(res.items)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось загрузить типы звонков")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (values: CallTypeFormValues) => {
    const created = await callTypesApi.create(ownerKey, values)
    toast.success(`Тип «${created.name}» создан`)
    setCreateOpen(false)
    void load()
  }

  const handleUpdate = async (values: CallTypeFormValues) => {
    if (!editTarget) return
    await callTypesApi.update(ownerKey, editTarget.id, values)
    toast.success("Тип обновлён")
    setEditTarget(null)
    void load()
  }

  const handleDelete = async (type: CallType) => {
    try {
      await callTypesApi.delete(ownerKey, type.id)
      toast.success(`Тип «${type.name}» удалён`)
      void load()
    } catch (e) {
      const message =
        e instanceof ApiError && e.status === 409
          ? "Нельзя удалить: есть активные бронирования этого типа"
          : e instanceof Error
            ? e.message
            : "Не удалось удалить тип"
      toast.error(message)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Типы звонков</CardTitle>
          <CardDescription>Управление доступными типами звонков.</CardDescription>
        </div>
        <Button onClick={() => setCreateOpen(true)}>Создать тип</Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : types.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Типы звонков не найдены.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Описание</TableHead>
                <TableHead>Длительность</TableHead>
                <TableHead>Шаг сетки</TableHead>
                <TableHead className="w-32 text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="font-medium">{type.name}</TableCell>
                  <TableCell className="text-muted-foreground">{type.description}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{type.durationMinutes} мин</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {type.slotStepMinutes} мин
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" onClick={() => setEditTarget(type)}>
                        Изменить
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-destructive">
                            Удалить
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Удалить тип «{type.name}»?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Удаление невозможно, если есть подтверждённые бронирования этого типа.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void handleDelete(type)}>
                              Удалить
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <CallTypeFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Создать тип звонка"
        submitLabel="Создать"
        initialValues={null}
        onSubmit={handleCreate}
      />
      <CallTypeFormDialog
        open={!!editTarget}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
        title="Изменить тип звонка"
        submitLabel="Сохранить"
        initialValues={editTarget}
        onSubmit={handleUpdate}
      />
    </Card>
  )
}