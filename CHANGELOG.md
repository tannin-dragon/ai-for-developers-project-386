# Changelog

## [1.1.1](https://github.com/tannin-dragon/ai-for-developers-project-386/compare/v1.1.0...v1.1.1) (2026-08-16)


### Bug Fixes

* **opencode:** add actions:write permission for cache save ([6eb0a65](https://github.com/tannin-dragon/ai-for-developers-project-386/commit/6eb0a6522ae2b840d2872d6348c4cf4b3a31f47b))
* **opencode:** bypass broken OIDC exchange via USE_GITHUB_TOKEN ([57de054](https://github.com/tannin-dragon/ai-for-developers-project-386/commit/57de054e6d4e2f6aa8d9a6a6f120112b8a02dcbf))

## [1.1.0](https://github.com/tannin-dragon/ai-for-developers-project-386/compare/v1.0.0...v1.1.0) (2026-08-15)


### Features

* Dockerfile для деплоя Callendar на один порт (SPA + /v1 API) ([e8d0941](https://github.com/tannin-dragon/ai-for-developers-project-386/commit/e8d0941d235fa3fd66619452a2e0b2601dadce9b))

## 1.0.0 (2026-08-15)


### Features

* backend — API бронирования по контракту (Hono + zod, in-memory) ([2710ae4](https://github.com/tannin-dragon/ai-for-developers-project-386/commit/2710ae4da0cc31ef5983dc6da88c7b1c57833bb5))
* Callendar — контракт бронирования звонков (TypeSpec/OpenAPI) ([ace45d6](https://github.com/tannin-dragon/ai-for-developers-project-386/commit/ace45d63a2428a9126b1a3f07edfb2537bd40a26))
* frontend — интерфейс бронирования звонков (Vite + React + shadcn) ([4485524](https://github.com/tannin-dragon/ai-for-developers-project-386/commit/448552431e9b2fd5fede80a0310cddab88a628db))


### Bug Fixes

* frontend — fallback UUID v4 для Idempotency-Key вне secure context ([85080f5](https://github.com/tannin-dragon/ai-for-developers-project-386/commit/85080f54c71b24c041461f92e86605d53089ca98))
