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

## Credentials
See `/app/memory/test_credentials.md`.

## Next Tasks
- Wire real Gmail OAuth via Google Cloud project (needs Client ID/Secret from Yusuf)
- Wire SendGrid/Resend for outbound gap-question and approval emails
- Extend impersonation-aware analytics on manager Reports
