# E2E-проверка API Callendar против работающего стека (nginx -> api).
# Запуск: pwsh scripts/e2e.ps1  (стек: docker compose up -d). Проверки автономны,
# но рассчитаны на свежий in-memory стейт (после рестарта app-api-1).
param(
  [string]$BaseUrl = "http://app.loc:8080/v1",
  [string]$OwnerKey = "dev-owner-key"
)

$script:pass = 0
$script:fail = 0

function Check([string]$name, [bool]$cond, [string]$extra = "") {
  if ($cond) { $script:pass++; Write-Host "PASS  $name" }
  else { $script:fail++; Write-Host "FAIL  $name  $extra" }
}

function Invoke-Api {
  param([string]$Method, [string]$Path, $Body = $null, [hashtable]$Headers = @{}, [string]$RawBody = $null)
  $params = @{
    Method = $Method
    Uri = "$BaseUrl$Path"
    SkipHttpErrorCheck = $true
    Headers = $Headers
  }
  if ($RawBody) {
    $params.ContentType = "application/json"
    $params.Body = [Text.Encoding]::UTF8.GetBytes($RawBody)
  } elseif ($null -ne $Body) {
    $params.ContentType = "application/json"
    $params.Body = [Text.Encoding]::UTF8.GetBytes(($Body | ConvertTo-Json -Compress -Depth 6))
  }
  # RawContentStream: не зависит ни от распознавания application/problem+json как
  # текста (byte[]), ни от авто-конвертации дат — единая точка декодирования.
  $r = Invoke-WebRequest @params -UseBasicParsing
  $content = [Text.Encoding]::UTF8.GetString($r.RawContentStream.ToArray())
  $json = $null
  if ($content) { try { $json = $content | ConvertFrom-Json } catch { $json = $null } }
  return @{
    Status = [int]$r.StatusCode
    Json = $json
    Raw = $content
    ProblemJson = ($r.Headers["Content-Type"] -join ";") -match "application/problem\+json"
  }
}

# ConvertFrom-Json превращает ISO-даты в [DateTime] (UTC) — нормализуем обратно
# в строку UTC "yyyy-MM-ddTHH:mm:ss.fffZ", чтобы сравнения и повторная отправка были точными.
function IsoUtc($v) {
  if ($null -eq $v) { return $null }
  $dto = if ($v -is [DateTime]) {
    [DateTimeOffset]::new([DateTime]::SpecifyKind($v, [DateTimeKind]::Utc))
  } else {
    [DateTimeOffset]::Parse([string]$v, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeUniversal)
  }
  return $dto.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
}

$owner = @{ "X-Owner-Key" = $OwnerKey }

Write-Host "=== Guest: типы и слоты ==="
$types = Invoke-Api -Method GET -Path "/call-types"
Check "GET /call-types 200, >=2 сид-типа" ($types.Status -eq 200 -and $types.Json.items.Count -ge 2)
$interview = $types.Json.items | Where-Object { $_.slotStepMinutes -eq 15 } | Select-Object -First 1

$slots = Invoke-Api -Method GET -Path "/call-types/$($interview.id)/slots"
Check "GET /slots 200, массив непустой" ($slots.Status -eq 200 -and $slots.Json.Count -gt 0)
$slot1 = IsoUtc $slots.Json[0].startTime
# NB: берём не соседний слот: бронь на slot1 (30 мин) накрывает slots[1] (шаг сетки 15).
$slot2 = IsoUtc $slots.Json[4].startTime

$r = Invoke-Api -Method GET -Path "/call-types/nope/slots"
Check "GET /slots несуществующего типа -> 404 CALL_TYPE_NOT_FOUND" ($r.Status -eq 404 -and $r.Json.title -eq "CALL_TYPE_NOT_FOUND" -and $r.ProblemJson)
$r = Invoke-Api -Method GET -Path "/call-types/$($interview.id)/slots?from=foo"
Check "GET /slots?from=foo -> 400 INVALID_FILTER" ($r.Status -eq 400 -and $r.Json.errors[0].code -eq "INVALID_FILTER")

