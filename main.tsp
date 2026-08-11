import "@typespec/http";

using Http;

/**
 * Callendar — бронирование звонков (Call + Calendar).
 *
 * Две роли без регистрации:
 * - Владелец календаря — один заранее заданный профиль. Управляет типами звонков,
 *   блокировками слотов и бронированиями. Админ-операции защищены фиксированным ключом
 *   `X-Owner-Key` (секрет в конфигурации сервера).
 * - Гость — просматривает типы звонков, выбирает свободный слот и создаёт бронирование
 *   без входа в систему.
 *
 * Ограничения бронирования:
 * - Окно записи: 14 дней, начиная с текущей даты.
 * - Слоты формируются по рабочему графику и временной зоне владельца
 *   (см. /v1/owner/profile); по умолчанию Пн-Пт 09:00-18:00.
 * - Шаг сетки слотов задаётся для каждого типа звонка: 15 или 30 минут.
 * - На одно время нельзя создать две записи, даже для разных типов звонков (запрет пересечений).
 * - Времена в API передаются в формате ISO 8601 с явным смещением (offsetDateTime).
 */
@service(#{ title: "Callendar" })
@server("http://app.loc:8080", "Локальный сервер (OpenServer)")
@route("/v1")
namespace CalendarApi;

/** Тип звонка (вид брони), создаваемый владельцем календаря. */
model CallType {
  /** Идентификатор, генерируется сервером. */
  id: string;
  /** Название. */
  name: string;
  /** Описание. */
  description: string;
  /** Длительность звонка в минутах. */
  durationMinutes: int32;
  /** Шаг сетки свободных слотов: 15 или 30 минут. */
  slotStepMinutes: 15 | 30;
}

/** Данные для создания типа звонка (id генерирует сервер). */
model CallTypeCreate {
  name: string;
  description: string;
  durationMinutes: int32;
  slotStepMinutes: 15 | 30;
}

/** Данные для частичного обновления типа звонка. */
model CallTypeUpdate {
  name?: string;
  description?: string;
  durationMinutes?: int32;
  slotStepMinutes?: 15 | 30;
}

/** Свободный слот записи. */
model Slot {
  /** Начало слота, ISO 8601 со смещением. */
  startTime: offsetDateTime;
  /** Конец слота (startTime + длительность типа звонка), ISO 8601 со смещением. */
  endTime: offsetDateTime;
}

model CallTypeList {
  items: CallType[];
}

enum BookingStatus {
  /** Подтверждённая запись. */
  Confirmed: "confirmed",
  /** Отменённая запись (слот освобождён). */
  Cancelled: "cancelled",
}

/** Бронирование гостя на слот. */
model Booking {
  /** Идентификатор, генерируется сервером. */
  id: string;
  callTypeId: string;
  /** Название типа звонка (денормализовано для списков). */
  callTypeName: string;
  /** Начало встречи, ISO 8601 со смещением. */
  startTime: offsetDateTime;
  /** Конец встречи (startTime + длительность), ISO 8601 со смещением. */
  endTime: offsetDateTime;
  status: BookingStatus;
  guestName: string;
  guestEmail: string;
  guestComment?: string;
  /** Время создания бронирования, ISO 8601 со смещением. */
  createdAt: offsetDateTime;
}

/** Запрос на создание бронирования. */
model BookingCreate {
  callTypeId: string;
  /** Начало выбранного слота, ISO 8601 со смещением. Должно совпадать со свободным слотом. */
  startTime: offsetDateTime;
  guestName: string;
  guestEmail: string;
  guestComment?: string;
}

/** Ответ создания бронирования (HTTP 201). */
model BookingCreated {
  @statusCode statusCode: 201;
  @body booking: Booking;
}

/** Страница списка бронирований (пагинация offset/limit). */
model BookingPage {
  items: Booking[];
  /** Общее число записей, удовлетворяющих фильтру (до пагинации). */
  total: int32;
  limit: int32;
  offset: int32;
}

/** Заблокированный владельцем диапазон времени (глобальный для всех типов звонков). */
model BlockedSlot {
  id: string;
  startTime: offsetDateTime;
  endTime: offsetDateTime;
  /** Причина блокировки (необязательно). */
  reason?: string;
  createdAt: offsetDateTime;
}

/** Запрос на блокировку диапазона времени. */
model BlockedSlotCreate {
  startTime: offsetDateTime;
  endTime: offsetDateTime;
  reason?: string;
}

model BlockedSlotList {
  items: BlockedSlot[];
}

/** День недели по ISO 8601 (1 = Пн, ..., 7 = Вс). */
enum Weekday {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
}

/** Рабочий график владельца: дни недели и границы рабочего дня в его временной зоне. */
model WorkSchedule {
  weekdays: Weekday[];
  startTime: plainTime;
  endTime: plainTime;
}

/** Профиль владельца календаря (единый, заранее заданный). */
model OwnerProfile {
  name: string;
  email: string;
  /** IANA-идентификатор временной зоны, например Europe/Moscow. */
  timezone: string;
  workSchedule: WorkSchedule;
}

/** Данные для частичного обновления профиля владельца. */
model OwnerProfileUpdate {
  name?: string;
  email?: string;
  timezone?: string;
  workSchedule?: WorkSchedule;
}

/** Ключ владельца — обязательный заголовок для всех Owner-операций. */
model OwnerKey {
  /** Фиксированный ключ владельца (секрет, задаётся в конфигурации сервера). */
  @header("X-Owner-Key")
  ownerKey: string;
}

/** Ключ идемпотентности — обязательный заголовок на POST /bookings. */
model IdempotencyKey {
  /**
   * Непустая строка (например, UUID). Повторный запрос с тем же ключом и тем же телом
   * возвращает исходный ответ без создания дубликата.
   */
  @header("Idempotency-Key")
  idempotencyKey: string;
}

/** Ошибка валидации конкретного поля. */
model ValidationError {
  /** Путь к полю (например, startTime). */
  field: string;
  /** Машиночитаемый код ошибки. */
  code: string;
  /** Человекочитаемое описание. */
  message: string;
}

/** Базовая модель ошибки по RFC 7807 (application/problem+json). */
@error
model ProblemDetails {
  /** URI типа проблемы (опционально). */
  type?: string;
  /** Краткий заголовок. */
  title: string;
  /** Подробное описание (опционально). */
  detail?: string;
  /** Ошибки валидации по полям (опционально). */
  errors?: ValidationError[];
}

/**
 * Ошибка валидации запроса (HTTP 400).
 * Коды: `VALIDATION_ERROR`, `INVALID_START_TIME` (начало в прошлом),
 * `OUTSIDE_BOOKING_WINDOW` (слот вне окна 14 дней), `OUTSIDE_WORKING_HOURS` (вне рабочего графика),
 * `NOT_ALIGNED_TO_GRID` (слот не совпадает с сеткой типа), `INVALID_DURATION`,
 * `INVALID_EMAIL`, `INVALID_FILTER`, `INVALID_BLOCK_RANGE` (end <= start или время в прошлом),
 * `INVALID_LIMIT_OFFSET`.
 */
@error
model BadRequestProblem extends ProblemDetails {
  @statusCode statusCode: 400;
}

/**
 * Отсутствует или неверен ключ владельца (HTTP 401).
 * Код: `INVALID_OWNER_KEY`.
 */
@error
model UnauthorizedProblem extends ProblemDetails {
  @statusCode statusCode: 401;
}

/**
 * Ресурс не найден (HTTP 404).
 * Коды: `CALL_TYPE_NOT_FOUND`, `BOOKING_NOT_FOUND`, `BLOCKED_SLOT_NOT_FOUND`.
 */
@error
model NotFoundProblem extends ProblemDetails {
  @statusCode statusCode: 404;
}

/**
 * Конфликт состояния (HTTP 409).
 * Коды: `SLOT_UNAVAILABLE` (время уже занято), `SLOT_BLOCKED` (время заблокировано владельцем),
 * `BLOCK_CONFLICTS` (блокировка пересекается с бронированием или другой блокировкой),
 * `BOOKING_ALREADY_CANCELLED`, `CALL_TYPE_HAS_ACTIVE_BOOKINGS`, `IDEMPOTENCY_KEY_REUSED`
 * (тот же ключ идемпотентности с другим телом).
 */
@error
model ConflictProblem extends ProblemDetails {
  @statusCode statusCode: 409;
}

/** Пустой ответ с кодом 204 (успешное удаление). */
model NoContentResponse {
  @statusCode statusCode: 204;
}

/** Работа с типами звонков. */
@route("/call-types")
interface CallTypes {
  /**
   * Список всех типов звонков (доступно гостям): название, описание и длительность.
   */
  @tag("Guest")
  @get
  list(): CallTypeList;

  /**
   * Создание типа звонка (владелец календаря). id генерируется сервером.
   * Ошибки: 400 `VALIDATION_ERROR`/`INVALID_DURATION`, 401 `INVALID_OWNER_KEY`.
   */
  @tag("Owner")
  @post
  create(...OwnerKey, @body body: CallTypeCreate): CallType | BadRequestProblem | UnauthorizedProblem;

  /**
   * Частичное обновление типа звонка (владелец календаря).
   * Ошибки: 404 `CALL_TYPE_NOT_FOUND`, 400 `VALIDATION_ERROR`/`INVALID_DURATION`, 401 `INVALID_OWNER_KEY`.
   */
  @tag("Owner")
  @patch
  update(
    ...OwnerKey,
    @path id: string,
    @body body: CallTypeUpdate,
  ): CallType | NotFoundProblem | BadRequestProblem | UnauthorizedProblem;

  /**
   * Удаление типа звонка (владелец календаря).
   * Ошибки: 404 `CALL_TYPE_NOT_FOUND`, 409 `CALL_TYPE_HAS_ACTIVE_BOOKINGS`
   * (есть подтверждённые бронирования этого типа), 401 `INVALID_OWNER_KEY`.
   */
  @tag("Owner")
  @delete
  delete(...OwnerKey, @path id: string): NoContentResponse | NotFoundProblem | ConflictProblem | UnauthorizedProblem;

  /**
   * Свободные слоты типа звонка на ближайшие 14 дней (доступно гостям).
   * Слоты формируются по рабочему графику и временной зоне владельца, с шагом сетки типа звонка,
   * исключая прошедшие времена, пересечения с активными бронированиями любых типов
   * и заблокированные диапазоны. Необязательные `from`/`to` сужают окно (в пределах 14 дней).
   * Ошибки: 404 `CALL_TYPE_NOT_FOUND`.
   */
  @tag("Guest")
  @route("{id}/slots")
  @get
  listSlots(@path id: string, @query from?: offsetDateTime, @query to?: offsetDateTime): Slot[] | NotFoundProblem;
}

/** Работа с бронированиями. */
@route("/bookings")
interface Bookings {
  /**
   * Список встреч (владелец календаря), по умолчанию — предстоящие бронирования всех типов,
   * отсортированные по времени начала. Пагинация `limit` (1-200, по умолчанию 50) и `offset` (по умолчанию 0).
   * Фильтры: `callTypeId`, `status`, `from`/`to` (диапазон начала, ISO 8601 со смещением).
   * Ошибки: 400 `INVALID_FILTER`/`INVALID_LIMIT_OFFSET`, 401 `INVALID_OWNER_KEY`.
   */
  @tag("Owner")
  @get
  list(
    ...OwnerKey,
    @query callTypeId?: string,
    @query status?: BookingStatus,
    @query from?: offsetDateTime,
    @query to?: offsetDateTime,
    @query @minValue(1) @maxValue(200) limit?: int32,
    @query @minValue(0) offset?: int32,
  ): BookingPage | BadRequestProblem | UnauthorizedProblem;

  /**
   * Получить бронирование по id (подтверждение записи для гостя, без авторизации).
   * Ошибки: 404 `BOOKING_NOT_FOUND`.
   */
  @tag("Guest")
  @get
  read(@path id: string): Booking | NotFoundProblem;

  /**
   * Создание бронирования на свободный слот (гость, без авторизации).
   * Требуется заголовок `Idempotency-Key`. Валидация в порядке проверки:
   * - `callTypeId` существует — иначе 404 `CALL_TYPE_NOT_FOUND`;
   * - `startTime` не в прошлом — иначе 400 `INVALID_START_TIME`;
   * - слот в пределах окна [сейчас, +14 дней) — иначе 400 `OUTSIDE_BOOKING_WINDOW`;
   * - слот совпадает с шагом сетки типа — иначе 400 `NOT_ALIGNED_TO_GRID`;
   * - интервал в рабочих часах владельца — иначе 400 `OUTSIDE_WORKING_HOURS`;
   * - интервал не пересекается с активными бронированиями — иначе 409 `SLOT_UNAVAILABLE`;
   * - интервал не пересекается с блокировками — иначе 409 `SLOT_BLOCKED`;
   * - поля гостя валидны — иначе 400 `VALIDATION_ERROR`/`INVALID_EMAIL`.
   * Повторный запрос с тем же ключом идемпотентности и тем же телом возвращает исходный ответ
   * без дубликата; тот же ключ с другим телом — 409 `IDEMPOTENCY_KEY_REUSED`.
   * При успехе: 201 со статусом `confirmed`.
   * Серверная реализация: транзакция с блокировкой диапазона и ограничением целостности
   * (например, Postgres `EXCLUDE USING gist (tsrange(start, end) WITH &&)` на активных бронях).
   */
  @tag("Guest")
  @post
  create(...IdempotencyKey, @body body: BookingCreate): BookingCreated | NotFoundProblem | BadRequestProblem | ConflictProblem;

  /**
   * Отмена бронирования владельцем; слот освобождается для повторной записи.
   * Ошибки: 404 `BOOKING_NOT_FOUND`, 409 `BOOKING_ALREADY_CANCELLED`, 401 `INVALID_OWNER_KEY`.
   */
  @tag("Owner")
  @route("{id}/cancel")
  @post
  cancel(...OwnerKey, @path id: string): Booking | NotFoundProblem | ConflictProblem | UnauthorizedProblem;
}

/** Работа с заблокированными диапазонами времени (владелец календаря). */
@route("/blocked-slots")
interface BlockedSlots {
  /**
   * Список заблокированных диапазонов.
   * Ошибки: 401 `INVALID_OWNER_KEY`.
   */
  @tag("Owner")
  @get
  list(...OwnerKey): BlockedSlotList | UnauthorizedProblem;

  /**
   * Блокировка диапазона времени (глобально для всех типов звонков).
   * Ошибки: 400 `INVALID_BLOCK_RANGE` (end <= start или время в прошлом),
   * 409 `BLOCK_CONFLICTS` (пересекается с подтверждённым бронированием или другой блокировкой),
   * 401 `INVALID_OWNER_KEY`. Перед блокировкой занятого времени следует отменить бронирование.
   */
  @tag("Owner")
  @post
  create(...OwnerKey, @body body: BlockedSlotCreate): BlockedSlot | BadRequestProblem | ConflictProblem | UnauthorizedProblem;

  /**
   * Снятие блокировки; диапазон снова доступен для записи.
   * Ошибки: 404 `BLOCKED_SLOT_NOT_FOUND`, 401 `INVALID_OWNER_KEY`.
   */
  @tag("Owner")
  @delete
  delete(...OwnerKey, @path id: string): NoContentResponse | NotFoundProblem | UnauthorizedProblem;
}

/** Профиль владельца календаря. */
@route("/owner/profile")
interface OwnerProfileOperations {
  /**
   * Профиль владельца: имя, email, IANA-таймзона и рабочий график.
   * Используется админ-частью и для генерации слотов.
   * Ошибки: 401 `INVALID_OWNER_KEY`.
   */
  @tag("Owner")
  @get
  get(...OwnerKey): OwnerProfile | UnauthorizedProblem;

  /**
   * Частичное обновление профиля владельца (например, смена рабочего графика
   * или временной зоны). Влияет на генерацию будущих слотов.
   * Ошибки: 400 `VALIDATION_ERROR`, 401 `INVALID_OWNER_KEY`.
   */
  @tag("Owner")
  @patch
  update(...OwnerKey, @body body: OwnerProfileUpdate): OwnerProfile | BadRequestProblem | UnauthorizedProblem;
}
