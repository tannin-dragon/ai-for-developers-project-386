import { test, expect, Page } from "@playwright/test";

const OWNER_KEY = "dev-owner-key";

async function loginAsOwner(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Callendar");
  await page.getByRole("tab", { name: /^Владелец$/ }).click();
  await page.getByLabel(/^Ключ владельца$/).fill(OWNER_KEY);
  await page.getByRole("button", { name: /^Войти$/ }).click();
  await expect(page.getByText("Панель владельца активна", { exact: true })).toBeVisible();
}

function localInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test("владелец: создать и удалить тип звонка", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await loginAsOwner(page);

  await expect(page.locator('[data-slot="card-title"]').filter({ hasText: /^Типы звонков$/ })).toBeVisible();
  await page.getByRole("button", { name: /^Создать тип$/ }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("h2")).toContainText("Создать тип звонка");

  const typeName = `E2E тип ${Date.now()}`;
  await page.getByLabel("Название").fill(typeName);
  await page.getByLabel("Описание").fill("Создан автотестом");
  await page.getByLabel("Длительность (минут)").fill("45");
  await page.getByRole("combobox", { name: /^Шаг сетки слотов$/ }).click();
  await page.getByRole("option", { name: /^15 минут$/ }).click();

  await page.getByRole("button", { name: /^Создать$/ }).click();

  const row = page.locator("table tbody tr").filter({ hasText: typeName });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("45 мин");
  await expect(row).toContainText("15 мин");

  await row.getByRole("button", { name: /^Удалить$/ }).click();
  const alert = page.getByRole("alertdialog");
  await expect(alert).toBeVisible();
  await expect(alert.locator("h2")).toContainText(`Удалить тип «${typeName}»?`);
  await alert.getByRole("button", { name: /^Удалить$/ }).click();

  await expect(row).toHaveCount(0);

  console.log(`[debug] console errors (${consoleErrors.length}):`, consoleErrors.join("\n"));
});

test("владелец: отредактировать тип звонка", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await loginAsOwner(page);

  await expect(page.locator('[data-slot="card-title"]').filter({ hasText: /^Типы звонков$/ })).toBeVisible();
  await page.getByRole("button", { name: /^Создать тип$/ }).click();

  const dialog = page.getByRole("dialog");
  const typeName = `E2E edit ${Date.now()}`;
  await page.getByLabel("Название").fill(typeName);
  await page.getByRole("button", { name: /^Создать$/ }).click();

  const row = page.locator("table tbody tr").filter({ hasText: typeName });
  await expect(row).toHaveCount(1);

  await row.getByRole("button", { name: /^Изменить$/ }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("h2")).toContainText("Изменить");

  const newName = `E2E renamed ${Date.now()}`;
  await page.getByLabel("Название").fill(newName);
  await page.getByLabel("Длительность (минут)").fill("60");
  await page.getByRole("button", { name: /^Сохранить$/ }).click();

  const newRow = page.locator("table tbody tr").filter({ hasText: newName });
  await expect(newRow).toHaveCount(1);
  await expect(newRow).toContainText("60 мин");
  await expect(page.locator("table tbody tr").filter({ hasText: typeName })).toHaveCount(0);

  await newRow.getByRole("button", { name: /^Удалить$/ }).click();
  const alert = page.getByRole("alertdialog");
  await expect(alert).toBeVisible();
  await alert.getByRole("button", { name: /^Удалить$/ }).click();

  await expect(newRow).toHaveCount(0);

  console.log(`[debug] console errors (${consoleErrors.length}):`, consoleErrors.join("\n"));
});

test("владелец: заблокировать и снять блокировку слота", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await loginAsOwner(page);

  await page.getByRole("tab", { name: /^Блокировки$/ }).click();
  await expect(page.locator('[data-slot="card-title"]').filter({ hasText: /^Заблокировать время$/ })).toBeVisible();

  const start = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  start.setHours(7, 0, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const reason = `e2e-block-${Date.now()}`;

  await page.locator('input[type="datetime-local"]').nth(0).fill(localInput(start));
  await page.locator('input[type="datetime-local"]').nth(1).fill(localInput(end));
  await page.getByPlaceholder(/Отпуск, встреча/).fill(reason);

  await page.getByRole("button", { name: /^Заблокировать$/ }).click();

  const row = page.locator("table tbody tr").filter({ hasText: reason });
  await expect(row).toHaveCount(1);

  await row.getByRole("button", { name: /^Снять$/ }).click();
  const alert = page.getByRole("alertdialog");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText("Снять блокировку?");
  await alert.getByRole("button", { name: /^Снять блокировку$/ }).click();

  await expect(row).toHaveCount(0);

  console.log(`[debug] console errors (${consoleErrors.length}):`, consoleErrors.join("\n"));
});