# Implementation Plan

Build the smallest complete React + Express application, then package and deploy it as one Docker image. This file is a work checklist; unchecked items are not implemented.

## Constraints and decisions

- JavaScript only; React + Vite frontend and Node.js + Express backend.
- Mock data in memory; no database, persistent volumes, accounts, or authentication.
- One process, one replica, and one shared task list.
- Native `fetch`, plain CSS, and local React state; no additional application framework.
- One root npm workspace and lockfile.
- One production image serving the API and frontend on port `8080`.
- GitHub Actions publishes to GHCR; initial host deployment is manual.
- Default branch assumption: `main`. Initial image architecture assumption: `linux/amd64`.
- The app is a demo. Do not present it as an authenticated, persistent, production task service.

## Phase 1 — Repository and application scaffolding

- [ ] Confirm Node.js 24 support, the default branch, and the intended host architecture.
- [x] Create a private root npm workspace with `frontend` and `backend` packages.
- [x] Scaffold the frontend using Vite's React JavaScript template.
- [x] Initialize the backend with ES modules and Express.
- [x] Add `.nvmrc`, `.gitignore`, and ESLint configuration.
- [x] Ignore dependency directories, frontend build output, generated `backend/public/`, local environment files, and coverage output.
- [x] Generate and commit one root `package-lock.json`; use `npm ci` for reproducible installs.
- [x] Add root scripts: `dev`, `lint`, `test`, `build`, and `start`.
- [x] Make `dev` run Vite and the backend together with `concurrently`; use Node's watch mode for backend development.
- [x] Configure Vite on port `5173` and proxy `/api` to backend port `8080`.
- [x] Document how to change a port if it is already occupied.

**Acceptance:** A fresh install starts both services, and React can call `GET /api/health` through the Vite proxy.

## Phase 2 — Backend and mock data

- [x] Separate the Express app factory (`app.js`) from the process entry point (`server.js`).
- [x] Create a fresh seeded task store for each app instance so tests do not share state.
- [x] Implement `GET /api/health`, returning `200` and `{ "status": "ok" }`.
- [x] Implement `GET /api/tasks`, returning all tasks.
- [x] Implement `POST /api/tasks`, returning the new task with `201`.
- [x] Trim titles; reject missing, non-string, empty, whitespace-only, or over-200-character titles.
- [x] Generate new task IDs with `crypto.randomUUID()` and default `completed` to `false`.
- [x] Implement `PATCH /api/tasks/:id` with a required boolean `completed` field.
- [x] Implement `DELETE /api/tasks/:id`, returning `204` without a response body.
- [x] Return `404` for nonexistent task IDs and unknown API routes.
- [x] Add a small JSON body limit, such as `16kb`; return a structured `413` error for oversized bodies.
- [x] Return consistent JSON errors, including `400` for malformed JSON and `500` without stack traces for unexpected failures.
- [x] Configure the server to use `PORT`, default to `8080`, and bind to `0.0.0.0` in containers.
- [x] Handle `SIGTERM`/`SIGINT`: stop accepting connections and exit within a bounded timeout.
- [x] Log startup and unexpected server failures to standard output/error without logging sensitive request bodies.

**Acceptance:** Every documented endpoint works using curl or an API client. Restarting the server resets the mock data.

## Phase 3 — React user interface

- [x] Replace the Vite starter screen with the task manager.
- [x] Fetch tasks on initial load using relative `/api/tasks` URLs.
- [x] Render task titles, completion state, and delete buttons with stable task IDs as React keys.
- [x] Add a labeled task-entry form and submit button.
- [x] Validate the trimmed title in the UI, while keeping backend validation authoritative.
- [x] Add completion toggles and delete actions.
- [x] Update local state only after successful API responses; optimistic updates are unnecessary.
- [x] Check `response.ok` on every request and handle `204` without attempting to parse JSON.
- [x] Show loading, empty, request-error, and validation messages.
- [x] Provide retry for an initial load failure; preserve form text when task creation fails.
- [x] Prevent duplicate submissions and conflicting actions while requests are pending.
- [x] Use accessible labels, keyboard-operable controls, visible focus styles, and announced status/error messages.
- [x] Add simple responsive CSS for mobile and desktop.
- [x] Include a brief notice that tasks are shared and reset when the server restarts.

