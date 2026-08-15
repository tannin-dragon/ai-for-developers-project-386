import { test, expect } from "@playwright/test";

const OWNER_KEY = "dev-owner-key";

async function seedBooking(request: any) {
  const typeRes = await request.post("/v1/call-types", {
    headers: { "X-Owner-Key": OWNER_KEY },
    data: {
      name: `E2E Seed ${Date.now()}`,
      description: "Создан автотестом",
      durationMinutes: 30,
      slotStepMinutes: 15,
    },
  });
  if (!typeRes.ok()) throw new Error(`seed call type failed: ${typeRes.status()}`);
  const type = (await typeRes.json()) as { id: string };

  const slots = await (
    await request.get(`/v1/call-types/${type.id}/slots`)
  ).json() as { startTime: string }[];
  const slot = slots[0];
  if (!slot) throw new Error("no slots available");

  const res = await request.post("/v1/bookings", {
    headers: { "Idempotency-Key": `e2e-owner-${Date.now()}` },
    data: {
      callTypeId: type.id,
      startTime: slot.startTime,
      guestName: "E2E Владелец",
      guestEmail: `e2e-owner-${Date.now()}@example.com`,
    },
  });
  if (!res.ok()) throw new Error(`seed booking failed: ${res.status()}`);
}

test("флоу владельца: вход по ключу и просмотр бронирований", async ({ page, request }) => {
  await seedBooking(request);

  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Callendar");

  await page.getByRole("tab", { name: /^Владелец$/ }).click();

  await expect(page.locator('[data-slot="card-title"]').filter({ hasText: /^Панель владельца$/ })).toBeVisible();

  await page.getByLabel(/^Ключ владельца$/).fill(OWNER_KEY);
  await page.getByRole("button", { name: /^Войти$/ }).click();

  await expect(page.getByText("Панель владельца активна", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Выйти$/ })).toBeVisible();

  const bookingsTab = page.getByRole("tab", { name: /^Бронирования$/ });
  await expect(bookingsTab).toBeVisible();
  await bookingsTab.click();

  await expect(page.locator('[data-slot="card-title"]').filter({ hasText: /^Бронирования$/ })).toBeVisible();

  const tableHead = page.locator("table th");
  await expect(tableHead.filter({ hasText: /^Тип$/ })).toBeVisible();
  await expect(tableHead.filter({ hasText: /^Начало$/ })).toBeVisible();
  await expect(tableHead.filter({ hasText: /^Гость$/ })).toBeVisible();
  await expect(tableHead.filter({ hasText: /^Статус$/ })).toBeVisible();

  console.log(`[debug] console errors (${consoleErrors.length}):`, consoleErrors.join("\n"));
});