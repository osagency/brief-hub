# Openspace Agency OS — PRD

## Problem Statement
Internal agency operations tool for **Openspace** (osagency.in), a Mumbai digital marketing agency run by Yusuf. Manages 6 clients (Galalite Screens, Lumina Screens, TKPL, Intercont+, Safewater Lines, SmartCo Shipping) and a team of 5 (Arjun/Writer, Priya/Designer, Kavya/Digital Mktg, Rohan/Web Dev, Meera/Client Servicing). Centrepiece: Claude Sonnet 4.5 reads incoming client emails, generates structured briefs, detects information gaps, and delegates the work.

## Architecture
- **Backend**: FastAPI + Motor + MongoDB. JWT auth (`PyJWT`), bcrypt password hashing. `/api/*` prefix. Emergent LLM key for Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`) via `emergentintegrations`.
- **Frontend**: React 19 + Tailwind + shadcn/ui + lucide-react + sonner. Fixed 220px sidebar + 54px topbar. Inter (body) + DM Mono (IDs/dates).
- **Seed on startup**: 6 accounts, 6 clients, 12 jobs, 6 invoices, 5 KPI entries, 5 SOPs, 10 content posts, 5 inbox emails, 5 approvals, 6 timelogs, 6 notifications.

## User Personas
1. **Yusuf (Manager, admin)** — sees everything, creates jobs, logs KPI reviews, sets targets, sees invoices/finance, delegates via AI.
2. **Team member (Arjun / Priya / Kavya / Rohan / Meera)** — sees only jobs they are assigned to; no invoices, no inbox parse, no reports, no team-review.

## Core Requirements
- **15 routes**: `/dashboard`, `/inbox`, `/jobs`, `/board`, `/calendar`, `/approvals`, `/time`, `/clients`, `/invoices`, `/kpi`, `/sop`, `/reports`, `/ai`, `/vibes`, `/notifications` (+ `/login`).
- **AI-powered features**: brief parser with gap detection + follow-up email draft, reply drafter, coaching advice, team review, monthly/weekly/quarterly reports, SOP generator, agency chat assistant, job help (email/next/standup).
- **RBAC**: manager vs team member enforced on backend routes AND frontend sidebar.
- **Scope creep flag** on jobs with `scopeAdded > 0`.
- **Multi-brand health** on Dashboard + Brief modal.

## What's Been Implemented (Feb 2026)
- Full backend: auth, users (full CRUD + password reset), clients (full CRUD), jobs (CRUD + comments **+ @mentions with notifications** + file attachments via Emergent object storage), content posts, timelogs, approvals with per-card comments + reminders + revision tracking **+ public magic-link portal**, KPI + coaching + team-review, SOPs, inbox brief-parse/draft-reply/create-job, notifications, reports, AI assistant + job-help + Prompt Studio + Job Templates, **global search** across jobs/clients/approvals.
- Full frontend: Dashboard, Inbox, Jobs, Board (drag-and-drop), Calendar, Approvals (sharper + Copy client link), Time, Clients, Manage Team, KPI, SOPs, Reports, AI, Prompt Studio, Vibes (per-member brand pie), Notifications. Team members land on `/dashboard = My Day`. **Public `/client/approval/:token` page (no auth, no sidebar)**. Inline PDF+image attachment preview modal in Job Detail + Public portal.
- Passing tests: iter1 30/30, iter2 32/32, iter3 44/44, iter4 58/58, **iter5 71/71** — all backend + frontend green.
- **Hardened iter-5**: regex-escaped search input (no ReDoS), one-time startup token backfill (GET is idempotent), 409 on re-decide, safe projection on public payload (no job.desc / assignees / hours leak), 80/4000 char caps on client-supplied fields.

## What's Been Implemented (Feb 2026 — v2 delight pass)
- **Openspace logo** wired into sidebar, mobile topbar, and login page (`/logos/openspace-logo.png`).
- **Manager "View as…" impersonation** — admin picks any team member from topbar dropdown, sees the app exactly as they see it (My Day, filtered jobs, hidden manager-only routes). Amber banner + toast confirm the impersonation. Backend enforces via `X-View-As` header (admin-only). New: `ViewAsSwitcher` in Layout.
- **Job-completion celebration** — canvas-confetti burst + "+XP Vibes shipped 🔥" toast + AI-generated personalised congrats (new `POST /api/ai/celebrate`). Fires from both drag-to-Done on the Board and the status dropdown in the Job Detail modal.
- **Streak counter** — `GET /api/kpi/streak` returns consecutive-day completion streak + jobs completed today (respects role filter / impersonation). Rendered on **My Day** and **Vibes** (replacing the previously-hardcoded "7-day streak").
- **Sound toggle** in topbar — optional subtle "ding" on job-done, muted by default.
- **Mobile drawer sidebar** — hamburger menu on `<md`, sidebar slides in as overlay.
- **Notification poller** — polls every 45 s and surfaces new unread notifications as toast, so @mentions and job pings feel real-time.
- **`EmptyState` component** — friendly shared empty state (gradient icon + copy), applied to My Day.
- **AI Manager Digest** — `GET /api/ai/manager-digest` (admin only). Claude Sonnet 4.5 reads last-7-day aggregate stats (done/overdue/pending approvals/top-loaded person/top client/silent clients/scope flags/@mentions) and writes a 5-bullet Monday briefing with 🔥⚠️🚨✨🎯 markers. Cached in Mongo per ISO week (`manager_digests` collection); Refresh button regenerates. Deterministic fallback if AI errors.

## What's Been Implemented (Feb 2026 — v5 per-user Gmail via Workspace DWD) — LIVE
- **Google Workspace Domain-Wide Delegation** is **live and verified**. One service account (`openspace-gmail-sync@openspace-agency-os-509307.iam.gserviceaccount.com`, key at `/app/backend/gmail_sa.json`, path via `GMAIL_SA_FILE` env) impersonates any `@osagency.in` user — zero per-user OAuth consent.
- **Verified per-user isolation**: Yusuf synced 25 msgs from his inbox (Shikha, Imran, ChatGPT), Rupali synced 25 from hers (Shruti, Ajmal) — **0 messageId overlap**. Full RBAC enforced at API layer; cross-user access returns 404.
- **Every @osagency.in team member** (Yusuf, Rupali, Kalpesh, Aayush, Ved, Kritika + any future hire added via Manage Team) can now click **Sync Gmail** and pull THEIR own inbox. Non-domain accounts are blocked by `can_sync_for`.
- **Testing**: iter10 — 15/15 backend + 8/8 frontend (login as 2 different users, independent sync, isolation, mark-as-read-propagation, clear-samples, parse-brief).
- **Awaiting**: nothing — feature complete.

## What's Been Implemented (Feb 2026 — v5 per-user Gmail via Workspace DWD)
- **Google Workspace Domain-Wide Delegation** replaces the single-user refresh-token Gmail integration. One service account key (stored at `/app/backend/gmail_sa.json`, path via `GMAIL_SA_FILE` env) silently impersonates any `@osagency.in` user — zero per-user OAuth consent.
- **Per-user inbox scoping**: every inbox doc now carries `owner_email`. `GET /api/inbox`, `POST /api/inbox/sync`, `/parse-brief`, `/draft-reply`, `/create-job`, `/{id}/read` and `/clear-samples` all filter by `current_user.email`. Guard switched from `manager_only` → `current_user`. Each team member only ever sees + syncs their own Gmail.
- **Workspace guard**: `can_sync_for(email)` enforces that only `@osagency.in` addresses can hit sync. Non-domain users (e.g. the legacy `osagency6@gmail.com`) are blocked at the API layer.
- **Smart Inbox sidebar link unlocked for all team members** (dropped `managerOnly: true` on nav + route). Inbox unread badge now computed for every role.
- **Startup migration**: force `u_yusuf.email = yusuf@osagency.in`, delete all pre-DWD Gmail docs, backfill `owner_email = yusuf@osagency.in` on seeded mock emails (so Yusuf sees the demo until he syncs his real Gmail).
- **LoginPage** defaults + HINTS updated to `yusuf@osagency.in / manager123`.
- **Awaiting**: user to complete Google Cloud Service Account + Workspace Admin domain-wide delegation setup, then paste the SA JSON — code will light up with zero further changes.

## What's Been Implemented (Feb 2026 — v4 real Gmail sync)
- **Gmail OAuth integration in Smart Inbox** — new `gmail_service.py` (google-auth + google-api-python-client). Uses a pre-generated refresh token (via OAuth Playground) stored in `backend/.env` as `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`. Silent access-token refresh, no runtime OAuth flow needed.
- **New endpoints**: `GET /api/inbox/gmail-status` (configured + last_sync + synced_count), `POST /api/inbox/sync` (pulls last 25 messages, matches sender→client by exact email or domain, upserts idempotently by Gmail messageId), `POST /api/inbox/clear-samples` (removes seeded demo emails once real sync is running). Existing `POST /api/inbox/{id}/read` now also propagates to Gmail for `source=gmail` messages.
- **Inbox UI**: green "Gmail connected · N synced · last sync 2m ago" status pill, blue **Sync Gmail** button with spinner, **Clear samples** button, mail-icon prefix on real Gmail rows, "Unassigned" pill for senders whose email/domain doesn't match a client. Selecting an unassigned email swaps the AI action bar for an amber warning that instructs the manager to add the sender's domain as a client — Create Brief & Draft Reply are hidden until then, preventing 404s.
- **Manager admin email migrated**: `u_yusuf` account email changed from `yusuf@osagency.in` → **`osagency6@gmail.com`** (password unchanged: `manager123`). One-time startup migration keeps existing DBs in sync.
- **Verified**: iter7 15/15 backend + 100% Gmail UI flows (idempotent sync, client matching, unassigned handling, clear-samples, mark-as-read propagation). Live mailbox tested with 11,090 real emails; 25 pulled + rendered successfully.

## What's Been Implemented (Feb 2026 — v3 festivals + proactive ideas)
- **Festivals & important dates** — new `festivals` MongoDB collection + full CRUD `/api/festivals` (managers add/edit/delete; everyone reads). Seeded with 26 major Indian festivals + brand-marketing days spanning Feb 2026 → Feb 2027 (Diwali, Holi, Raksha Bandhan, Ganesh Chaturthi, Navratri, Eid, Independence Day, Republic Day, Christmas, Cinema Day, Women's/Mother's/Father's Day, etc.).
- **Manage Important Dates modal** — right-side drawer on the Content Calendar. Add / edit / delete festivals grouped by month, type-colour coded (Festival / Holiday / Brand day / Other).
- **Calendar overlay** — festival badges under each date-header day in the client-vs-day grid, colour-tinted cell backgrounds on festival days, an "Upcoming · next 60 days" horizontal strip above the grid, and a click-through popover with description. Added ‹ › month navigation.
- **AI proactive ideas when idle** — `POST /api/ai/idle-suggestions`. When a team member has no meaningful open jobs on My Day, replace the flat empty state with a purple/pink gradient "Free head-space · use it well" panel. Claude reads their role skills, Openspace's clients (with voice guides), and the next 60 days of festivals, and returns 4 concrete role-matched ideas (each with brand + festival tie-in + one-line rationale). Each idea has a **"Copy to pitch"** action to send to Yusuf. Deterministic fallback if AI errors.

## What's Been Implemented (Feb 2026 — v4 HR & People Ops)

**Team profiles extended** — birthday, work-anniversary/joining, blood group, emergency contact, in-notice-period flag on every user. `PATCH /api/hr/profile/{user_id}` — self or manager (notice-period toggle is manager-only).

**Leaves module** — full flow with rule enforcement:
- Per-year balances: **PL 7 · CL 7 · SL 7 · Public Holidays 12** (auto once past 3-month probation) + **Comp-Off** grown on grant. `GET /api/hr/leaves/balance`.
- Leave application form (`POST /api/hr/leaves`) requires type, from/to, reason, **lead person** (must be different user), handover notes.
- **Enforced rules** — probation block (403), balance check (400), **3+ day leaves need 20+ days advance notice** (400), lead-person required (400), **sandwich rule** (weekends between leaves count) baked into `hr_service.count_leave_days`.
- Manager approval workflow `POST /api/hr/leaves/{id}/decide` → auto-deducts balance on approval + notifies applicant.
- Team calendar view of approved leaves `GET /api/hr/leaves/team-calendar` (who's out).
- Comp-off manual grant `POST /api/hr/leaves/compoff/grant`.

**Handover document** — `POST /api/hr/handover/{user_id}/generate` when notice-period is toggled ON. Auto-populates active jobs (id, title, current status, priority) + client contacts. Editable fields for credentials, brand-assets, key relationships. `PATCH /api/hr/handover/{id}`.

**HR Hub** page (`/hr`) with 7 tabs:
- **People** — profile cards, upcoming birthdays/anniversaries dashboard (`GET /api/hr/dashboard`), notice-period toggle, handover generate button
- **Culture** — team activities & 1-hour trainings + monthly/quarterly outings with venue, budget, attendees, checklist. AI-suggest activity endpoint (`POST /api/hr/activities/ai-suggest`)
- **Announcements** — team-wide broadcasts, manager posts, everyone reads
- **1:1 & Wellness** — private notes per team member (manager-only), weekly wellness pulse endpoint + team-average trend bars
- **Policies** — CRUD-editable policies (Leave, WFH, Code of Conduct, Working Hours pre-seeded)
- **Reimbursements** — expense claims with approval workflow
- **Salary Vault** — PIN-protected (bcrypt), Yusuf-only, per-employee salary history

**Leaves page** (`/leaves`) — balance cards + team-out widget + application list with in-line approve/reject + application modal with sandwich-days preview + 20-day-notice warning banner.

**Client workload widget** — new `GET /api/clients/{client_id}/workload` returns open count by status, by assignee, total hours, next-5 upcoming due. Rendered inline in the Smart Inbox brief modal (`ClientWorkloadWidget` component) so the team sees existing load before setting a new deadline/priority. Shows "Heavy load" or "Overdue" callouts when relevant.

**Seed additions** — birthdays, joining dates, blood groups on all users · 4 pre-seeded policies · 1 welcome announcement · 2 sample activities · 2 sample outings (monthly + quarterly) with checklists · 2 extra public holidays.

## What's Been Implemented (Feb 2026 — v5 Leads pipeline)

**Full leads/CRM module** — `/leads` page with three views (Table, Kanban board, Funnel), all backed by 22+ endpoints under `/api/leads/*` + inbound webhook `/api/webhooks/leads/inbound`.

Backend collections: `leads`, `lead_touches`, `lead_settings`, `lead_nurture_queue`. Helper module `leads_service.py` for ICP scoring, dedup keys, sequence offsets, staleness detection.

**Data model** — company, contact name/email/phone, source (outbound/inbound/manual), channel (LinkedIn/Apollo/Google Maps/SEO/Referral/Website form/Event/Other), 5 ICP flags (family_run · startup · other_b2b · gap_or_funding · responsive_48h auto-flipped on touch), auto-computed ICP score + tier (qualified when 2 of 3 signals present), 9 statuses (new · contacted · qualified · nurturing · call_scheduled · proposal_sent · won · onboarding · lost), owner (defaults to BD/Kritika), first-touch/last-activity, recycle date, notes, expected deal size, structured lost reason enum, onboarding sub-checklist.

**Rules enforced:**
- Dedup on create (email OR normalized company OR non-generic email-domain) → 409 with matches; `allow_duplicate:true` bypass.
- AI ICP classify — Claude classifies `family_run/startup/other_b2b/gap_or_funding` from company + notes on outbound/inbound creation.
- New → Contacted auto-flip on first logged touch.
- Nurture queue enqueued on creation (4-step outbound over 12 days · 3-step inbound over 2 days). Actual sending offloaded to Make.com via `LEADS_OUTBOUND_WEBHOOK` env.
- `POST /leads/{id}/booking` → status → call_scheduled + owner notification.
- `POST /leads/{id}/status` — enforces lost-requires-reason+recycle-date, capacity-cap warnings (Proposal 8/mo + Won 5/mo, configurable; warns, doesn't block), Won auto-becomes Onboarding.
- Onboarding checklist (4 items). All-4-done → auto-creates the client in `/api/clients` + notifies Yusuf + Kritika + fires outbound webhook.
- `POST /leads/maintenance/run` (idempotent) auto-resurfaces lost leads whose recycle date has arrived AND posts stale-lead alerts (>14 days untouched in contacted/qualified/nurturing).

**Frontend features:**
- Table view with source/status/search filters
- Kanban board (drag-drop across 8 statuses; drop-to-lost opens the reason form)
- Funnel view (bar chart per stage + total value + conversion % + total pipeline stats)
- Add-lead modal with **live dedup preview** as user types (shows matches with "Create anyway" escape hatch)
- Lead detail drawer with 4 tabs: **Overview** (ICP flags editable, notes autosave, status changer with lost/proposal-link forms, schedule-call button), **Activity** (typed touches: call/email/linkedin/meeting/note), **AI intro** (Claude drafts personalised cold email as Kritika, copy-to-clipboard), **Onboarding** (4-item checklist, auto-triggers client handoff when complete)
- Capacity warning banner at page-top when monthly caps reached
- Sidebar entry under Clients section: **Leads** → Clients

**Automation hooks (Make.com):**
- Inbound: `POST /api/webhooks/leads/inbound` with `X-Webhook-Secret` header (env `LEADS_INBOUND_SECRET`). Returns `duplicate_flagged` if match — Make.com can decide.
- Outbound: on any status change / booking / onboarding-complete, fires `POST` to `LEADS_OUTBOUND_WEBHOOK` env with `{event, lead, timestamp}` — Make.com routes to Gmail / Slack / WhatsApp / etc.

## Removed / Deferred
- Invoice section, retainer amounts, monthly revenue — all removed.
- Real Gmail OAuth — pending user credentials
- Real outbound email (Resend) — pending user credentials (approval reminders + client-portal notifications currently log to Mongo)

## Prioritized Backlog
### P1
- Real Gmail OAuth ingestion (currently mocked seeded emails)
- Object-storage-backed uploads for SOP attachments and brand assets
- Send-gap-email actually delivers via Resend/SendGrid (currently simulated toast)
- Auto-post approval + Resend-email client with magic link when job moves to `review` (needs Resend first)
- Extend `EmptyState` to Approvals / Time / Reports / Clients when empty
### P2
- Recurring-job auto-clone every week/month
- Push notifications when a job status changes for assignees
- Client-facing approval portal (magic link)  — already shipped, keep polishing
- Export invoices as PDF  — invoice module removed; skip
- First-run onboarding tooltip tour for new team members
### P3
- Chart-heavy KPI history over 6 months
- Slack integration for standups and deadline pings

## 2026-10-24 — Tab Visibility Manager
- Default: Time Tracker, Lead Generation, Clients, KPI, Leaves, HR & Culture, AI Assistant, Team Vibes hidden for everyone except yusuf@ and bd@osagency.in
- New `/tab-visibility` page (Yusuf only, not while impersonating): per-person, per-tab toggles + All/None
- Hidden tab URLs redirect to /dashboard; empty sidebar sections disappear; View-as reflects member's tabs
- Backend: `GET /api/settings/tabs/me`, `GET/PUT /api/settings/tabs`; Mongo `settings` doc `tab_visibility.overrides`
- Known limit: enforced in UI/routes only; underlying data APIs (e.g. /api/clients) still respond

## 2026-10-24 — Job scoping & real data
- "All Jobs" shows as "Your Jobs" for everyone except yusuf@ and bd@osagency.in (sidebar + page heading)
- Non-full users see only jobs assigned to them; Yusuf and BD view + edit all jobs (`_has_full_job_access`)
- Jobs filter pills now list real users (by user id) instead of demo names
- Deleted 12 demo jobs + 5 TEST_ jobs (and their approvals/timelogs); job/approval/timelog seeding removed; startup `purge_sample_jobs` cleans the same from production on redeploy
- Job IDs now use max existing number + 1 (no clashes after deletions)

## 2026-10-24 — Smart Inbox auto-sync
- Platform cron `.emergent/crons.yml` → `POST /api/cron/gmail-sync` every 15 min (prod minimum; user chose 15 over 10)
- Bearer `WEBHOOK_CRON_SECRET` (backend/.env), idempotent via `cron_runs.run_id`, work runs in background task for every @osagency.in user
- Known: kalpesh@ and aayush@ return Google "Invalid email or User ID" (no Workspace mailbox) — skipped, others sync

## 2026-10-24 — Content Calendar cleanup & 3-year dates
- Removed 6 TEST_topic posts and 2 duplicate "(declared)" holidays
- Added 2027–2029 important dates (festivals, holidays, brand days; 99 total through Dec 2029) via idempotent startup `apply_calendar_updates` (also applies to production on redeploy)
- Cinema Day (India) not repeated for future years (date varies); Eid dates are moon-sighting estimates

## 2026-10-25 — GitHub push fix
- Moved Google service-account key from `backend/gmail_sa.json` into `GMAIL_SA_JSON` env secret; file deleted + gitignored. Gmail sync verified working after the change.

## Credentials
See `/app/memory/test_credentials.md`.

## Next Tasks
- Wire real Gmail OAuth via Google Cloud project (needs Client ID/Secret from Yusuf)
- Wire SendGrid/Resend for outbound gap-question and approval emails
- Extend impersonation-aware analytics on manager Reports
