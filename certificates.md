# Отчёт-инструкция: локальные сертификаты и ошибка `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`

Дата: 11.08.2026
Окружение: Windows, Node.js v24.19.0, npm 11.17.0

---

## 1. Суть проблемы

При инициализации проекта TypeSpec (`tsp init`) зависимость не установилась — упало с ошибкой:

```
[TypeError: fetch failed] {
  [cause]: Error: unable to get local issuer certificate
    code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'
}
```

**Причина:** весь HTTPS-трафик перехватывается корпоративным MITM-прокси
(сертификат `CN=cloud-ftd.terminal.lft, O=SLS LLC, L=Moscow, C=RU` — Cisco FTD).
Сертификаты сайтов при этом выдаются внутренним корневым центром
`CN=S3-Root, DC=terminal, DC=lft`.

Windows и .NET этому корню доверяют (он установлен в системное хранилище),
поэтому PowerShell-запросы работают. А Node.js по умолчанию использует **собственный**
встроенный набор CA-сертификатов, а не хранилище Windows, — локальный корень ему
неизвестен, и любое TLS-соединение через прокси падает.

`npm config set strict-ssl false` проблему не решает: сам npm проваливает проверку,
но внутренний `fetch()` у TypeSpec-компилятора по-прежнему использует TLS-стек Node.

## 2. Диагностика (команды для проверки)

### 2.1. Проверка доверия Node к сертификату

```powershell
node -e "fetch('https://registry.npmjs.org/-/ping').then(r=>console.log('OK', r.status)).catch(e=>console.log('ERR', e.message))"
```

- `OK 200` — TLS работает;
- `ERR fetch failed` — проблема с сертификатами.

Сравнение: при активном `--use-system-ca` — `OK 200`, без него — `ERR`.

### 2.2. Цепочка сертификатов, которые отдаёт сайт

```powershell
$t=[Net.Sockets.TcpClient]::new(); $t.Connect('registry.npmjs.org',443)
$s=[Net.Security.SslStream]::new($t.GetStream(),$false,{param($a,$b,$c,$d)$true}); $s.AuthenticateAsClient('registry.npmjs.org')
$s.RemoteCertificate.Subject
```

В выводе видна цепочка: `npmjs.org` → `cloud-ftd.terminal.lft` (перехватчик) → `S3-Root`.

### 2.3. Наличие внутреннего корня в хранилище Windows

```powershell
Get-ChildItem Cert:\CurrentUser\Root, Cert:\LocalMachine\Root -Recurse |
  Where-Object { $_.Subject -match 'S3-Root' } |
  Select-Object PSParentPath, Subject, NotAfter, Thumbprint
```

## 3. Решение

Включить для Node.js использование системного хранилища сертификатов Windows
(поддерживается начиная с Node.js 22):

```powershell
setx NODE_OPTIONS "--use-system-ca"
```

Действует постоянно (для всех новых процессов, пользовательский уровень).
Чтобы применить к текущей сессии сразу:

```powershell
$env:NODE_OPTIONS="--use-system-ca"
```

После этого зависимости проекта устанавливаются штатно:

```powershell
npm install
```

## 4. Проверка после исправления

```powershell
node -e "fetch('https://registry.npmjs.org/-/ping').then(r=>console.log(r.status))"   # 200
npx tsp compile .          # Compilation completed successfully
```

## 5. Альтернативные варианты

### Вариант B — `NODE_EXTRA_CA_CERTS`

Добавить локальный корень отдельным файлом (не полагаясь на системное хранилище):

```powershell
# 1. Экспорт корневого сертификата из хранилища
Get-ChildItem Cert:\CurrentUser\Root |
  Where-Object Subject -match 'S3-Root' |
  Export-Certificate -FilePath "$env:TEMP\s3-root.cer"

# 2. Конвертация в PEM (base64 + заголовки)
certutil -encode "$env:TEMP\s3-root.cer" "$env:TEMP\s3-root.pem"

# 3. Указать Node путь к файлу
setx NODE_EXTRA_CA_CERTS "$env:TEMP\s3-root.pem"
```

### Вариант C — отключить проверку (НЕ рекомендуется)

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED="0"
```

Отключает проверку подлинности TLS для всех Node-процессов сессии.
Подходит только как временный костыль.

## 6. Корневые сертификаты `terminal.lft`, установленные в Windows

| Subject | Хранилища |
|---|---|
| `CN=S3-Root, DC=terminal, DC=lft` | CurrentUser\Root, LocalMachine\Root |
| `CN=S3-Root-CA, DC=terminal, DC=lft` | CurrentUser\Root, LocalMachine\Root |
| `CN=cloud-ftd.terminal.lft, O=SLS LLC, L=Moscow, S=Moscow, C=RU` | CurrentUser\Root, LocalMachine\Root |
| `CN=firepower.terminal.lft, OU=IT, O=SLS LLC, L=NEM, C=RU` | CurrentUser\Root, LocalMachine\Root |

---

## Вывод

Для корректной работы Node.js и TypeSpec в сети с MITM-прокси достаточно одного шага:
`setx NODE_OPTIONS "--use-system-ca"`. Windows уже доверяет внутреннему корню,
Node подключает его и начинает работать без ошибок.