**Acceptance:** A user can load, add, complete/uncomplete, and delete tasks without refreshing the page. API failures do not falsely show successful changes.

## Phase 4 — Automated tests and quality gates

- [x] Add backend integration tests using the Node.js test runner and Supertest.
- [x] Test health, seeded listing, successful creation, completion changes, and deletion.
- [x] Test invalid titles, invalid completion values, unknown IDs, malformed JSON, oversized bodies, and unknown API routes.
- [x] Verify test isolation by creating a fresh app and store for each test.
- [x] Add frontend tests with Vitest, jsdom, and React Testing Library; mock network responses.
- [x] Test initial loading, populated and empty lists, and initial-request failure/retry.
- [x] Test successful add/toggle/delete flows and a failed mutation that preserves the displayed state.
- [x] Test title validation and disabled controls during pending requests.
- [x] Ensure all tests run once and exit correctly in CI.
- [x] Confirm `npm run lint`, `npm test`, and `npm run build` pass from the repository root.
- [ ] Manually test keyboard navigation and narrow-screen layout.

**Acceptance:** Quality commands pass on a fresh checkout, and tests cover both successful behavior and meaningful failure paths.

## Phase 5 — Production serving and Docker packaging

- [x] Configure Express to serve the built React files from `backend/public/` in production.
- [x] Keep API routing and API 404 handling ahead of static handling; unknown API paths must never return HTML.
- [x] Serve the root page and its assets correctly. Client-side routing is not needed for this single-page MVP.
- [x] Create a multi-stage Dockerfile using a supported Node.js 24 slim base; record/pin the selected base digest and plan updates.
- [x] In the build stage, run `npm ci` and build the frontend.
- [x] In the runtime stage, install only the backend workspace's production dependency tree using the root lockfile, excluding frontend and development dependencies.
- [x] Copy backend source and the frontend build into the runtime stage; do not copy the builder's full `node_modules`.
- [x] Set `NODE_ENV=production`, `PORT=8080`, and `EXPOSE 8080`.
- [x] Run as the image's non-root `node` user and use exec-form `CMD` to run `node backend/src/server.js` directly.
- [x] Add a Docker health check against `/api/health`, using Node's built-in HTTP/fetch support rather than assuming curl is installed.
- [x] Add `.dockerignore` entries for `.git`, local `node_modules`, build output, coverage, logs, and local environment files.
- [ ] Build and run the image locally using the commands in `readme.md`.
- [ ] Confirm the container becomes healthy, serves HTML/assets, and supports the full API CRUD flow.
- [ ] Confirm the process is non-root and `docker stop` shuts it down gracefully.
- [ ] Restart the container and verify the documented reset-to-seed behavior.

**Acceptance:** One locally built container serves the entire app without external services, source mounts, or a development server.

## Phase 6 — Pull request CI

- [x] Create `.github/workflows/ci.yml` for pull requests and pushes to `main`.
- [x] Use minimal permissions (`contents: read`) and pin third-party actions to reviewed commit SHAs.
- [x] Set up the agreed Node.js version and npm cache keyed by the root lockfile.
- [x] Run `npm ci`, lint, tests, and the frontend build.
- [x] Build the Docker image for the agreed deployment architecture.
- [x] Start a temporary container and use bounded readiness retries rather than a fixed sleep.
- [x] Smoke-test `/api/health`, `/api/tasks`, the HTML page, a referenced built asset, and API create/update/delete.
- [x] Assert response bodies/statuses, not just successful TCP connections.
- [x] Print container logs on failure and clean up the container even if a check fails.
- [ ] Require the CI check before merging where repository settings permit.
- [x] Keep registry publishing and credentials out of pull request execution, especially fork pull requests.

