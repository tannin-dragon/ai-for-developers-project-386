import { useState } from "react"
import { GuestPage } from "@/components/guest/GuestPage"
import { OwnerPage } from "@/components/owner/OwnerPage"
import { Toaster } from "@/components/ui/sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Mode = "guest" | "owner"

export default function App() {
  const [mode, setMode] = useState<Mode>("guest")

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Callendar</h1>
        <p className="text-sm text-muted-foreground">
          Бронирование звонков — окно записи 14 дней
        </p>
      </header>

      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="guest">Гость</TabsTrigger>
          <TabsTrigger value="owner">Владелец</TabsTrigger>
        </TabsList>
        <TabsContent value="guest" className="mt-4">
          <GuestPage />
        </TabsContent>
        <TabsContent value="owner" className="mt-4">
          <OwnerPage onLock={() => setMode("guest")} />
        </TabsContent>
      </Tabs>

      <Toaster />
    </div>
  )
}