Write-Host "=== Guest: бронирование, идемпотентность, конфликты ==="
$r = Invoke-Api -Method POST -Path "/bookings" -Body @{ callTypeId = $interview.id; startTime = $slot1; guestName = "Ivan"; guestEmail = "ivan@example.com" }
Check "POST /bookings без Idempotency-Key -> 400 VALIDATION_ERROR" ($r.Status -eq 400 -and $r.Json.title -eq "VALIDATION_ERROR")

$body1 = @{ callTypeId = $interview.id; startTime = $slot1; guestName = "Ivan"; guestEmail = "ivan@example.com"; guestComment = "Первый звонок" }
$created = Invoke-Api -Method POST -Path "/bookings" -Body $body1 -Headers @{ "Idempotency-Key" = "e2e-key-1" }
Check "POST /bookings -> 201 confirmed, имя типа денормализовано" ($created.Status -eq 201 -and $created.Json.status -eq "confirmed" -and $created.Json.callTypeName -eq $interview.name)

$replay = Invoke-Api -Method POST -Path "/bookings" -Body $body1 -Headers @{ "Idempotency-Key" = "e2e-key-1" }
Check "реплей (ключ+тело) -> 201, тот же id" ($replay.Status -eq 201 -and $replay.Json.id -eq $created.Json.id)

$reused = Invoke-Api -Method POST -Path "/bookings" -Body @{ callTypeId = $interview.id; startTime = $slot2; guestName = "Petr"; guestEmail = "petr@example.com" } -Headers @{ "Idempotency-Key" = "e2e-key-1" }
Check "тот же ключ + другое тело -> 409 IDEMPOTENCY_KEY_REUSED" ($reused.Status -eq 409 -and $reused.Json.title -eq "IDEMPOTENCY_KEY_REUSED")

$double = Invoke-Api -Method POST -Path "/bookings" -Body @{ callTypeId = $interview.id; startTime = $slot1; guestName = "Petr"; guestEmail = "petr@example.com" } -Headers @{ "Idempotency-Key" = "e2e-key-2" }
Check "слот занят -> 409 SLOT_UNAVAILABLE" ($double.Status -eq 409 -and $double.Json.title -eq "SLOT_UNAVAILABLE" -and $double.ProblemJson)

$consult = $types.Json.items | Where-Object { $_.slotStepMinutes -eq 30 } | Select-Object -First 1
$cross = Invoke-Api -Method POST -Path "/bookings" -Body @{ callTypeId = $consult.id; startTime = $slot1; guestName = "Petr"; guestEmail = "petr@example.com" } -Headers @{ "Idempotency-Key" = "e2e-key-3" }
Check "пересечение через ДРУГОЙ тип -> 409 SLOT_UNAVAILABLE" ($cross.Status -eq 409 -and $cross.Json.title -eq "SLOT_UNAVAILABLE")

$r = Invoke-Api -Method GET -Path "/bookings/$($created.Json.id)"
Check "GET /bookings/{id} гостем -> 200" ($r.Status -eq 200 -and $r.Json.id -eq $created.Json.id)
$r = Invoke-Api -Method GET -Path "/bookings/nope"
Check "GET /bookings/nope -> 404 BOOKING_NOT_FOUND" ($r.Status -eq 404 -and $r.Json.title -eq "BOOKING_NOT_FOUND")

$slotsAfter = Invoke-Api -Method GET -Path "/call-types/$($interview.id)/slots"
$afterStarts = @($slotsAfter.Json | ForEach-Object { IsoUtc $_.startTime })
Check "после брони слот исчез из свободных" ($afterStarts -notcontains $slot1)

