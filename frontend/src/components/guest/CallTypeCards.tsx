import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CallType } from "@/api/types"

interface Props {
  types: CallType[]
  loading: boolean
  onSelect: (type: CallType) => void
}

export function CallTypeCards({ types, loading, onSelect }: Props) {
  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="gap-2">
              <div className="h-4 w-1/3 rounded-md bg-muted" />
              <div className="h-3 w-full rounded-md bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-24 rounded-md bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (types.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Типы звонков пока не добавлены.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {types.map((type) => (
        <Card key={type.id}>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>{type.name}</CardTitle>
              <CardDescription className="mt-1">{type.description}</CardDescription>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {type.durationMinutes} мин
            </Badge>
          </CardHeader>
          <CardContent>
            <Button onClick={() => onSelect(type)}>Выбрать слот</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}