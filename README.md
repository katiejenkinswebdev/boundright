# BoundRight

**Every account. Bound right.**

Policy discrepancy detection for independent commercial insurance agencies. A CSR uploads the proposal and the issued policy; BoundRight compares them field by field and produces a cited discrepancy report the licensed agent reviews, stamps, and files as E&O documentation.

- **Primary user:** CSR or account manager at a 10–50 person independent agency. Zero learning curve, zero anxiety, professional trust.
- **Pricing:** $349/mo (founding: $249/mo), 150 checks/mo, 14-day free trial, no credit card to trial.
- **The human-in-the-loop rule:** every finding is confirmed or dismissed by a licensed agent before export. The exported report is the agent's work product, not the AI's.

## Use cases

| The moment | What goes wrong without BoundRight | What solves it |
|---|---|---|
| A policy arrives from the carrier | Nobody checks it line by line; a $1M aggregate ships instead of $2M | Issuance check: field-by-field comparison with page citations, critical findings verified by a second AI pass |
| Renewal season, 40 policies in a week | Quietly dropped endorsements and raised deductibles slip through | Renewal comparison (expiring vs renewal) + batch mode |
| A client demands a certificate today | The COI promises coverage the policy doesn't support | Certificate check: every COI claim verified against the policy |
| A discrepancy is confirmed | The correction email takes 20 minutes to write and forgets "effective inception" | One-click correction request letter, industry conventions built in |
| The finding is wrong | False positives erode trust silently | Dismiss-with-reason feeds the accuracy dataset; excerpts let reviewers verify without the original document |
| A report sits unreviewed | Findings never become documented catches | 48h (configurable) reminders by email and Slack/Teams |
| The CSR lives in Outlook | Uploading is one step too many | Email-in checks: forward the carrier email, the check starts itself |
| The principal asks "was it worth it?" | Nobody remembers what was caught | ROI dashboard + auto-emailed monthly report, every number showing its math |
| Renewal negotiations with carriers | No data on who issues wrong | Per-carrier confirmed-critical rates (managers+) |
| A 20-person agency shares one login | No audit trail of who reviewed what | Roles (admin / manager / user), invites, per-reviewer attribution |

## Features

### Checks
- Three check types: issuance (proposal vs issued policy), renewal comparison (expiring vs renewal), certificate (COI vs policy), each with its own versioned comparison prompt and severity taxonomy
- Two-step New Check flow with drag-and-drop, directive validation copy, direct-to-storage signed uploads, staged progress, ready emails; batch mode for many pairs at once; email-in via a per-agency tokenized address (`/api/inbound`)
- Sample check demo mode (free, bundled specimens); failed checks never consume quota

### AI pipeline
- Claude structured extraction (verbatim values, page citations, ISO form conventions, issuing carrier); comparison with normalization and agency-configurable premium-variance thresholds; second-pass verification of criticals; versioned prompts with model + prompt version stored per check; per-check token/cost logging; PDFs deleted after processing with nightly verification

### Review and documentation
- Findings grouped by severity with confirm/dismiss, reviewer notes, and dismiss reasons (not a discrepancy / wrong extraction / known intentional / duplicate) that build the false-positive dataset
- Citation chips reveal ~240-character source excerpts, so reviewers can verify without the deleted originals
- Mark reviewed gated on every critical having a decision; the BOUND RIGHT stamp lands on confirmation
- Branded PDF export with reviewer attribution, citations, decisions, and the stamp; correction request letter drafted from confirmed findings (enumerated discrepancies, correction effective inception, written confirmation), editable and stored

### Teams and roles
- Admin / manager / user roles: users run and review; managers add agency analytics; admins add configuration, team, integrations, billing, and deletion
- Email invites with join links; role management in Settings → Team

### Metrics that show their work
- Every dashboard number carries a "?" explainer with the exact formula and the agency's own inputs; only reviewer-confirmed findings count toward any metric
- KPI tiles (cap meter, confirmed by severity, hours saved with dollar equivalent, exposure flagged), 6-month trend with table view, per-carrier confirmed-critical rates (managers+, with a small-sample caveat)
- Monthly ROI report PDF, snapshotted and auto-emailed on the 1st

### Configuration (Settings → Configuration, admins)
- ROI assumptions: manual check minutes, average account premium, loaded CSR hourly rate
- Scoring thresholds: premium variance % (issuance) and renewal premium %, injected into comparisons per agency
- Workflow: review-reminder timing in hours

### Integrations and feedback
- Slack/Teams incoming webhook for check-ready and reminder notices; email-in address per agency
- In-app feedback widget (general / bug / idea / "a finding was wrong") stored first-party and surfaced in the operator console; no third-party analytics

### Billing, ops, accessibility
- 14-day/10-check trial, Stripe checkout + one-click-cancel portal, webhooks with 7-day payment grace and read-only cancellation, honest caps with no overages, burst rate limiting
- Operator console (agencies, AI cost, failures, feedback), cost guardrails, weekly ops digest, cron jobs (period reset, monthly reports, deletion verification, reminders), Sentry with PII scrubbing, security headers, first-party events only
- WCAG AA, keyboard reachable, reduced motion respected; "audit ledger, modern" design system with the stamp as the single bold element

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
