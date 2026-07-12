#!/usr/bin/env bash
# BoundRight QA gate — run on every change (npm run qa).
# Static checks -> production build -> full test suites against the local
# Supabase stack with a stubbed model. Pass --live to also run the model
# eval (requires ANTHROPIC_API_KEY).
set -uo pipefail

cd "$(dirname "$0")/.."

QA_PORT="${QA_PORT:-3199}"
LIVE=0
[ "${1:-}" = "--live" ] && LIVE=1

BOLD=$(tput bold 2>/dev/null || true)
RESET=$(tput sgr0 2>/dev/null || true)
FAILED=0
declare -a RESULTS=()

step() {
  local name="$1"; shift
  echo ""
  echo "${BOLD}── ${name} ─────────────────────────────${RESET}"
  if "$@"; then
    RESULTS+=("PASS  ${name}")
  else
    RESULTS+=("FAIL  ${name}")
    FAILED=1
  fi
}

# --- Environment -------------------------------------------------------------
if [ -f .env.local ]; then
  set -a; source .env.local; set +a
fi
: "${SUPABASE_URL:?Set SUPABASE_URL (see .env.local / .env.example)}"

supabase_up() {
  if curl -sf "${SUPABASE_URL}/auth/v1/health" -o /dev/null \
      -H "apikey: ${SUPABASE_ANON_KEY}"; then
    echo "Supabase stack already running."
  else
    npx --yes supabase@latest start || return 1
  fi
  npx --yes supabase@latest migration up
}

# --- Static checks + build ---------------------------------------------------
step "lint"       npm run lint
step "typecheck"  npx tsc --noEmit
step "supabase"   supabase_up
step "build"      npm run build

if [ "$FAILED" -ne 0 ]; then
  echo ""; echo "${BOLD}Static checks failed — skipping runtime suites.${RESET}"
  printf '%s\n' "${RESULTS[@]}"
  exit 1
fi

# --- Runtime suites ----------------------------------------------------------
lsof -ti ":${QA_PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true
CLAUDE_STUB_DIR=eval/stubs npm run start -- -p "${QA_PORT}" >/tmp/boundright-qa-server.log 2>&1 &
SERVER_PID=$!
trap 'kill "${SERVER_PID}" 2>/dev/null; lsof -ti ":${QA_PORT}" 2>/dev/null | xargs kill -9 2>/dev/null || true' EXIT

for _ in $(seq 1 60); do
  curl -sf "http://localhost:${QA_PORT}/login" -o /dev/null && break
  sleep 0.5
done
if ! curl -sf "http://localhost:${QA_PORT}/login" -o /dev/null; then
  echo "Server failed to start:"; tail -20 /tmp/boundright-qa-server.log
  exit 1
fi

APP="http://localhost:${QA_PORT}"
step "rls-isolation"   node scripts/rls-isolation-test.mjs
step "onboarding-e2e"  node scripts/e2e-onboarding-test.mjs "$APP"
step "pipeline-e2e"    env CLAUDE_STUB_DIR=eval/stubs npx tsx scripts/pipeline-e2e-test.ts
step "report-e2e"      env CLAUDE_STUB_DIR=eval/stubs npx tsx scripts/report-e2e-test.ts "$APP"
step "sample-check"    node scripts/sample-check-e2e.mjs "$APP"
step "letter-guidance" env CLAUDE_STUB_DIR=eval/stubs npx tsx scripts/letter-guidance-test.ts

if [ "$LIVE" -eq 1 ]; then
  if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    step "model-eval (live)" npx tsx eval/run.ts
  else
    echo "(--live requested but ANTHROPIC_API_KEY is not set — skipping eval)"
    RESULTS+=("SKIP  model-eval (no ANTHROPIC_API_KEY)")
  fi
fi

# --- Summary -----------------------------------------------------------------
echo ""
echo "${BOLD}── QA summary ─────────────────────────────${RESET}"
printf '%s\n' "${RESULTS[@]}"
if [ "$FAILED" -ne 0 ]; then
  echo ""; echo "${BOLD}QA FAILED${RESET}"; exit 1
fi
echo ""; echo "${BOLD}QA PASSED${RESET}"
