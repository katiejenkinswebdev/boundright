# BoundRight

**Every account. Bound right.**

Policy discrepancy detection for independent commercial insurance agencies. A CSR uploads the proposal and the issued policy; BoundRight compares them field by field and produces a cited discrepancy report the licensed agent reviews, stamps, and files as E&O documentation.

- **Primary user:** CSR or account manager at a 10–50 person independent agency. Zero learning curve, zero anxiety, professional trust.
- **Pricing:** $349/mo (founding: $249/mo), 150 checks/mo, 14-day free trial, no credit card to trial.
- **The human-in-the-loop rule:** every finding is confirmed or dismissed by a licensed agent before export. The exported report is the agent's work product, not the AI's.

## Use cases

| The moment | What goes wrong without BoundRight | What solves it |
|---|---|---|
| A policy arrives from the carrier | Nobody checks it line by line; a $1M aggregate ships instead of $2M | Issuance check: cited field-by-field comparison, criticals verified by a second AI pass |
| Renewal season, 40 policies in a week | Quietly dropped endorsements and raised deductibles slip through | Renewal comparison + batch mode |
| Dozens of certificates against one policy | The COI promises coverage the policy doesn't support | Certificate flow: one policy, many certs, each verified |
| Reports pile up unreviewed | Findings never become documented catches | Review queue with assignment, nav badge, "Next unreviewed" flow, configurable reminders |
| A discrepancy is confirmed | The correction email forgets "effective inception" | One-click correction request letter, industry conventions built in |
| The finding is wrong | False positives erode trust silently | Dismiss-with-reason feeds the accuracy dataset; source excerpts under every citation |
| The CSR lives in Outlook / Slack | Uploading is one step too many | Email-in checks; per-client Slack/Teams webhooks with test notices |
| The principal asks "was it worth it?" | Nobody remembers what was caught | Filterable dashboard (week to year or custom) + period report PDF matching the filter |
| Renewal negotiations with carriers | No data on who issues wrong | Per-carrier confirmed-critical rates (managers+) |
| A 20-person agency shares one login | No audit trail of who reviewed what | Roles (user / manager / admin / system_admin), invites, per-reviewer attribution |
| A prospect asks "how does the AI work?" | Hand-waving | /ai plain-language transparency page + data-processing one-pager |
| A folder of unlabeled PDFs from renewal week | Someone sorts and pairs them by hand | Smart intake (flagged): drop the pile, AI classifies and proposes pairs, human confirms, exceptions surface |

## Features

### Checks
- **Smart intake (feature-flagged, system_admin enables per agency):** drop up to 30 unlabeled PDFs; a cheap classification pass identifies each document and proposes confidence-scored pairs (issuance/renewal/COI inferred); the human confirms before anything runs; orphans surfaced then deleted; staged files auto-removed in 48h
- Three check types (issuance, renewal, certificate) with typed comparison prompts and per-type document labels; batch mode; certificate volume flow (one policy, many COIs); email-in via per-agency tokenized address; sample check demo mode; failed checks never consume quota
- Directive validation copy, signed-URL direct uploads, staged progress with ready emails and Slack/Teams notices

### AI pipeline
- Claude structured extraction (verbatim values, page citations, ISO form conventions, issuing carrier); agency-configurable premium-variance thresholds injected per comparison; second-pass verification of criticals; versioned prompts + model recorded per check; token/cost logging; source-document SHA-256 fingerprints; PDFs deleted after processing with nightly verification

### Review workflow
- Awaiting-review queue on the dashboard (all roles) with assignment and waiting age; count badge on the Checks nav; "Next unreviewed" on report footers; reviewer select per check
- Confirm/dismiss with notes and dismiss reasons; citation chips reveal stored source excerpts; Mark reviewed gated on criticals; the BOUND RIGHT stamp lands on confirmation

