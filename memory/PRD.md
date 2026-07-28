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
- Full backend: auth, users (full CRUD + password reset), clients (full CRUD), jobs (CRUD + comments + team filter + file attachments via Emergent object storage), content posts, timelogs, **approvals with per-card comments + reminders + revision tracking**, KPI + coaching + team-review, SOPs, inbox brief-parse/draft-reply/create-job, notifications, reports, **AI assistant + job-help + Prompt Studio + Job Templates**.
- Full frontend: Dashboard, Inbox, Jobs, **Board (drag-and-drop)**, Calendar, **Approvals (sharper: 3-stat, filters, comments, reminders)**, Time, Clients, Manage Team, KPI, SOPs, Reports, AI, **Prompt Studio (Global/Rules/Voice/Templates)**, Vibes (**per-member brand-split pie**), Notifications. **Team members land on `/dashboard = My Day`** — hero greeting + AI standup + overdue/today/next-up sections.
- Every AI call now uses a **dynamic system prompt** stored in Mongo — change AI Rules in the UI and every future call (brief parser, reply, coaching, chat, reports, SOP-gen, job help) instantly uses them.
- **Client-tailored** brief AND reply drafts — Claude receives client voice + last 5 jobs + last 3 emails on each call.
- Passing tests: iter1 30/30, iter2 32/32, iter3 44/44, **iter4 58/58** — all backend + frontend green.

## Removed / Deferred
- Invoice section, retainer amounts, monthly revenue — all removed.
- Real Gmail OAuth — pending user credentials
- Real outbound email (Resend) — pending user credentials (reminders currently log to Mongo, no real email)

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