Write-Host "=== Guest: порядок валидации по контракту ==="
$r = Invoke-Api -Method POST -Path "/bookings" -Body @{ callTypeId = "nope"; startTime = $slot2; guestName = "Petr"; guestEmail = "petr@example.com" } -Headers @{ "Idempotency-Key" = "e2e-key-4" }
Check "несуществующий тип -> 404 CALL_TYPE_NOT_FOUND" ($r.Status -eq 404 -and $r.Json.title -eq "CALL_TYPE_NOT_FOUND")
$r = Invoke-Api -Method POST -Path "/bookings" -Body @{ callTypeId = $interview.id; startTime = "2020-01-01T09:00:00Z"; guestName = "Petr"; guestEmail = "petr@example.com" } -Headers @{ "Idempotency-Key" = "e2e-key-5" }
Check "startTime в прошлом -> 400 INVALID_START_TIME" ($r.Status -eq 400 -and $r.Json.title -eq "INVALID_START_TIME")
$r = Invoke-Api -Method POST -Path "/bookings" -Body @{ callTypeId = $interview.id; startTime = "2026-09-15T06:00:00Z"; guestName = "Petr"; guestEmail = "petr@example.com" } -Headers @{ "Idempotency-Key" = "e2e-key-6" }
Check "за окном 14 дней -> 400 OUTSIDE_BOOKING_WINDOW" ($r.Status -eq 400 -and $r.Json.title -eq "OUTSIDE_BOOKING_WINDOW")
$misaligned = ([DateTimeOffset]::UtcNow.AddDays(2).ToUniversalTime().ToString("yyyy-MM-ddT06:07:00Z"))
$r = Invoke-Api -Method POST -Path "/bookings" -Body @{ callTypeId = $interview.id; startTime = $misaligned; guestName = "Petr"; guestEmail = "petr@example.com" } -Headers @{ "Idempotency-Key" = "e2e-key-7" }
Check "вне сетки -> 400 NOT_ALIGNED_TO_GRID" ($r.Status -eq 400 -and $r.Json.title -eq "NOT_ALIGNED_TO_GRID") "start=$misaligned"
$r = Invoke-Api -Method POST -Path "/bookings" -Body @{ callTypeId = $interview.id; startTime = $slot1; guestName = "Petr"; guestEmail = "bad" } -Headers @{ "Idempotency-Key" = "e2e-key-8" }
Check "занятый слот + битый email -> конфликт раньше полей гостя (SLOT_UNAVAILABLE)" ($r.Status -eq 409 -and $r.Json.title -eq "SLOT_UNAVAILABLE")
$r = Invoke-Api -Method POST -Path "/bookings" -Body @{ callTypeId = $interview.id; startTime = $slot2; guestName = "Petr"; guestEmail = "bad" } -Headers @{ "Idempotency-Key" = "e2e-key-9" }
Check "битый email на свободном слоте -> 400 INVALID_EMAIL" ($r.Status -eq 400 -and $r.Json.errors[0].code -eq "INVALID_EMAIL")
$r = Invoke-Api -Method POST -Path "/bookings" -RawBody "{" -Headers @{ "Idempotency-Key" = "e2e-key-10" }
Check "битый JSON -> 400 VALIDATION_ERROR" ($r.Status -eq 400 -and $r.Json.title -eq "VALIDATION_ERROR")

Write-Host "=== Owner: ключ ==="
$r = Invoke-Api -Method GET -Path "/owner/profile"
Check "GET /owner/profile без ключа -> 401 INVALID_OWNER_KEY problem+json" ($r.Status -eq 401 -and $r.Json.title -eq "INVALID_OWNER_KEY" -and $r.ProblemJson)
$r = Invoke-Api -Method GET -Path "/owner/profile" -Headers @{ "X-Owner-Key" = "wrong" }
Check "неверный ключ -> 401" ($r.Status -eq 401)
$profile = Invoke-Api -Method GET -Path "/owner/profile" -Headers $owner
Check "GET /owner/profile -> 200, таймзона Europe/Moscow" ($profile.Status -eq 200 -and $profile.Json.timezone -eq "Europe/Moscow")

