# BoundRight

AI policy discrepancy detection for independent commercial insurance agencies.

**One sentence:** Agencies upload a proposal/binder and the issued policy; BoundRight compares them field by field, produces a cited discrepancy report a licensed agent reviews and confirms, and logs every check to an outcome dashboard that generates monthly client-facing ROI reports.

**Core promise:** never miss a limits mismatch again, and prove the value every month.

## Product

- **Primary user:** CSR or account manager at a 10–50 person independent commercial insurance agency. Zero learning curve, zero anxiety, professional trust.
- **Pricing:** $349/mo (founding: $249/mo), 150 checks/mo, 14-day free trial, no credit card to trial.
- **The human-in-the-loop rule:** every finding is confirmed or dismissed by a licensed agent before export. The exported report is the agent's work product, not the AI's.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript strict, deployed on Vercel |
| DB / Auth / Storage | Supabase (Postgres, Auth, Storage) — RLS on every table |
| Payments | Stripe (Checkout + Customer Portal + webhooks) |
| AI | Claude API (Sonnet) — extraction, comparison, critical-finding verification |
| PDF parsing | Server-side text extraction; page-image vision fallback for scans |
| PDF generation | Branded report export |
| Email | Resend |
| Monitoring | Sentry (no document content or PII ever logged) |
| Analytics | First-party events table in Postgres — no third-party analytics |

## Privacy commitments (marketing must match behavior exactly)

- Uploaded PDFs are **deleted after processing**. We keep only filenames and findings.
- No document content or extracted values in logs or error monitoring.
- RLS on every table; private storage bucket; short-lived signed URLs.

## Development

```bash
npm install
cp .env.example .env.local   # fill in keys
npm run dev
```

See `.env.example` for required environment variables.

## Repo layout (grows by phase)

- `app/` — Next.js App Router routes
- `prompts/` — versioned AI prompts (`extract_v1.ts`, …). Never edit a prompt in place; add a version.
- `eval/` — evaluation harness: golden specimen document pairs with known expected findings
- `supabase/` — SQL migrations, RLS policies

## Build phases

0. Skeleton: repo, deploy, landing page ← *current*
1. Auth + onboarding (RLS proven with isolation test)
2. AI pipeline: upload → extract → compare → verify → persist, eval harness
3. Report review + branded PDF export
4. Dashboard + Stripe billing + legal
5. Polish: empty states, a11y audit, admin view, demo mode

## Standing rules

- Buy, don't build: Claude API for AI, Supabase for auth, Stripe for billing. No custom ML, no custom auth.
- TypeScript strict; no `any` in pipeline code.
- Ethical design floor: no fake urgency, no shame copy, one-click cancellation, honest usage limits.