### Reports (one brand system: `lib/pdf-brand.ts`)
- Discrepancy report: agency co-brand + the dated verification stamp, audit trail, document fingerprints, findings as exhibits with excerpts, dismissed-with-reason, reconciliation line, reviewer certification, report ID + pagination
- Period report from the dashboard: follows the active range filter exactly (presets or custom dates), six KPIs including staff cost savings, auto-written summary; monthly version auto-emailed on the 1st
- All PDFs share the tilted-seal lockup or stamp per brand rules, wordmark footer, metadata, and the naming convention `BoundRight - {Type} - {Client} - {ISO date(s)}.pdf`
- Correction request letters drafted from confirmed findings (effective-inception convention), editable, never auto-sent

### Dashboard & analytics
- Time-range filter (week / month / 3m / 6m / year / custom) driving all four KPI tiles, the adaptive-bucket trend chart (daily/weekly/monthly, non-overlapping axis labels, table view with severity breakdown), and carrier accuracy (managers+)
- Every metric shows its formula with the agency's own inputs on hover; only reviewer-confirmed findings count anywhere

### Teams & roles
- user → manager (adds analytics) → admin (adds configuration, team, integrations, billing, deletion) → system_admin (operator; database-granted only)
- Email invites with join links; the ops console shows every client's configuration in one place

### Configuration, feedback, transparency
- Settings → Configuration (admins): ROI assumptions, scoring thresholds, reminder timing
- In-app feedback widget (incl. "a finding was wrong") stored first-party; getting-started checklist for new agencies
- /ai plain-language AI transparency page; prompt-version drift monitoring in the ops console; prompt rollback runbook below

### Billing, ops, platform
- Stripe trial/checkout/portal/webhooks with honest caps and no overage billing; operator console (agencies, config, AI cost, failures, drift, feedback); cost guardrails; crons (period reset, monthly reports, deletion verification, review reminders, weekly ops digest); Sentry with PII scrubbing; security headers; RLS everywhere; WCAG AA

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript strict, deployed on Vercel |
| DB / Auth / Storage | Supabase (Postgres, Auth, Storage) with RLS on every table |
| Payments | Stripe (Checkout + Customer Portal + webhooks) |
| AI | Claude API (`claude-sonnet-5`): extraction, comparison, critical-finding verification |
| PDF parsing | Server-side text extraction (unpdf); PDF-as-document vision fallback for scans |
| PDF generation | pdf-lib (discrepancy reports, monthly ROI reports, one-pager) |
| Email | Resend |
| Monitoring | Sentry (no document content or PII ever logged) |
| Analytics | First-party events table in Postgres; no third-party analytics |

## AI transparency

How the AI is used, in one paragraph (the full plain-language version ships in-app at `/ai`): Claude extracts facts verbatim from both documents with a page citation for every value, compares them under a hardcoded severity taxonomy, and re-verifies every critical finding against source excerpts in a second pass. The AI may not guess (absent fields stay absent), may not make final calls (every finding waits for a licensed reviewer; only confirmed findings count anywhere), and may not send anything (the correction letter is a draft the reviewer edits and sends themselves). Every check records its model and prompt version; prompts are versioned files that are never edited in place; no prompt or model change ships unless the eval harness finds every seeded critical with zero false criticals; reviewer dismissals are captured with reasons as the correction dataset; and the admin console tracks reviewer agreement per prompt version so drift shows up in data, not anecdotes. Customer documents are deleted after processing (nightly-verified) and are not used to train models.

**Prompt rollback runbook:** if the dismiss rate for a new prompt version spikes in the admin drift table, revert by re-importing the previous prompt version in `lib/pipeline/claude.ts` (versions are immutable files), run `npm run qa:live`, and ship. In-flight checks keep their recorded version for the audit trail.

## Privacy commitments (marketing must match behavior exactly)

- Uploaded PDFs are **deleted after processing**. We keep only filenames, findings, and the short cited excerpts shown in reports.
- No document content or extracted values in logs or error monitoring.
- RLS on every table; private storage bucket; short-lived signed URLs.

## Getting started

```bash
npm install
npx supabase start           # local stack (prints keys; this repo uses ports 55321+)
cp .env.example .env.local   # fill in keys
npm run dev
```

Without an `ANTHROPIC_API_KEY`, run the server in stub mode to exercise the full product with the bundled specimen documents:

```bash
CLAUDE_STUB_DIR=eval/stubs npm run dev
```

