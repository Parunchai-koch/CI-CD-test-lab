# React + Node.js Task App

A small, accessible task manager used to practice a React/Vite frontend, Express API, tests, Docker packaging, and CI/CD. It is implemented and ready for local development.

> **Demo limitation:** tasks are held only in one process's memory. Everyone shares them; they reset on restart, replacement, rollback, or scaling. Do not store private or important information here. There is no authentication, database, persistence, or multi-replica support.

## Stack and layout

| Area | Choice |
| --- | --- |
| Runtime | Node.js 24 baseline (the checked local environment has Node 26.7.0) |
| Frontend | React 19, Vite 8, native `fetch`, plain CSS |
| Backend | Express 5, ES modules, in-memory seeded tasks |
| Tests | Node test runner + Supertest; Vitest + React Testing Library |
| Package manager | npm workspaces with one root `package-lock.json` |
| Container target | `linux/amd64`, one Node 24 image on port 8080 |

```text
Development: browser -> Vite :5173 -> /api proxy -> Express :8080
Production:  browser -> HTTPS reverse proxy -> container :8080
                                            |-- Express /api/*
                                            `-- built React assets
```

`frontend/` contains the Vite app. `backend/src/app.js` is the testable Express factory, and `backend/src/server.js` owns listening and graceful shutdown. Production copies `frontend/dist` to the ignored generated directory `backend/public` and serves both from one origin.

## Requirements and setup

Use Node 24 and npm 11 or newer for the supported path. `.nvmrc` selects Node 24. The current implementation was linted, tested, and built with Node 26.7.0 because Node 24 was not installed in this workspace; Docker's runtime base is Node 24.

```bash
npm ci
npm run dev
```

Open <http://localhost:5173>. Vite proxies relative `/api` requests to Express at `http://localhost:8080`.

If ports are occupied, choose unused ports and update the proxy target with the same command:

```bash
PORT=8081 VITE_API_PROXY_TARGET=http://localhost:8081 npm run dev
```

The production server uses `PORT` (default `8080`) and listens on `0.0.0.0`. Stop development with `Ctrl-C`; the backend handles `SIGINT` and `SIGTERM` with a 10-second bounded close period.

## Scripts

```bash
npm run dev       # Vite and Express together
npm run lint      # ESLint
npm test          # 7 backend and 6 frontend tests, once
npm run build     # builds frontend/dist
npm start         # starts backend (use NODE_ENV=production to serve backend/public)
npm run smoke -- http://127.0.0.1:8080 # bounded HTTP readiness and CRUD smoke test
```

The smoke script waits up to 30 one-second attempts for health, then verifies health JSON, HTML, a referenced built asset, task listing, and create/update/delete status/body behavior.

## Troubleshooting

- **Port in use:** use the paired `PORT` and `VITE_API_PROXY_TARGET` command above for development. For a container, choose another host-side port such as `-p 127.0.0.1:8081:8080` and smoke-test that port.
- **Browser API failure:** confirm the backend is running, request `http://localhost:8080/api/health` directly, and inspect its terminal output. In Vite development, the browser must use the Vite URL (`:5173`), not a separately configured API origin.
- **Image cannot start or is unhealthy:** run `docker logs <container>` and `docker inspect <container>`. Confirm the image and host are both `linux/amd64` (`docker image inspect` and `uname -m`); rebuild/publish the documented architecture when they differ.
- **GHCR pull is denied:** verify the immutable image name/digest and authenticate the host with a package-read credential if the package is private. Do not put that credential in this repository.

To exercise the single-origin production mode without Docker after building:

```bash
npm run build
NODE_ENV=production PORT=8080 npm start
# In another terminal:
npm run smoke -- http://127.0.0.1:8080
```

## API contract

| Method | Endpoint | Success |
| --- | --- | --- |
| `GET` | `/api/health` | `200` `{ "status": "ok" }` |
| `GET` | `/api/tasks` | `200` task array |
| `POST` | `/api/tasks` | `201` created task; body `{ "title": "..." }` |
| `PATCH` | `/api/tasks/:id` | `200` updated task; body `{ "completed": true }` |
| `DELETE` | `/api/tasks/:id` | `204` with no body |

Tasks have `{ "id", "title", "completed" }`. New UUID IDs are generated server-side and titles are trimmed. Titles must be strings from 1 through 200 characters. `completed` is required and must be boolean. API failures use `{ "error": "Human-readable message" }`: malformed/invalid bodies are `400`, oversized (over 16kb) bodies are `413`, missing tasks and unknown API paths are `404`, and unexpected failures are `500` without stack traces.

## Docker

The multi-stage `Dockerfile` targets `linux/amd64`, runs as non-root `node`, and has a healthcheck implemented with Node's built-in `fetch`. It pins `node:24-bookworm-slim` to digest `sha256:a5f4366e834695d5f363b920c104953a535d3a9864d1bdf74566a0ebe01daee5`, resolved on 2026-10-15. Review and deliberately update that digest during regular base-image maintenance; it is a resolved manifest-list digest, not an invented value.