**Acceptance:** A broken test, build, or container smoke check blocks merging; valid pull requests pass without registry write access.

## Phase 7 — Publish a tested image

- [x] Create `.github/workflows/publish.yml` for pushes to `main` only.
- [x] Run quality gates in this workflow before publishing; do not assume a parallel CI workflow has already succeeded.
- [x] Configure Docker Buildx and build for the confirmed host architecture.
- [ ] Build and load the release image, smoke-test it, then publish that tested artifact.
- [ ] Authenticate to GHCR using `GITHUB_TOKEN` with `contents: read` and `packages: write`.
- [x] Normalize the registry path to lowercase and tag each image `sha-<full-commit-sha>`.
- [x] Add image labels linking to the source repository and commit.
- [ ] Scan the release image using a maintained container scanner; resolve or document actionable findings before deployment.
- [ ] Publish only after required checks pass and output the resulting image digest in the workflow summary.
- [ ] Choose GHCR package visibility; document host authentication if the image is private.
- [ ] Confirm the published tag can be pulled and the digest matches the intended release.

**Acceptance:** A merge to `main` produces a pullable, traceable image with a recorded digest. Pull requests cannot publish images.

## Phase 8 — Deploy to a Docker host

- [ ] Select the Linux host and confirm its CPU architecture matches the image.
- [ ] Install a supported Docker Engine and confirm sufficient disk space and available ports.
- [ ] Decide who operates the host and where release digests and deployment notes are recorded.
- [ ] Authenticate to GHCR if required, using a least-privilege package-read credential stored outside Git.
- [ ] Pull the exact release digest before stopping an existing working release.
- [ ] Record the previous digest and the container's runtime settings before replacement.
- [ ] For an update, stop and remove only the known application container; retain the previous image for rollback.
- [ ] Start the release with `--init`, `--restart unless-stopped`, and `127.0.0.1:8080:8080` port binding.
- [ ] Verify readiness with bounded retries and inspect container logs on failure.
- [ ] For public access, configure a host-level HTTPS reverse proxy, DNS, certificates, and firewall rules. Do not expose the demo over plain public HTTP.
- [ ] Verify the frontend, static assets, health response, and task CRUD from the actual access URL.
- [ ] Confirm graceful restart and expected data reset behavior.
- [ ] If release verification fails, replace the container with the previously recorded image digest and repeat verification.
- [ ] Record the deployed digest, source commit, deployment time, and verification results.

**Acceptance:** The published image runs on the chosen host, the complete app works at the intended URL, and the operator can restore the previous image. Brief replacement downtime and lost in-memory changes are explicitly accepted.

## Phase 9 — Handoff

- [x] Update `readme.md` to reflect actual commands, paths, scripts, versions, image location, and deployment details.
- [x] Remove the planning-only status only after the application and documented workflows exist.
- [ ] Reproduce install, development, test, build, and Docker steps from a fresh checkout (Docker remains blocked by an unavailable local daemon).
- [x] Document troubleshooting for port conflicts, failed API calls, registry permissions, image architecture mismatch, and unhealthy containers.
- [x] Document how to inspect logs, restart the service, deploy an update, and roll back.
- [ ] Confirm no credentials or local environment files were committed or included in the image (image build remains unverified without a daemon).
- [x] Mark completed tasks and record any remaining limitations.

**Final acceptance:** The repository provides a reproducible path from source code to a tested, published Docker image and a verified host deployment, without a database.

## Optional follow-ups — Not part of the MVP

- Browser end-to-end tests with Playwright.
- Automated host deployment with an approval gate and least-privilege credentials.
- Scheduled dependency/base-image rebuilds and automated vulnerability monitoring.
- Multi-architecture image publishing if both ARM64 and AMD64 hosts are needed.
- Persistence or authentication only if requirements change.