Sample input files (three proposal/policy pairs with seeded discrepancies, plus password-protected and wrong-format problem files) are generated by `node eval/generate-specimens.mjs` into `eval/specimens/`. Each pair's expected findings live in `eval/expected/`.

## QA — run on every change

```bash
npm run qa        # lint + typecheck + build + all 5 E2E suites (stubbed model)
npm run qa:live   # same, plus the model eval (needs ANTHROPIC_API_KEY)
```

The gate runs automatically in three places:

1. **Pre-push hook** (`.githooks/pre-push`, installed via `git config core.hooksPath .githooks`, one-time per clone). Bypass in an emergency with `git push --no-verify`.
2. **GitHub Actions** (`.github/workflows/qa.yml`) on every push and PR; spins up a Supabase stack in the runner. Add an `ANTHROPIC_API_KEY` repo secret to enable the live model eval on main.
3. **Manually** before any prompt or model change: `npm run qa:live` — the eval harness (`eval/run.ts`) must show every seeded critical found with zero false criticals.

Suites: RLS isolation (14 checks), onboarding flow (10), pipeline + deletion + failure copy (14), report review + PDF export + cross-agency denial (21), sample-check demo (7).

## Repo layout

- `app/` — Next.js App Router routes, server actions, UI components
- `lib/` — pipeline (ingest/extract/compare/verify/orchestrate), PDF builders, Stripe, email, auth helpers
- `prompts/` — versioned AI prompts (`extract_v1.ts`, …). Never edit a prompt in place; add a version.
- `eval/` — golden specimen pairs, expected findings, stub fixtures, and the eval harness
- `scripts/` — QA gate, E2E test suites, generators (specimens, one-pager)
- `supabase/` — SQL migrations (schema, RLS, grants, storage, billing)
- `.github/workflows/` + `.githooks/` — the QA pipeline

## Production launch steps (in order)

1. **Anthropic:** put `ANTHROPIC_API_KEY` in `.env.local` and as a GitHub Actions secret; run `npm run qa:live` — the live eval must pass (every seeded critical found, zero false criticals)
2. **Supabase (production):** create the project, `supabase link`, `supabase db push` (12 migrations); grant your account `system_admin` (`update profiles set role='system_admin' where user_id = ...`)
3. **Vercel:** create the project, set every var from `.env.example` (including `CRON_SECRET`, `ADMIN_EMAILS`), deploy; crons come from `vercel.json`
4. **Stripe:** create Founding ($249) and Standard ($349) prices, set `STRIPE_*` env vars, point the webhook at `/api/stripe/webhook`, run a test-mode subscribe/cancel round trip
5. **Resend:** verify the sending domain; point an inbound provider (Resend Inbound / SendGrid Parse) at `/api/inbound`
6. **Sentry:** set `SENTRY_DSN` (server) and `NEXT_PUBLIC_SENTRY_DSN` (client)
7. **Content:** real Calendly URL and hero screenshot on the landing page; record the 3-minute demo
8. **Legal:** attorney pass on Terms and Privacy before the first paid subscription
9. **Smoke test in production:** sample check → review → export; subscribe → cancel; invite a teammate

## Roadmap

- [ ] Report verification endpoint (`/verify/[id]`) + QR on the PDF; IBM Plex embedding in PDFs
- [ ] Inline editing of client settings from the ops console (logged, on-behalf-of)
- [ ] Correction tracking (requested → corrected → verified by re-check); renewal radar; CSV export; client-facing summary letter
- [ ] Golden eval set expanded with real redacted documents; dismiss reasons fed back into prompts; published accuracy stats on /ai
- [ ] AMS integrations (HawkSoft/EZLynx first), SSO, public API; self-hosted PostHog only if deeper analytics is ever needed
- [ ] QA suites should clean up their test agencies in the local DB

## Standing rules

- Buy, don't build: Claude API for AI, Supabase for auth, Stripe for billing. No custom ML, no custom auth.
- TypeScript strict; no `any` in pipeline code.
- Ethical design floor: no fake urgency, no shame copy, one-click cancellation, honest usage limits.
- Brand rules (see brand guide v1.0): the stamp appears only at real verification moments; signal colors are never decorative; no em dashes or exclamation points in product copy.
