import { useState } from "react"
import { useCallTypes } from "@/hooks/useCallTypes"
import { OwnerKeyGate } from "@/components/owner/OwnerKeyGate"
import { CallTypesManager } from "@/components/owner/CallTypesManager"
import { BookingsTable } from "@/components/owner/BookingsTable"
import { BlockedSlotsManager } from "@/components/owner/BlockedSlotsManager"
import { ProfileForm } from "@/components/owner/ProfileForm"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { OWNER_KEY_STORAGE } from "@/api/client"

interface Props {
  onLock: () => void
}

export function OwnerPage({ onLock }: Props) {
  const [ownerKey, setOwnerKey] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(OWNER_KEY_STORAGE) : null
  )
  const { types } = useCallTypes()

  const handleUnlock = (key: string) => {
    setOwnerKey(key)
    localStorage.setItem(OWNER_KEY_STORAGE, key)
  }

  const handleLock = () => {
    localStorage.removeItem(OWNER_KEY_STORAGE)
    setOwnerKey(null)
    onLock()
  }

  if (!ownerKey) {
    return <OwnerKeyGate onUnlock={handleUnlock} />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          Панель владельца активна
        </span>
        <Button variant="outline" size="sm" onClick={handleLock}>
          Выйти
        </Button>
      </div>
      <Tabs defaultValue="types">
        <TabsList>
          <TabsTrigger value="types">Типы звонков</TabsTrigger>
          <TabsTrigger value="bookings">Бронирования</TabsTrigger>
          <TabsTrigger value="blocks">Блокировки</TabsTrigger>
          <TabsTrigger value="profile">Профиль</TabsTrigger>
        </TabsList>
        <TabsContent value="types">
          <CallTypesManager ownerKey={ownerKey} />
        </TabsContent>
        <TabsContent value="bookings">
          <BookingsTable ownerKey={ownerKey} callTypes={types} />
        </TabsContent>
        <TabsContent value="blocks">
          <BlockedSlotsManager ownerKey={ownerKey} />
        </TabsContent>
        <TabsContent value="profile">
          <ProfileForm ownerKey={ownerKey} />
        </TabsContent>
      </Tabs>
    </div>
  )
}