Write-Host "=== Owner: CRUD типов ==="
$newType = Invoke-Api -Method POST -Path "/call-types" -Headers $owner -Body @{ name = "Статус"; description = "Еженедельный статус"; durationMinutes = 45; slotStepMinutes = 15 }
Check "POST /call-types -> 200 с id" ($newType.Status -eq 200 -and $newType.Json.id)
$badType = Invoke-Api -Method POST -Path "/call-types" -Headers $owner -Body @{ name = "X"; description = ""; durationMinutes = 0; slotStepMinutes = 15 }
Check "duration 0 -> 400 INVALID_DURATION" ($badType.Status -eq 400 -and $badType.Json.errors[0].code -eq "INVALID_DURATION")
$badStep = Invoke-Api -Method POST -Path "/call-types" -Headers $owner -Body @{ name = "X"; description = ""; durationMinutes = 30; slotStepMinutes = 20 }
Check "шаг 20 -> 400 VALIDATION_ERROR" ($badStep.Status -eq 400 -and $badStep.Json.title -eq "VALIDATION_ERROR")
$upd = Invoke-Api -Method PATCH -Path "/call-types/$($newType.Json.id)" -Headers $owner -Body @{ name = "Статус-колл" }
Check "PATCH /call-types/{id} -> 200, имя обновлено" ($upd.Status -eq 200 -and $upd.Json.name -eq "Статус-колл" -and $upd.Json.durationMinutes -eq 45)
$r = Invoke-Api -Method PATCH -Path "/call-types/nope" -Headers $owner -Body @{ name = "X" }
Check "PATCH несуществующего -> 404 CALL_TYPE_NOT_FOUND" ($r.Status -eq 404)

Write-Host "=== Owner: список броней, пагинация, фильтры ==="
$r = Invoke-Api -Method GET -Path "/bookings" -Headers $owner
Check "GET /bookings -> 200, предстоящая бронь в списке" ($r.Status -eq 200 -and $r.Json.total -ge 1 -and ($r.Json.items.id -contains $created.Json.id))
$r = Invoke-Api -Method GET -Path "/bookings?limit=0" -Headers $owner
Check "limit=0 -> 400 INVALID_LIMIT_OFFSET" ($r.Status -eq 400 -and $r.Json.errors[0].code -eq "INVALID_LIMIT_OFFSET")
$r = Invoke-Api -Method GET -Path "/bookings?status=foo" -Headers $owner
Check "status=foo -> 400 INVALID_FILTER" ($r.Status -eq 400 -and $r.Json.errors[0].code -eq "INVALID_FILTER")
$r = Invoke-Api -Method GET -Path "/bookings?callTypeId=$($interview.id)&status=confirmed" -Headers $owner
Check "фильтр callTypeId+status -> только нужные" ($r.Status -eq 200 -and ($r.Json.items | Where-Object { $_.callTypeId -ne $interview.id -or $_.status -ne "confirmed" }).Count -eq 0)
$r = Invoke-Api -Method GET -Path "/bookings?from=2020-01-01T00:00:00Z&limit=1&offset=0" -Headers $owner
Check "пагинация limit=1: 1 элемент, total полный" ($r.Status -eq 200 -and $r.Json.items.Count -eq 1 -and $r.Json.total -ge 1 -and $r.Json.limit -eq 1)

