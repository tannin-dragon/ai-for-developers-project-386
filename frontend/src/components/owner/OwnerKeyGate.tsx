import { useState, type FormEvent } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Props {
  onUnlock: (key: string) => void
}

export function OwnerKeyGate({ onUnlock }: Props) {
  const [key, setKey] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = key.trim()
    if (!trimmed) {
      setError("Введите ключ владельца")
      return
    }
    setError(null)
    onUnlock(trimmed)
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Панель владельца</CardTitle>
        <CardDescription>
          Введите ключ владельца календаря (X-Owner-Key). Ключ хранится только в этом браузере.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="owner-key">Ключ владельца</Label>
            <Input
              id="owner-key"
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="секретный ключ"
              autoComplete="off"
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit">Войти</Button>
        </form>
      </CardContent>
    </Card>
  )
}