#!/usr/bin/env bash
set -euo pipefail

base_url="${1:-http://127.0.0.1:8080}"
base_url="${base_url%/}"
body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT

for attempt in $(seq 1 30); do
  if curl --fail --silent --show-error "$base_url/api/health" -o "$body_file"; then
    node -e 'const body = JSON.parse(process.argv[1]); if (body.status !== "ok") process.exit(1)' "$(cat "$body_file")"
    echo "Service ready after $attempt attempt(s)."
    break
  fi
  if [ "$attempt" = "30" ]; then
    echo "Service did not become ready after 30 attempts." >&2
    exit 1
  fi
  sleep 1
done

status() {
  curl --silent --show-error -o "$body_file" -w '%{http_code}' "$@"
}

test "$(status "$base_url/")" = "200"
asset_path="$(grep -oE 'src="[^"]+"' "$body_file" | sed -nE 's/src="([^"]+)"/\1/p' | grep '^/assets/' | head -n 1)"
test -n "$asset_path"
test "$(status "$base_url$asset_path")" = "200"

test "$(status "$base_url/api/tasks")" = "200"
node -e 'const value = JSON.parse(process.argv[1]); if (!Array.isArray(value) || value.length < 1) process.exit(1)' "$(cat "$body_file")"

test "$(status -X POST -H 'Content-Type: application/json' --data '{"title":"Smoke task"}' "$base_url/api/tasks")" = "201"
task_id="$(node -e 'console.log(JSON.parse(process.argv[1]).id)' "$(cat "$body_file")")"
test -n "$task_id"

test "$(status -X PATCH -H 'Content-Type: application/json' --data '{"completed":true}' "$base_url/api/tasks/$task_id")" = "200"
node -e 'if (JSON.parse(process.argv[1]).completed !== true) process.exit(1)' "$(cat "$body_file")"
test "$(status -X DELETE "$base_url/api/tasks/$task_id")" = "204"
test ! -s "$body_file"
echo "Smoke checks passed."
