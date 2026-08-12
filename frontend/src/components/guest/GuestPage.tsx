import { useState } from "react"
import { bookingsApi } from "@/api/endpoints"
import type { Booking, CallType, Slot } from "@/api/types"
import { hasProblemCode } from "@/api/client"
import { BookingForm } from "@/components/guest/BookingForm"
import { BookingSuccess } from "@/components/guest/BookingSuccess"
import { CallTypeCards } from "@/components/guest/CallTypeCards"
import { SlotPicker } from "@/components/guest/SlotPicker"
import { useCallTypes } from "@/hooks/useCallTypes"
import { useSlots } from "@/hooks/useSlots"

type Step =
  | { name: "types" }
  | { name: "slots"; callType: CallType }
  | { name: "form"; callType: CallType; slot: Slot }
  | { name: "success"; booking: Booking }

const initialDay = new Date()

export function GuestPage() {
  const { types, loading, error } = useCallTypes()
  const [step, setStep] = useState<Step>({ name: "types" })
  const [selected, setSelected] = useState<Slot | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const currentCallType =
    step.name === "slots" || step.name === "form" ? step.callType : null
  const { slots, loading: slotsLoading, error: slotsError } = useSlots(currentCallType)

  const handleSelectType = (callType: CallType) => {
    setSelected(null)
    setSubmitError(null)
    setStep({ name: "slots", callType })
  }

  const handleSelectSlot = (slot: Slot) => {
    if (step.name !== "slots") return
    setSelected(slot)
    setStep({ name: "form", callType: step.callType, slot })
    setSubmitError(null)
  }

  const handleBackToTypes = () => setStep({ name: "types" })

  const handleBackToSlots = () => {
    if (step.name === "form") {
      setStep({ name: "slots", callType: step.callType })
      setSubmitError(null)
    }
  }

  const handleSubmit = async (values: {
    guestName: string
    guestEmail: string
    guestComment?: string
  }) => {
    if (step.name !== "form") return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const booking = await bookingsApi.create({
        callTypeId: step.callType.id,
        startTime: step.slot.startTime,
        guestName: values.guestName,
        guestEmail: values.guestEmail,
        guestComment: values.guestComment,
      })
      setStep({ name: "success", booking })
    } catch (e) {
      let message = e instanceof Error ? e.message : "Не удалось создать запись"
      if (hasProblemCode(e, "SLOT_UNAVAILABLE")) {
        message = "Выбранное время только что занял другой гость. Вернитесь к слотам и выберите другое время."
      } else if (hasProblemCode(e, "SLOT_BLOCKED")) {
        message = "Выбранное время заблокировал владелец. Выберите другое время."
      } else if (hasProblemCode(e, "IDEMPOTENCY_KEY_REUSED")) {
        message = "Запрос отправлен повторно с другим содержимым."
      }
      setSubmitError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleReset = () => {
    setSelected(null)
    setSubmitError(null)
    setStep({ name: "types" })
  }

  return (
    <div className="flex flex-col gap-4">
      {step.name === "types" && (
        <>
          <div className="text-sm text-muted-foreground">
            Выберите тип звонка, чтобы увидеть свободные слоты на ближайшие 14 дней.
          </div>
          {error && <div className="text-sm text-destructive">{error}</div>}
          <CallTypeCards types={types} loading={loading} onSelect={handleSelectType} />
        </>
      )}

      {step.name === "slots" && (
        <SlotPicker
          callType={step.callType}
          slots={slots}
          loading={slotsLoading}
          error={slotsError}
          selected={selected}
          initialDay={initialDay}
          onSelect={handleSelectSlot}
          onBack={handleBackToTypes}
        />
      )}

      {step.name === "form" && (
        <BookingForm
          callType={step.callType}
          slot={step.slot}
          submitting={submitting}
          serverError={submitError}
          onSubmit={handleSubmit}
          onBack={handleBackToSlots}
        />
      )}

      {step.name === "success" && (
        <BookingSuccess booking={step.booking} onReset={handleReset} />
      )}
    </div>
  )
}