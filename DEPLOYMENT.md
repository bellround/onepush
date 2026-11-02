# Deployment and local record migration

Use Node >=24.12. The image builds relative Vite assets and runs unprivileged on
0.0.0.0:3000; it needs no writable filesystem. Compose only declares the public
application. PostgreSQL and secrets must be supplied by the hosting platform.

Required runtime environment:

- `DATABASE_URL`: PostgreSQL connection URL (use the provider's verified TLS settings).
- `ADMIN_PASSWORD`: the operator's chosen secret, never a build argument or repository file.
- `PUBLIC_ORIGIN`: exact public origin, e.g. `https://school.example` (no path).
- `BASE_PATH`: public prefix, e.g. `/students/1116`; empty for root deployment.

Production requires PUBLIC_ORIGIN for origin checks behind a stripping proxy.
The proxy must preserve Authorization and Origin; either stripped or prefixed request
paths work. BASE_PATH accepts only slash-separated alphanumeric/underscore/hyphen
segments. HTML injects a base tag and inert JSON config before any relative assets,
so `/students/1116/irdmin` and `/students/1116/irdmin/` behave identically.
Startup creates tables; unavailable PostgreSQL fails startup without logging secrets.
Use a single application replica: at most 1000 opaque random bearer sessions live in
server memory, expire after eight hours, and reset on restart. Login bodies are
bounded to 4096 bytes. No proxy-wide failed-attempt lockout is used: it would let
one client block valid logins for everyone. Strong guessing throttling requires
trusted ingress client identity; arbitrary X-Forwarded-For is not trusted.

The operator explicitly accepts the chosen weak password's guessing risk and the
shared-origin residual risk. Memory-only bearer tokens remove ambient cookie
authorization, but sibling same-origin windows/scripts can still interfere with an
admin window. Paths are not origin isolation. CSP frame-ancestors 'none' blocks
framing, not all same-origin attacks; COOP same-origin would not isolate siblings.
Use a separate trusted origin and strong secret for stronger protection. Never log
Authorization, login bodies, tokens, or passwords at the ingress/application layer.

## Frontend contract

`src/platform.ts` exports `appPath(path: string)` and `apiUrl(path: string)`.
Use `appPath('/irdmin')`, `apiUrl('/admin/login')`, `apiUrl('/admin/rounds')`,
and `apiUrl('/admin/logout')`. apiUrl prepends `/api` within the runtime prefix.
POST login sends JSON `{password}`; success is 200 JSON `{token}`. Admin holds the
token only in React memory, never cookies/storage/URLs/logs. List and logout send
`Authorization: Bearer <token>` with credentials omitted. No cookie fallback exists.
Every initial admin visit/refresh requires login. Logout POST returns 204 and revokes
the token; missing/expired/revoked bearer tokens return 401. Admin HTML/API responses
are no-store with CSP frame-ancestors 'none'. Bad origin returns 403; session capacity
returns 503. Normal game telemetry requires player auth. No admin write/SQL endpoint exists.

GET rounds accepts `limit` (default 50, 1..100) and optional positive decimal-string
`beforeId`. Response is `{rows, nextBeforeId: string|null, hasMore: boolean}`.
Rows include every original column; id is a string, booleans are booleans, numeric
metrics are numbers or null, actions preserve complete objects (including boards),
and created_at is an ISO UTC timestamp. Pagination orders descending IDs and uses
limit+1. POST telemetry returns 204, invalid input 400, oversized input 413,
and database failures 503. Unknown API routes return JSON 404.

## Player accounts and progress

`src/game/account.ts` exports `PlayerAccount = {username: string, progress: number}`,
`enterAccount(username, password)`, `getAccount()`, `logoutAccount()`, and
`saveAccountProgress(levelId, expectedUsername)`. Account-returning calls resolve to PlayerAccount;
getAccount returns null only on 401, logout resolves void. Failures throw user-safe
Korean AccountErrors with a numeric status (0 for network failure). There is no anonymous local-progress import.

Endpoints are POST `/api/account/enter` with `{username,password}`, GET
`/api/account`, POST `/api/account/logout`, POST `/api/account/progress` with
`{levelId,expectedUsername}`. New usernames register automatically; existing names require the
original password. Usernames are case-sensitive Unicode letters/numbers, `_`, `-`,
1..32 characters; passwords are 1..128 characters and at most 512 UTF-8 bytes.
Passwords use random salts and asynchronous scrypt (N=16384, r=8, p=1).

Player sessions are separate from admin bearer auth. Only SHA-256 token hashes
are persisted in PostgreSQL; cookies are HttpOnly, SameSite=Strict, scoped to
BASE_PATH, expire after 30 days, and are Secure in production. Production requires
HTTPS. Logout revokes the database session; login replaces the current session.
Expired rows are removed on login. Preserve Cookie/Set-Cookie and Origin through
the proxy. Mutations require the configured PUBLIC_ORIGIN (origin only, no path).
Never log passwords or cookies. Use trusted, isolated hosting origins: path scopes
do not defend against malicious same-origin applications.

Login is limited to 10 attempts/minute per socket IP, with 4 simultaneous password
operations per process. Forwarded IP headers are not trusted; behind a shared proxy
this deliberately conservative limit can affect multiple users. Configure trusted
ingress throttling for larger deployments. Admin sessions remain memory-only.

Progress is the next unlocked zero-based stage index: 0 initially, catalog length
when all stages are cleared. A conditional atomic SQL update accepts only an
unlocked known level and never decreases progress. This records client-reported
clears, not a server-verified puzzle solution. Vite generates dist/level-catalog.json
from the same sorted chapter files as the client; Docker already copies dist.
Development/tests load the source catalog directly. Keep catalog order stable when
deploying because stored progress is positional.

New telemetry requires the player cookie; username is derived server-side, never
from posted identity. Admin list/detail row payloads and export include nullable
username; old records/imports remain anonymous. Legacy ROUND_COLUMNS and import
hashes are unchanged. Exports exclude player credentials and session tables;
use PostgreSQL backups to preserve accounts and progress.

Progress and telemetry requests must include the username captured when play began
as `expectedUsername`. Missing values return 400; a different session username
returns 409 before any writes. This field is only a consistency guard, never the
authoritative owner. `sendRound(record, expectedUsername)` returns Promise<void>,
aborts fetch after five seconds, and suppresses telemetry failures.

## JSON database export

GET `/api/admin/export` (frontend: `apiUrl('/admin/export')`) requires the existing
admin bearer token and uses the same origin checks and no-store headers. Both
deployment-prefixed and proxy-stripped paths work. Success returns application/json
with `Content-Disposition: attachment; filename="ion-puzzle-db-YYYY-MM-DD.json"`
(UTC export date). The body is
`{formatVersion: 1, exportedAt: ISO timestamp, rounds: [...], round_imports: [...]}`.
Both arrays contain all rows and columns from one PostgreSQL statement snapshot;
there is no pagination or filtering. Empty tables produce empty arrays. Round IDs
and import round_id values are decimal strings. created_at uses PostgreSQL timestamp
text with its timezone offset and full stored precision; actions are unchanged.
Database failures return 503 `{error: "Database unavailable"}` without an attachment.

This is application data JSON, not a native PostgreSQL backup or restore format;
it excludes schema, sequences, database roles, credentials, and in-memory sessions.
No restore endpoint is provided. The full export is buffered in memory, so large
datasets remain subject to server memory and database statement-timeout limits.
Treat downloaded files as sensitive records; do not commit or publicly share them.

## One-off SQLite migration

Do not upload or commit the database, WAL, records, or credentials. Stop the local
writer before importing; keep the original database and its WAL together. The CLI
opens SQLite read-only and does not modify source files. Supply DATABASE_URL through
the shell's protected environment, then run:

```sh
npm run migrate:sqlite -- /absolute/path/to/data/rounds.db SOURCE_UUID
```

Generate a UUID once (`node -e 'console.log(crypto.randomUUID())'`) and retain it
privately as this source database's identity. Reuse the SAME UUID on retries and
incremental imports; use a DIFFERENT UUID for an unrelated database. The CLI uses
one PostgreSQL transaction and a source-specific advisory lock. UUIDs are normalized
to lowercase before locking/deduplication, so case-only retries are identical. A separate mapping
table deduplicates source UUID + exact SQLite ID, rejecting changed content rather
than silently merging it. Destination IDs are newly allocated; original IDs remain
in the mapping. All columns/actions and UTC timestamps are preserved. Errors roll
back the entire import, and logs contain only aggregate counts/generic errors.

Local inspection found no DATABASE_URL or platform connection variables, so deployed
database reachability cannot yet be established. Ask the platform for an external
TLS connection URL or a temporary SSH/port-forward tunnel to the internal database.
Do not attempt migration until credentials and reachability are confirmed. If neither
is supported, the smallest proposed alternative is a temporary, separately secret-
protected, size-bounded source-record batch import endpoint with the same transactional
dedupe mapping; this requires explicit approval and is NOT implemented.

## Verification

`npm test`, `npm run build`, `npm run lint`.
For the actual PostgreSQL integration test set `TEST_DATABASE_URL` to a disposable
database and run `node --test --test-concurrency=1 server/*.test.ts`. Tests create schema and remove their
own rows; use an isolated database (pagination checks assume no concurrent writer).
Docker: `docker compose -p ion-puzzle config`, `docker build -t ion-puzzle-check .`.
An explicit Compose project name is needed when the checkout directory has no ASCII letters.
Parent/operator owns runtime secrets, migration execution, deployment and browser smoke.