Write-Host "=== Owner: блокировки ==="
$slot1Dto = [DateTimeOffset]::Parse($slot1, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind)
$blockOverBooking = Invoke-Api -Method POST -Path "/blocked-slots" -Headers $owner -Body @{ startTime = $slot1; endTime = $slot1Dto.AddHours(1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ") }
Check "блокировка поверх брони -> 409 BLOCK_CONFLICTS" ($blockOverBooking.Status -eq 409 -and $blockOverBooking.Json.title -eq "BLOCK_CONFLICTS")
$r = Invoke-Api -Method POST -Path "/blocked-slots" -Headers $owner -Body @{ startTime = "2026-08-14T13:00:00Z"; endTime = "2026-08-14T12:00:00Z" }
Check "end <= start -> 400 INVALID_BLOCK_RANGE" ($r.Status -eq 400 -and $r.Json.title -eq "INVALID_BLOCK_RANGE")
$blockStart = [DateTimeOffset]::Parse($slot2, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind).ToUniversalTime()
$block = Invoke-Api -Method POST -Path "/blocked-slots" -Headers $owner -Body @{ startTime = $blockStart.ToString("yyyy-MM-ddTHH:mm:ssZ"); endTime = $blockStart.AddHours(2).ToString("yyyy-MM-ddTHH:mm:ssZ"); reason = "Отпуск" }
Check "POST /blocked-slots -> 200, причина с UTF-8 сохранена" ($block.Status -eq 200 -and $block.Json.reason -eq "Отпуск")
$blockList = Invoke-Api -Method GET -Path "/blocked-slots" -Headers $owner
Check "GET /blocked-slots -> созданная в списке" ($blockList.Status -eq 200 -and ($blockList.Json.items.id -contains $block.Json.id))
$r = Invoke-Api -Method POST -Path "/bookings" -Body @{ callTypeId = $interview.id; startTime = $slot2; guestName = "Petr"; guestEmail = "petr@example.com" } -Headers @{ "Idempotency-Key" = "e2e-key-11" }
Check "бронь в заблокированном диапазоне -> 409 SLOT_BLOCKED" ($r.Status -eq 409 -and $r.Json.title -eq "SLOT_BLOCKED")

Write-Host "=== Owner: отмена брони, удаление типа ==="
$cancelled = Invoke-Api -Method POST -Path "/bookings/$($created.Json.id)/cancel" -Headers $owner
Check "cancel -> 200 cancelled" ($cancelled.Status -eq 200 -and $cancelled.Json.status -eq "cancelled")
$r = Invoke-Api -Method POST -Path "/bookings/$($created.Json.id)/cancel" -Headers $owner
Check "повторный cancel -> 409 BOOKING_ALREADY_CANCELLED" ($r.Status -eq 409 -and $r.Json.title -eq "BOOKING_ALREADY_CANCELLED")
$slotsFreed = Invoke-Api -Method GET -Path "/call-types/$($interview.id)/slots"
$freedStarts = @($slotsFreed.Json | ForEach-Object { IsoUtc $_.startTime })
Check "после отмены слот снова свободен" ($freedStarts -contains $slot1)

$activeBooking = Invoke-Api -Method POST -Path "/bookings" -Body @{ callTypeId = $interview.id; startTime = $slot1; guestName = "Ivan"; guestEmail = "ivan@example.com" } -Headers @{ "Idempotency-Key" = "e2e-key-12" }
Check "пере-бронь освобождённого слота -> 201" ($activeBooking.Status -eq 201)
$delWithActive = Invoke-Api -Method DELETE -Path "/call-types/$($interview.id)" -Headers $owner
Check "удаление типа с активной бронью -> 409 CALL_TYPE_HAS_ACTIVE_BOOKINGS" ($delWithActive.Status -eq 409 -and $delWithActive.Json.title -eq "CALL_TYPE_HAS_ACTIVE_BOOKINGS")
Invoke-Api -Method POST -Path "/bookings/$($activeBooking.Json.id)/cancel" -Headers $owner | Out-Null

$delBlock = Invoke-Api -Method DELETE -Path "/blocked-slots/$($block.Json.id)" -Headers $owner
Check "DELETE /blocked-slots/{id} -> 204" ($delBlock.Status -eq 204)
$r = Invoke-Api -Method DELETE -Path "/blocked-slots/$($block.Json.id)" -Headers $owner
Check "повторный DELETE блокировки -> 404 BLOCKED_SLOT_NOT_FOUND" ($r.Status -eq 404 -and $r.Json.title -eq "BLOCKED_SLOT_NOT_FOUND")

$delNew = Invoke-Api -Method DELETE -Path "/call-types/$($newType.Json.id)" -Headers $owner
Check "DELETE свободного типа -> 204" ($delNew.Status -eq 204)
$r = Invoke-Api -Method DELETE -Path "/call-types/$($newType.Json.id)" -Headers $owner
Check "повторный DELETE типа -> 404" ($r.Status -eq 404)

Write-Host ""
Write-Host "=== ИТОГ: $($script:pass) PASS, $($script:fail) FAIL ==="
exit ($script:fail -gt 0 ? 1 : 0)