The build stage uses `npm ci` from the root lockfile. The runtime stage copies only package manifests, runs this validated workspace selection, then copies backend source and compiled frontend files:

```bash
npm ci --omit=dev --workspace=@task-app/backend --include-workspace-root=false
```

That excludes the frontend workspace and all development dependencies from the runtime dependency tree; `npm ls --omit=dev --workspace=@task-app/backend` verifies the installed backend tree during image creation. It does **not** copy the builder's `node_modules`.

Build and verify locally (Docker Desktop/Engine must be running):

```bash
docker build --platform linux/amd64 -t task-app:local .
docker run --detach --name task-app-local --init -p 127.0.0.1:8080:8080 task-app:local
npm run smoke -- http://127.0.0.1:8080
docker inspect --format '{{.State.Health.Status}} {{.Config.User}}' task-app-local
docker stop task-app-local
docker rm task-app-local
```

The smoke script provides bounded readiness retries rather than an immediate `curl`. After stopping and starting a new container, task data intentionally returns to the seeds. To troubleshoot an unhealthy container, use `docker logs task-app-local` and `docker inspect task-app-local`. The source image excludes `.git`, dependencies, generated output, coverage, logs, and local `.env` files through `.dockerignore`.

## CI, publishing, and scanning policy

`.github/workflows/ci.yml` runs for pull requests and pushes to `main` with `contents: read` only. It uses root-lockfile npm cache, runs lint/tests/build, builds the documented `linux/amd64` image, starts it, and invokes the bounded smoke script. The container is always removed and logs print on failure. Actions are pinned to reviewed commit SHAs. Configure this check as required in branch protection in repository settings; that setting cannot be made from source control.

`.github/workflows/publish.yml` only runs on `main`. It repeats quality gates, builds and loads `ghcr.io/<owner>/<repository>:sha-<full-commit-sha>`, smoke-tests that exact local image, then logs in using the ephemeral `GITHUB_TOKEN` (`contents: read`, `packages: write`) and pushes it. The workflow writes the pushed digest to the job summary. Pull requests never receive registry write credentials. Package visibility is a repository-owner choice; a private GHCR package requires the host to use a least-privilege package-read credential stored outside Git.

**Scanning baseline:** image scanning is an optional, manual/scheduled follow-up for this demo, not an undefined release blocker. Before exposing the app or treating a release as long-lived, run an organization-approved maintained scanner against the immutable digest, record scanner/version/date and findings, fix actionable critical/high findings or document a time-bounded exception with owner and review date. Base-image digest reviews should happen at the same time. No scanner action is included yet, so publishing is not falsely represented as vulnerability approval.

## Manual deployment and rollback

Confirm the chosen Linux host is `amd64`, has Docker Engine, disk capacity, an available loopback port, and a host operator. Record the working image digest and runtime settings before replacing it. With the published digest substituted:

```bash
export IMAGE='ghcr.io/<owner>/<repository>@sha256:<published-digest>'
docker pull "$IMAGE"
docker run --detach --name task-app --init --restart unless-stopped -p 127.0.0.1:8080:8080 "$IMAGE"
for attempt in $(seq 1 30); do
  if docker exec task-app node -e "fetch('http://127.0.0.1:8080/api/health').then(async response => { const body = await response.json(); if (!response.ok || body.status !== 'ok') process.exit(1); }).catch(() => process.exit(1))"; then
    break
  fi
  if [ "$attempt" = 30 ]; then
    docker logs task-app
    exit 1
  fi
  sleep 1
done
curl --fail --silent --show-error http://127.0.0.1:8080/api/health
```

This bounded readiness loop has no dependency on a source checkout or host Node installation: it uses the image's Node runtime, verifies the health JSON, waits at most 30 seconds, and prints logs on failure. On failure, inspect `docker logs task-app`, stop/remove **only** that named container, run the previously recorded digest with the same options, and repeat verification. From a source checkout, `npm run smoke -- http://127.0.0.1:8080` additionally tests HTML/assets and the full CRUD flow. Do not expose this demo directly over public HTTP: use a host-level HTTPS reverse proxy, DNS/certificates, and firewall rules in front of the deliberate loopback binding. Record deployed digest, source commit, time, and verification result.

## Current verification and limitations

`npm run lint`, `npm test` (13 tests), `npm run build`, and a local production-process smoke run have passed. Docker client 29.2.1 is installed in this workspace, but its daemon socket was unavailable during implementation, so Docker build/container health, non-root runtime, and host/GHCR operations remain unverified. No registry login, image publishing, deployment, pull, branch-protection update, or external scan was attempted.

See [task.md](task.md) for the implementation checklist and explicit remaining operational work.
