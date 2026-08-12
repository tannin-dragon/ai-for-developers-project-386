import { request } from "./client"
import type {
  BlockedSlot,
  BlockedSlotCreate,
  Booking,
  BookingCreate,
  BookingListParams,
  BookingPage,
  CallType,
  CallTypeCreate,
  CallTypeUpdate,
  OwnerProfile,
  OwnerProfileUpdate,
  Slot,
} from "./types"

const ownerHeaders = (ownerKey: string) => ({ "X-Owner-Key": ownerKey })

/** Работа с типами звонков. */
export const callTypesApi = {
  list: () => request<{ items: CallType[] }>("/call-types"),

  create: (ownerKey: string, body: CallTypeCreate) =>
    request<CallType>("/call-types", {
      method: "POST",
      headers: ownerHeaders(ownerKey),
      body,
    }),

  update: (ownerKey: string, id: string, body: CallTypeUpdate) =>
    request<CallType>(`/call-types/${id}`, {
      method: "PATCH",
      headers: ownerHeaders(ownerKey),
      body,
    }),

  delete: (ownerKey: string, id: string) =>
    request<void>(`/call-types/${id}`, {
      method: "DELETE",
      headers: ownerHeaders(ownerKey),
    }),

  listSlots: (id: string, from?: string, to?: string) =>
    request<Slot[]>(`/call-types/${id}/slots`, {
      query: { from, to },
    }),
}

/** Работа с бронированиями. */
export const bookingsApi = {
  list: (ownerKey: string, params: BookingListParams = {}) =>
    request<BookingPage>("/bookings", {
      query: params,
      headers: ownerHeaders(ownerKey),
    }),

  read: (id: string) => request<Booking>(`/bookings/${id}`),

  create: (body: BookingCreate, idempotencyKey?: string) =>
    request<Booking>("/bookings", {
      method: "POST",
      body,
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
      idempotencyKey: !idempotencyKey,
    }),

  cancel: (ownerKey: string, id: string) =>
    request<Booking>(`/bookings/${id}/cancel`, {
      method: "POST",
      headers: ownerHeaders(ownerKey),
    }),
}

/** Работа с блокировками времени. */
export const blockedSlotsApi = {
  list: (ownerKey: string) =>
    request<{ items: BlockedSlot[] }>("/blocked-slots", {
      headers: ownerHeaders(ownerKey),
    }),

  create: (ownerKey: string, body: BlockedSlotCreate) =>
    request<BlockedSlot>("/blocked-slots", {
      method: "POST",
      headers: ownerHeaders(ownerKey),
      body,
    }),

  delete: (ownerKey: string, id: string) =>
    request<void>(`/blocked-slots/${id}`, {
      method: "DELETE",
      headers: ownerHeaders(ownerKey),
    }),
}

/** Профиль владельца. */
export const ownerApi = {
  get: (ownerKey: string) =>
    request<OwnerProfile>("/owner/profile", {
      headers: ownerHeaders(ownerKey),
    }),

  update: (ownerKey: string, body: OwnerProfileUpdate) =>
    request<OwnerProfile>("/owner/profile", {
      method: "PATCH",
      headers: ownerHeaders(ownerKey),
      body,
    }),
}