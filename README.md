### Hexlet tests and linter status:
[![Actions Status](https://github.com/tannin-dragon/ai-for-developers-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/tannin-dragon/ai-for-developers-project-386/actions)

# Callendar — бронирование звонков

Учебный проект «Call + Calendar»: владелец календаря публикует типы звонков, гость
без регистрации выбирает свободный слот и записывается. Всё строится от единого
контракта API (TypeSpec → OpenAPI), по которому реализованы фронтенд и бэкенд.

**Роли:**

- **Гость** — список типов звонков → свободные слоты → форма (имя, email, комментарий) → бронирование.
- **Владелец** — вход по ключу `X-Owner-Key`: CRUD типов звонков, список и отмена броней,
  блокировки времени, профиль (таймзона, рабочий график).

**Ключевые правила** (на стороне бэкенда): окно записи `[сейчас, +14 дней)`, рабочее время
по таймзоне владельца (по умолчанию Пн–Пт 09:00–18:00), сетка слотов 15/30 минут, запрет
пересечений активных броней (даже разных типов) и блокировок, идемпотентное создание брони
по заголовку `Idempotency-Key`, ошибки в формате RFC 7807 (`application/problem+json`).

## Стек

| Слой | Технологии |
|---|---|
| Контракт | TypeSpec 1.14 → OpenAPI 3.1 (`@typespec/openapi3`) |
| Фронтенд | Vite + React 19 + TypeScript + shadcn/ui + Tailwind 4 |
| Бэкенд | Node 22 + Hono + zod; таймзоны — `date-fns` + `@date-fns/tz`; **хранилище в памяти** |
| Раздача | Docker Compose: nginx (`:8080`) → SPA-статика + прокси `/v1` → сервис `api` |

## Структура

```
public/
├── main.tsp                  # единственный исходник контракта
├── tsp-output/schema/        # сгенерированный openapi.yaml (в .gitignore)
├── frontend/                 # SPA (гость + панель владельца)
├── backend/                  # API по контракту (in-memory)
│   └── scripts/e2e.ps1       # E2E-проверка всех операций (47 проверок)
└── AGENTS.md                 # детальная справка проекта
```

Уровнем выше (`../`): `docker-compose.yml`, `nginx/default.conf` — локальная инфраструктура.

## Быстрый старт

Требования: Docker Desktop, Node.js 22+, `app.loc` → `127.0.0.1` в hosts.
На машине с корпоративным MITM-прокси в каждой новой консоли: `$env:NODE_OPTIONS="--use-system-ca"`.

```powershell
# 1. Контракт
cd public
npm install
npx tsp compile .            # → tsp-output/schema/openapi.yaml

# 2. Фронтенд
cd frontend && npm install && npm run build

# 3. Бэкенд
cd ../backend && npm install && npm run build

# 4. Стек
cd ../..                     # каталог с docker-compose.yml
docker compose up -d
```

Открыть **http://app.loc:8080**. Ключ владельца по умолчанию: **`dev-owner-key`**.

> Хранилище в памяти: рестарт `app-api-1` сбрасывает данные и накатывает сид
> (профиль Europe/Moscow Пн–Пт 09:00–18:00 + типы «Интервью» 30/15 и «Консультация» 60/30).

## Деплой (Docker / Railway)

В корне репозитория лежит `Dockerfile`: многоступенчатая сборка собирает фронтенд
и бэкенд в единый образ. Один Node-процесс на порту из переменной окружения `PORT`
отдаёт и SPA-фронтенд (`/v1` проксируется на тот же процесс — кросс-домена нет),
т.е. приложению достаточно одного порта и одной публичной ссылки.

```bash
# Локальная проверка образа
docker build -t callendar .
docker run --rm -p 3000:3000 -e PORT=3000 -e OWNER_KEY=dev-owner-key callendar
# → http://localhost:3000 (SPA), http://localhost:3000/v1/call-types (API)
```

Переменные окружения: `PORT` (обязателен, задаётся платформой), `OWNER_KEY`
(секрет владельца), `SEED_DEMO` (`true`/`false`). Railway выдаёт публичный URL
при создании web service из этого Dockerfile — деплой автоматический, `PORT`
подставляется платформой.

## Конфигурация

Бэкенд (env, см. `backend/.env.example`):

| Переменная | Дефолт | Назначение |
|---|---|---|
| `PORT` | `3000` | порт API внутри compose-сети |
| `OWNER_KEY` | `dev-owner-key` | ключ владельца (`X-Owner-Key`) |
| `SEED_DEMO` | `true` | сидировать демо-типы звонков при старте |

Фронтенд: `VITE_API_URL` (дефолт `/v1`), `VITE_PROXY_TARGET` (dev-прокси, дефолт `http://app.loc:8080`) — см. `frontend/.env.example`.

## Тесты и проверки

```powershell
cd public/backend
npm test                    # vitest: слоты, сетка, окно 14 дней, DST, конфликты (28 тестов)
docker restart app-api-1    # свежий стейт
pwsh scripts/e2e.ps1        # E2E через http://app.loc:8080 (47 проверок всех операций и ошибок)

cd ../frontend
npm run build && npm run lint
```

### E2E-тесты Playwright (UI)

Сценарии для проверки зафиксированы в `tests/*.spec.ts` — гостевой флоу бронирования,
вход владельца и просмотр бронирований, создание/редактирование/удаление типов звонков,
блокировка и снятие блокировки слотов. Тесты самодостаточны (сами создают тестовые данные
через API) и детерминированы на чистом состоянии.

Локальный запуск (нужен поднятый стек, см. «Быстрый старт»):

```powershell
cd public
npm install
npx playwright install chromium   # в первый раз
npx playwright test               # → 5 passed (BASE_URL по умолчанию http://app.loc:8080)
```

Запуск с другим адресом стека:

```powershell
$env:BASE_URL="http://localhost:8080"; npx playwright test
```

## CI (GitHub Actions)

E2E и интеграционные проверки автоматически запускаются в GitHub Actions по workflow
`.github/workflows/e2e.yml` на каждый push в `main` и на каждый pull request.

Что делает job `e2e` (trusted runner, `ubuntu-latest`):

1. `actions/checkout` + `actions/setup-node` (Node.js 22).
2. В корне репозитория: `npm install` + `npx playwright install --with-deps chromium`.
3. Build бэкенда (`backend/` → `dist/`) и фронтенда (`frontend/` → `dist/`).
4. Поднимает CI-стек `docker compose --project-directory . -f e2e/docker-compose.ci.yml up -d api nginx`
   — отдельный минимальный compose только с `api` + `nginx` (без php/mariadb/../certs локального стека).
5. Ждёт готовности `http://localhost:8080` (curl с ретраями).
6. Прогоняет Playwright: `npx playwright test` c `BASE_URL=http://localhost:8080` и `CI=1`
   (report `list` + `github`, retries 1 на свежем состоянии API).
7. При падении выгружает `playwright-report/` артефактом (`retention-days: 7`).

Статус последнего прогона

[![E2E tests](https://github.com/tannin-dragon/ai-for-developers-project-386/actions/workflows/e2e.yml/badge.svg)](https://github.com/tannin-dragon/ai-for-developers-project-386/actions/workflows/e2e.yml)

Прогнать тот же CI-сценарий локально можно так:

```powershell
cd public/backend && npm install && npm run build   # dist/
cd ../frontend && npm install && npm run build      # dist/
cd ..
$env:BASE_URL="http://localhost:8080"; $env:CI="1"
npx playwright test
```

## Режим разработки

```powershell
cd public/frontend
$env:VITE_PROXY_TARGET="http://app.loc:8080"   # или http://localhost:3000 напрямую
npm run dev                  # http://localhost:5173 с HMR

cd ../backend
npm run dev                  # tsx watch, порт 3000
```

После правок бэкенда в прод-раздаче: `npm run build` в `backend/` + `docker restart app-api-1`.

## API

Базовый путь `/v1`. Полная спецификация — `main.tsp` (документация в `@doc`-комментариях)
и сгенерированный `tsp-output/schema/openapi.yaml`.

| Метод | Путь | Доступ |
|---|---|---|
| GET / POST / PATCH / DELETE | `/call-types[/{id}]` | список — гость; изменение — владелец |
| GET | `/call-types/{id}/slots` | гость |
| GET / POST | `/bookings` | список — владелец; создание — гость (`Idempotency-Key`) |
| GET | `/bookings/{id}` | гость |
| POST | `/bookings/{id}/cancel` | владелец |
| GET / POST / DELETE | `/blocked-slots[/{id}]` | владелец |
| GET / PATCH | `/owner/profile` | владелец |

Ошибки: `application/problem+json`, машинный код в `title`
(`SLOT_UNAVAILABLE`, `SLOT_BLOCKED`, `IDEMPOTENCY_KEY_REUSED`, `INVALID_OWNER_KEY` и др.),
полевые ошибки — в `errors[]`.

## Известные ограничения

- Хранилище в памяти по ТЗ: перезапуск сервиса сбрасывает данные. Следующий шаг —
  Postgres (`EXCLUDE USING gist (tsrange(start, end) WITH &&)` на активных бронях).
- Один владелец, один календарь; регистрации и аккаунтов нет.
- `docker-compose.yml` и `nginx/default.conf` живут вне репозитория (уровнем выше `public/`).
