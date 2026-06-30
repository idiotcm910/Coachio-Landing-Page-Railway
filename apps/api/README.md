# apps/api — FastAPI backend (placeholder)

Backend Python (FastAPI + Postgres) sẽ được port đầy đủ ở phase P2.
Hiện chỉ có `project.json` để nx nhận diện project `api` với các targets:
`serve`, `test`, `lint`, `format`, `typecheck`, `migrate`.

Không phải pnpm workspace member (Python). Không cần Redis — caching dùng InMemoryBackend.
