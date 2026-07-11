# BoundRight

**Every account. Bound right.**

Policy discrepancy detection for independent commercial insurance agencies. A CSR uploads the proposal and the issued policy; BoundRight compares them field by field and produces a cited discrepancy report the licensed agent reviews, stamps, and files as E&O documentation.

- **Primary user:** CSR or account manager at a 10–50 person independent agency. Zero learning curve, zero anxiety, professional trust.
- **Pricing:** $349/mo (founding: $249/mo), 150 checks/mo, 14-day free trial, no credit card to trial.
- **The human-in-the-loop rule:** every finding is confirmed or dismissed by a licensed agent before export. The exported report is the agent's work product, not the AI's.

## Features

### Checks — the core loop
- Two-step New Check flow: label + policy type, then dual drop zones (drag-and-drop or click) for the proposal/binder and the issued policy
- Client- and server-side validation with directive error copy (wrong file type, password-protected, over 50 MB / 300 pages)
- Direct-to-storage uploads via short-lived signed URLs; PDFs never pass through the app server
- Async processing with a staged progress screen (reading → comparing → building), live polling, and a "your check is ready" email
- Failure states in plain language with one-click retry; failed checks never count against the monthly cap
- Scanned-document detection (text coverage under 20%) with a vision fallback and a visible reduced-confidence notice
- Sample check demo mode: one click runs a bundled specimen pair through the real pipeline, free, nothing uploaded

### AI pipeline
- Claude (`claude-sonnet-5`) extraction with structured JSON output: named insureds, dates, limits, deductibles, forms/endorsements schedules, premium — every value verbatim with a page citation, ISO form-number conventions respected
- Field-by-field comparison with date/currency normalization and the hardcoded severity taxonomy (critical / moderate / minor), including missing-form detection against the schedule of forms and premium-variance thresholds
- Documents-swapped sanity check ("these may be uploaded in reverse order")
- Second-pass verification of every critical finding against source-page excerpts; disagreements downgrade confidence instead of shipping false criticals
- Versioned prompts in `/prompts` with the model + prompt version stored on every check (audit trail), plus per-check token and cost logging
- Uploaded PDFs deleted immediately after processing, success or failure, with a nightly job that verifies deletion independently

### Report review
- Summary strip with severity counts; findings grouped critical → moderate → minor
- Side-by-side "Proposal says / Policy says" cards with explicit "Not found" states and clickable page-citation chips
- Confidence indicators; low-confidence findings carry "Verify against source"
- Confirm or Dismiss on every finding, with optional reviewer notes
- Matches shown too (collapsed by default) to build trust in what was checked
- "Mark reviewed" gated on a decision for every critical finding; confirmation lands the BOUND RIGHT stamp with the review date

### Export
- Branded PDF report: agency co-branding, findings ledger with citations, reviewer decisions and notes, "Reviewed by [name] on [date]", the stamp, engine version, and the disclaimer on every page — built to sit in an E&O file
- Export gated to reviewed checks; every export recorded for the audit trail

### Checks list
- Search by client/account label, severity chips per check, view/export/delete with a confirm step that states findings will be removed and stats adjusted

### Dashboard
- Four KPI tiles: checks this month with a cap meter, confirmed discrepancies split by severity, hours saved (with the math shown and editable assumptions), exposure flagged (labeled as an estimate)
- Six-month trend chart (checks vs confirmed discrepancies) with an accessible table view and colorblind-validated series colors
- Recent checks with live status
- Monthly ROI report: one-page branded PDF with an auto-written summary paragraph, downloadable on demand, snapshotted, and auto-emailed to the account owner on the 1st for the prior month

### Billing
- 14-day / 10-check trial with a factual banner (days and checks remaining, no countdown theatrics)
- Stripe Checkout for Founding ($249) and Standard ($349) plans; Customer Portal for card, invoices, and one-click cancellation with no retention tricks
- Webhooks: subscription start, payment failure (7-day grace with in-app notice), recovery, and cancellation (read-only mode that preserves data and reports)
- Honest usage limits: quiet notice at 80%, checks pause at 100% with the reset date — never silent overage billing
- Burst rate limiting on check creation; monthly usage resets by cron

### Accounts & settings
- Email/password and magic-link sign-in, password reset, ToS consent at signup
- Three-minute onboarding: agency name plus the three ROI assumptions (manual check time, average account premium, CSR hourly rate)
- Settings: profile and password, agency name/logo/assumptions, billing, legal, and a danger zone that deletes the agency and all data (type the agency name to confirm)
- Per-agency isolation enforced by Postgres row-level security, proven by tests

### Email
- Type-led branded templates (no imagery) for check-ready, monthly ROI report (PDF attached), and the weekly ops digest

### Marketing site & trust
- Landing page: "Was it bound right?" hero, public 3-tier pricing (never behind a demo call), free-audit offer, email capture, plain-words trust signals
- Terms and Privacy drafts, plus a downloadable data-processing one-pager PDF (what we store, what we delete, where it lives) for buyer due diligence

### Ops (solo-founder tooling)
- `/admin` console: every agency with plan, billing state, usage, cumulative AI cost, and last activity; recent failures with reasons
- Cost guardrails: per-check over $2 and per-agency over $75/mo are flagged
- Weekly ops email: signups, checks, failures, AI spend, MRR from Stripe
- Cron jobs: monthly period reset, monthly report generation + email, nightly deletion verification, weekly digest
- Sentry error monitoring with document content and PII scrubbed; strict security headers (CSP, X-Frame-Options); first-party events analytics only

### Accessibility & design
- "Audit ledger, modern" design system: Ink/Paper palette, IBM Plex Sans + Mono (extracted values always in mono), the stamp as the single bold element
- WCAG AA contrast, 16px+ body text, full keyboard reachability, visible focus, `prefers-reduced-motion` respected

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

## Privacy commitments (marketing must match behavior exactly)

- Uploaded PDFs are **deleted after processing**. We keep only filenames and findings.
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

## Going live checklist

1. Vercel project + env vars from `.env.example` (including `CRON_SECRET`, `ADMIN_EMAILS`)
2. Production Supabase project: `supabase link` + `supabase db push`
3. `ANTHROPIC_API_KEY`, then `npm run qa:live` must pass
4. Stripe: prices for both plans, webhook endpoint (`/api/stripe/webhook`), test-mode subscribe/cancel round trip
5. Resend domain, Sentry DSN
6. Real Calendly URL on the landing page; real screenshot in the hero; demo video
7. Attorney pass on Terms and Privacy before the first paid subscription

## Standing rules

- Buy, don't build: Claude API for AI, Supabase for auth, Stripe for billing. No custom ML, no custom auth.
- TypeScript strict; no `any` in pipeline code.
- Ethical design floor: no fake urgency, no shame copy, one-click cancellation, honest usage limits.
- Brand rules (see brand guide v1.0): the stamp appears only at real verification moments; signal colors are never decorative; no em dashes or exclamation points in product copy.
