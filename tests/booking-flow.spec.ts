import { test, expect } from "@playwright/test";

const UNIQUE_EMAIL = `e2e-${Date.now()}@example.com`;
const GUEST_NAME = "Тест Плейрайт";

test("гостевой флоу бронирования", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Callendar");

  const interviewCard = page.locator('[data-slot="card"]').filter({ hasText: "Интервью" });
  await interviewCard.getByRole("button", { name: /^Выбрать слот$/ }).click();

  await expect(page.locator('[data-slot="card-title"]', { hasText: /Свободные слоты/ })).toBeVisible();

  const dayButton = page.locator('[role="grid"] button:not([disabled])').first();
  await expect(dayButton).toBeVisible();
  await dayButton.click();

  const slotButton = page.getByRole("button", { name: /^\d{1,2}:\d{2} (AM|PM)$/ }).first();
  await expect(slotButton).toBeVisible();
  await slotButton.click();

  await expect(page.locator('[data-slot="card-title"]', { hasText: /^Подтверждение записи$/ })).toBeVisible();

  await page.getByLabel("Имя").fill(GUEST_NAME);
  await page.getByLabel("Email").fill(UNIQUE_EMAIL);
  await page.getByLabel(/Комментарий/).fill("Тестовый прогон E2E");

  await page.getByRole("button", { name: /^Записаться$/ }).click();

  await expect(page.locator('[data-slot="card-title"]', { hasText: /^Запись подтверждена$/ })).toBeVisible();
  await expect(page.getByText(`Мы отправили подтверждение на ${UNIQUE_EMAIL}.`, { exact: true })).toBeVisible();

  const summary = page.locator('[data-slot="card"]').filter({ hasText: "Запись подтверждена" }).first();
  await expect(summary).toContainText("Номер записи");
  await expect(summary).toContainText(GUEST_NAME);
  await expect(summary).toContainText("Интервью");

  console.log(`[debug] console errors (${consoleErrors.length}):`, consoleErrors.join("\n"));
});