# Manual test plan

Documents live in `~/Documents/boundright-test-kit/` (regenerate any time with
`node eval/generate-specimens.mjs`; smart-intake files are in
`~/Documents/boundright-samples/smart-intake/`). Run the app keyless with
`CLAUDE_STUB_DIR=eval/stubs npm run dev`. Automated coverage of all of this
runs in `npm run qa`; this checklist is for hands-on verification of the
experience itself.

## Accounts

| Login | Role | Password |
|---|---|---|
| kind2karma@gmail.com | system_admin | (yours) |
| test-admin@mindseye.test | admin | BoundRight-Test-2026 |
| test-manager@mindseye.test | manager | BoundRight-Test-2026 |
| test-user@mindseye.test | user | BoundRight-Test-2026 |
| admin@coastalrisk.test | admin, Coastal Risk (smart intake ON, logo set) | BoundRight-Test-2026 |
| admin@summitinsurance.test | admin, Summit (trial) | BoundRight-Test-2026 |
| admin@heartlandagency.test | admin, Heartland (past_due) | BoundRight-Test-2026 |

## 1 · Happy path

1. New check → `pair1_proposal.pdf` + `pair1_policy.pdf` → watch the 4-stage progress (pulsing stage, green checks); the checks list shows a pulsing dot on the running row.
2. Report ready: summary badges with hover definitions; confidence shown on every finding; "✦ AI" on undecided findings; source excerpts open from the citation chips.
3. Confirm both criticals (one with a note), dismiss one moderate with a reason. Mark reviewed → stamp lands beside the title, status flips to REVIEWED in the header.
4. Draft the correction letter (✦ AI draft, disclaimer above Copy/Redraft, **no signature block**). Rate it 👎 with a note → check it lands in /admin AI ratings.
5. Export the PDF from the sticky footer: BR seal lockup top-right, agency logo top-left (use a Coastal check to see co-branding), dated stamp at the reviewer certification, SHA-256 fingerprints under Documents Examined, audit trail line.

## 2 · Input-quality guardrails (each must fail with pointed copy, not a junk report)

| Upload | Expected failure copy contains |
|---|---|
| `trash_email.pdf` as doc A | "doesn't look like an insurance document" |
| `trash_memo.pdf` / `trash_blank.pdf` | same |
| `pair1_policy.pdf` as BOTH documents | "Both uploads are the same file" |
| `encrypted.pdf` | "password-protected. Remove the password" |
| `wrong_format.docx.pdf` | "isn't a readable PDF. Export it as PDF" |

Each failed check: shows the reason on the check page with "Try again", does NOT count against the allowance, appears in /admin Recent failures, and the PDFs are deleted.

## 3 · Smart intake (Coastal account; flag is ON there)

1. Drop the whole `boundright-samples/smart-intake/` pile → classification chips with "✦ … confidence" tooltips, orphan called out, locked file listed under failures.
2. Uncheck one pair, run → "N checks running", rate the pairing.

## 4 · Filters and tables (Checks page)

1. Status/Type/Date rows read as three labeled rows; date presets match the dashboard, "All time" is default; custom dates use styled inputs.
2. Combine: Status=Reviewed + Type=Issuance + Date=3 months → search within results (filters persist), sort columns, paginate, change rows-per-page (persists after reload).
3. Archive a check (confirmation first) → Archived tab → Restore. Sign in as test-user: no Delete button; as manager+: Delete present.

## 5 · Dashboard (manager+)

1. Range filter drives KPIs, chart, and carrier table; chart hover shows the severity breakdown; Show table headers have severity tooltips; carrier Trend column shows ▲/▼/→ (or — under 5 checks).
2. Generate report → period PDF honors the filter, seal lockup, staff cost savings.

## 6 · Ops console (system admin, /ops — linked from Admin)

1. Client config table: members by role, thresholds, webhook, smart intake toggle, audit CSV per client.
2. Correction letter prompt: set platform guidance + Coastal-specific guidance → draft a letter on a Coastal check (stub mode echoes both at the bottom); clear them and the echoes disappear.
3. Announcements: post one ending tomorrow → ink banner on every app page; End now → gone on refresh.
4. AI ratings and drift tables populate; feedback list shows widget submissions.

## 7 · User management (as manager or admin)

1. Admin → Team: each member shows login email + last sign-in; open Manage on a lower-ranked member: edit name, change login email, Send password reset (check Inbucket at localhost:55324 in local dev), Suspend (badge appears; their next sign-in fails), Restore, Remove (confirm dialog; login deleted; audit log keeps their review history).
2. Rank rules: a manager sees Manage only on users; an admin on managers and users; nobody manages themselves (use Profile) or an equal/higher rank.
3. As admin: pending invites list under Team with Revoke. Role changes live inside each member's Manage panel (admins only).

## 8 · Roles sweep

user: no dashboard analytics, no delete, no admin sections in Settings. manager: + analytics + delete. admin: + team/config/billing. system_admin: + /admin. Non-admins hitting /admin get a 404.

## 9 · MFA

1. Settings → Security → Set up two-factor authentication → scan the QR with any authenticator app → confirm the 6-digit code → "on" badge.
2. Sign out, sign back in: after the password you land on /mfa; a wrong code is rejected; the right code lands on the dashboard.
3. Settings → Security → Turn off → next sign-in is password-only.

## 10 · Billing (needs Stripe test keys)

Subscribe on Founding from Settings → Billing (radio prices come from `lib/pricing.ts`), test-card checkout, plan reflects on the agency, Manage billing opens the portal, cancel in one click.
