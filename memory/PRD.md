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
- Full backend: auth, users (**full CRUD + password reset**), clients (**full CRUD**), jobs (CRUD + comments + team filter + file attachments via Emergent object storage), content posts, timelogs, approvals with decisions, KPI list/create/coaching/team-review, SOPs list/create/generate, inbox list/parse-brief/draft-reply/create-job, notifications, reports, AI assistant, job help.
- Full frontend: 15 pages (Dashboard, Inbox, Jobs, Board, Calendar, Approvals, Time, Clients, **Manage Team**, KPI, SOPs, Reports, AI, Vibes, Notifications) + Login + Job Detail modal + Brief modal + client/team edit-delete modals.
- Passing tests: **iteration 1**: 30/30 backend + 100% frontend. **iteration 2**: 32/32 backend + 100% frontend. **iteration 3**: 44/44 backend + 100% frontend.
- **SOP seed expanded to 20 entries** — covers all 5 roles + escalation + scope-creep.

## Removed / Deferred
- **Invoice section removed entirely** (Feb 2026).
- **Monthly revenue + client retainer amounts removed** (Feb 2026): Dashboard now shows Done-this-month + Jobs-per-client; Clients no longer show retainer; TimeTracker shows Hours-per-client instead of Profitability. AI system prompt no longer includes rupee amounts.
- Real Gmail OAuth — pending user credentials
- Real outbound email (Resend) — pending user credentials

## Prioritized Backlog
### P1
- Real Gmail OAuth ingestion (currently mocked seeded emails)
- Object-storage-backed uploads for SOP attachments and brand assets
- Send-gap-email actually delivers via Resend/SendGrid (currently simulated toast)
### P2
- Recurring-job auto-clone every week/month
- Push notifications when a job status changes for assignees
- Client-facing approval portal (magic link)
- Export invoices as PDF
### P3
- Chart-heavy KPI history over 6 months
- Slack integration for standups and deadline pings

## Credentials
See `/app/memory/test_credentials.md`.

## Next Tasks
- Wire real Gmail OAuth via Google Cloud project (needs Client ID/Secret from Yusuf)
- Wire SendGrid/Resend for outbound gap-question and approval emails
- Add ability to attach files to jobs (object storage)
