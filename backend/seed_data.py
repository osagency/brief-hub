"""Seed data for Openspace Agency OS - runs on startup if DB is empty."""
from datetime import datetime, timezone, timedelta
import bcrypt
import uuid


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _days(n: int) -> str:
    return (datetime.now(timezone.utc) + timedelta(days=n)).date().isoformat()


USERS = [
    {"id": "u_yusuf", "email": "yusuf@osagency.in", "name": "Yusuf", "role_key": "manager", "role_label": "Manager", "is_admin": True, "password_hash": _hash("manager123"), "created_at": _now_iso(),
     "birthday": "1988-08-14", "joining_date": "2019-06-01", "blood_group": "O+", "emergency_contact_name": "Family", "emergency_contact_phone": "+91 98200 00000", "in_notice_period": False, "notice_start": None},
    {"id": "u_arjun", "email": "rupali@osagency.in", "name": "Rupali", "role_key": "designer", "role_label": "Designer", "is_admin": False, "password_hash": _hash("team123"), "created_at": _now_iso(),
     "birthday": "1996-03-22", "joining_date": "2023-08-15", "blood_group": "B+", "emergency_contact_name": "", "emergency_contact_phone": "", "in_notice_period": False, "notice_start": None},
    {"id": "u_priya", "email": "kalpesh@osagency.in", "name": "Kalpesh", "role_key": "designer", "role_label": "Designer", "is_admin": False, "password_hash": _hash("team123"), "created_at": _now_iso(),
     "birthday": "1998-11-04", "joining_date": "2022-11-01", "blood_group": "A+", "emergency_contact_name": "", "emergency_contact_phone": "", "in_notice_period": False, "notice_start": None},
    {"id": "u_kavya", "email": "aayush@osagency.in", "name": "Aayush", "role_key": "designer", "role_label": "Designer", "is_admin": False, "password_hash": _hash("team123"), "created_at": _now_iso(),
     "birthday": "1994-06-17", "joining_date": "2024-01-08", "blood_group": "O-", "emergency_contact_name": "", "emergency_contact_phone": "", "in_notice_period": False, "notice_start": None},
    {"id": "u_rohan", "email": "digital@osagency.in", "name": "Ved", "role_key": "mktg", "role_label": "Digital Marketing", "is_admin": False, "password_hash": _hash("team123"), "created_at": _now_iso(),
     "birthday": "1997-02-28", "joining_date": "2023-04-10", "blood_group": "AB+", "emergency_contact_name": "", "emergency_contact_phone": "", "in_notice_period": False, "notice_start": None},
    {"id": "u_meera", "email": "bd@osagency.in", "name": "Kritika", "role_key": "clientsvc", "role_label": "Client Servicing", "is_admin": False, "password_hash": _hash("team123"), "created_at": _now_iso(),
     "birthday": "1999-09-12", "joining_date": "2025-11-20", "blood_group": "A-", "emergency_contact_name": "", "emergency_contact_phone": "", "in_notice_period": False, "notice_start": None},
]

CLIENTS = [
    {"id": "galalite", "name": "Galalite Screens", "color": "#4361EE", "short": "GL", "email": "hello@galalite.com", "voice": "cinema tech, premium brand voice"},
    {"id": "lumina", "name": "Lumina Screens", "color": "#10B981", "short": "LM", "email": "team@lumina.com", "voice": "cinema tech, educational voice"},
    {"id": "tkpl", "name": "TKPL", "color": "#F59E0B", "short": "TK", "email": "contact@tkpl.in", "voice": "B2B manufacturing, product-forward"},
    {"id": "intercont", "name": "Intercont+", "color": "#8B5CF6", "short": "IC", "email": "gaurav@intercontplus.com", "voice": "cold chain logistics, Gaurav Sethi's personal voice, always first person"},
    {"id": "safewater", "name": "Safewater Lines", "color": "#06B6D4", "short": "SW", "email": "ops@safewaterlines.com", "voice": "shipping, formal investor-facing tone"},
    {"id": "smartco", "name": "SmartCo Shipping", "color": "#EF4444", "short": "SC", "email": "hello@smartcoshipping.com", "voice": "cargo logistics, professional and warm"},
]

JOBS = [
    {"id": "OS-001", "title": "Q1 Cinema Tech Blog Series", "client": "galalite", "priority": "high", "status": "active", "due": _days(3), "progress": 65, "team": ["writer", "designer"], "recurring": "none", "desc": "5-part blog series on cinema screen technology evolution and premium projection systems.", "hours": 12, "revisions": 1, "scopeAdded": 0, "comments": [], "assignees": ["u_arjun", "u_priya"]},
    {"id": "OS-002", "title": "Instagram Carousel — LED Wall Launch", "client": "lumina", "priority": "medium", "status": "review", "due": _days(1), "progress": 90, "team": ["designer", "mktg"], "recurring": "none", "desc": "5-slide carousel announcing new LED wall product line for schools.", "hours": 6, "revisions": 2, "scopeAdded": 1, "comments": [], "assignees": ["u_priya", "u_kavya"]},
    {"id": "OS-003", "title": "TKPL Product Catalogue Landing Page", "client": "tkpl", "priority": "high", "status": "active", "due": _days(-2), "progress": 40, "team": ["webdev", "writer"], "recurring": "none", "desc": "Responsive landing page featuring the full manufacturing product catalogue with filters.", "hours": 18, "revisions": 0, "scopeAdded": 0, "comments": [], "assignees": ["u_rohan", "u_arjun"]},
    {"id": "OS-004", "title": "Intercont+ LinkedIn — CEO Post (weekly)", "client": "intercont", "priority": "medium", "status": "active", "due": _days(2), "progress": 30, "team": ["writer"], "recurring": "weekly", "desc": "Weekly first-person LinkedIn post for Gaurav Sethi on cold chain thought leadership.", "hours": 3, "revisions": 0, "scopeAdded": 0, "comments": [], "assignees": ["u_arjun"]},
    {"id": "OS-005", "title": "Safewater Investor Deck Redesign", "client": "safewater", "priority": "high", "status": "todo", "due": _days(7), "progress": 5, "team": ["designer", "writer"], "recurring": "none", "desc": "20-slide investor deck redesign — formal, data-driven.", "hours": 2, "revisions": 0, "scopeAdded": 0, "comments": [], "assignees": ["u_priya", "u_arjun"]},
    {"id": "OS-006", "title": "SmartCo Monthly SEO Report", "client": "smartco", "priority": "low", "status": "done", "due": _days(-5), "progress": 100, "team": ["mktg"], "recurring": "monthly", "desc": "Monthly SEO performance report — traffic, rankings, backlinks.", "hours": 5, "revisions": 0, "scopeAdded": 0, "comments": [], "assignees": ["u_kavya"]},
    {"id": "OS-007", "title": "Galalite Google Ads Campaign — Q1", "client": "galalite", "priority": "high", "status": "active", "due": _days(5), "progress": 55, "team": ["mktg"], "recurring": "none", "desc": "Google Ads setup + creative rotation for cinema chain leads.", "hours": 9, "revisions": 1, "scopeAdded": 2, "comments": [], "assignees": ["u_kavya"]},
    {"id": "OS-008", "title": "Lumina Website Speed Optimisation", "client": "lumina", "priority": "medium", "status": "review", "due": _days(0), "progress": 85, "team": ["webdev"], "recurring": "none", "desc": "Core Web Vitals fixes — target LCP < 2.5s.", "hours": 8, "revisions": 0, "scopeAdded": 0, "comments": [], "assignees": ["u_rohan"]},
    {"id": "OS-009", "title": "TKPL Trade Show Booth Creatives", "client": "tkpl", "priority": "high", "status": "overdue", "due": _days(-3), "progress": 60, "team": ["designer"], "recurring": "none", "desc": "Booth backdrop + 3 pop-up standee designs for upcoming manufacturing expo.", "hours": 10, "revisions": 1, "scopeAdded": 1, "comments": [], "assignees": ["u_priya"]},
    {"id": "OS-010", "title": "Intercont+ Cold Chain Whitepaper", "client": "intercont", "priority": "medium", "status": "todo", "due": _days(14), "progress": 0, "team": ["writer", "designer"], "recurring": "none", "desc": "8-page whitepaper on India's cold chain infrastructure gaps.", "hours": 0, "revisions": 0, "scopeAdded": 0, "comments": [], "assignees": ["u_arjun", "u_priya"]},
    {"id": "OS-011", "title": "Safewater Monthly Newsletter", "client": "safewater", "priority": "low", "status": "done", "due": _days(-1), "progress": 100, "team": ["writer", "mktg"], "recurring": "monthly", "desc": "Investor-facing monthly newsletter.", "hours": 4, "revisions": 0, "scopeAdded": 0, "comments": [], "assignees": ["u_arjun", "u_kavya"]},
    {"id": "OS-012", "title": "SmartCo LinkedIn Ads Refresh", "client": "smartco", "priority": "medium", "status": "active", "due": _days(4), "progress": 45, "team": ["mktg", "designer"], "recurring": "none", "desc": "New LinkedIn ad creatives + audience refresh.", "hours": 6, "revisions": 0, "scopeAdded": 0, "comments": [], "assignees": ["u_kavya", "u_priya"]},
]

KPI = [
    {"id": str(uuid.uuid4()), "memberId": "u_priya", "period": "monthly", "periodLabel": "Jan 2026", "jobsDone": 14, "onTime": 92, "quality": 9.3, "csat": 9.1, "deadline": 9.2, "comm": 8.8, "initiative": 9.0, "collab": 9.4, "good": "Exceptional turnaround on the Galalite carousel work. Clients specifically praised design polish.", "improve": "Push back earlier on scope creep instead of absorbing extra revisions silently.", "actions": ["Flag scope creep same-day", "Share design refs with writer earlier"], "trend": [8.6, 8.9, 9.0, 9.1]},
    {"id": str(uuid.uuid4()), "memberId": "u_arjun", "period": "monthly", "periodLabel": "Jan 2026", "jobsDone": 11, "onTime": 85, "quality": 8.7, "csat": 8.6, "deadline": 8.4, "comm": 8.5, "initiative": 8.6, "collab": 8.9, "good": "Voice matching is spot-on. Intercont+ posts sound genuinely like Gaurav.", "improve": "Reduce revision rounds by validating angle with Meera before drafting.", "actions": ["Pre-draft angle checks with Meera", "Track revision count per client"], "trend": [8.2, 8.4, 8.5, 8.6]},
    {"id": str(uuid.uuid4()), "memberId": "u_kavya", "period": "monthly", "periodLabel": "Jan 2026", "jobsDone": 9, "onTime": 88, "quality": 8.5, "csat": 8.4, "deadline": 8.6, "comm": 8.3, "initiative": 8.9, "collab": 8.5, "good": "Google Ads performance for Galalite up 22% MoM.", "improve": "Faster monthly reporting turnaround — target D+3 not D+7.", "actions": ["Automate report template", "Batch analytics pulls"], "trend": [8.1, 8.3, 8.4, 8.5]},
    {"id": str(uuid.uuid4()), "memberId": "u_meera", "period": "monthly", "periodLabel": "Jan 2026", "jobsDone": 16, "onTime": 90, "quality": 8.4, "csat": 9.0, "deadline": 8.8, "comm": 9.2, "initiative": 8.0, "collab": 9.1, "good": "Clients love the response speed. Intercont+ upgraded scope after 3 great weeks.", "improve": "Loop in team earlier on scope changes — Priya was surprised twice.", "actions": ["Same-day scope pings on Slack"], "trend": [8.1, 8.3, 8.5, 8.6]},
    {"id": str(uuid.uuid4()), "memberId": "u_rohan", "period": "monthly", "periodLabel": "Jan 2026", "jobsDone": 6, "onTime": 78, "quality": 8.0, "csat": 7.6, "deadline": 7.2, "comm": 7.4, "initiative": 7.5, "collab": 7.6, "good": "TKPL site now scores 92 on Lighthouse — best we've had.", "improve": "Communication on blockers. Sat on the Lumina speed issue for 3 days silently.", "actions": ["Daily standup update in #dev", "Escalate blockers within 24h"], "trend": [7.2, 7.4, 7.5, 7.5]},
]

SOPS = [
    {"id": "sop-1", "title": "Client Blog Post Workflow", "role": "writer", "time": "3–4 hrs", "steps": ["Read the brief and client voice guide", "Draft outline (H2s only) and get sign-off from Meera", "Write first draft — target word count from brief", "Self-edit for voice, then run grammar pass", "Send to Meera for internal QA before client"]},
    {"id": "sop-2", "title": "Social Carousel Design", "role": "designer", "time": "2–3 hrs", "steps": ["Confirm platform + slide count", "Pull brand assets from Drive", "Design slide 1 (hook) first, get Meera to approve angle", "Complete all slides, export at 1080x1350", "Package with alt-text doc for Kavya to schedule"]},
    {"id": "sop-3", "title": "Monthly SEO Report", "role": "mktg", "time": "1.5 hrs", "steps": ["Pull GSC + GA4 data for the period", "Populate report template", "Write 3-bullet insights section", "Recommend 2 next-month actions", "Send to Yusuf for review before client"]},
    {"id": "sop-4", "title": "WordPress Speed Fix", "role": "webdev", "time": "2–5 hrs", "steps": ["Run PageSpeed + WebPageTest, note top 3 issues", "Take a staging backup", "Fix images (WebP + lazy load)", "Enable page caching + minify", "Re-test, share before/after in the job"]},
    {"id": "sop-5", "title": "Client Approval Round", "role": "clientsvc", "time": "30 min", "steps": ["Package deliverable + brief recap in one message", "Set clear approval deadline (usually 48h)", "Log the send in the Approvals page", "If revision requested, translate feedback into actionable notes for the team", "Update job status accordingly"]},
    {"id": "sop-6", "title": "LinkedIn Ad Campaign Setup", "role": "mktg", "time": "3 hrs", "steps": ["Confirm objective + KPI with Yusuf", "Build audience (job title + industry + geo)", "Create 3 ad creative variants (with Priya)", "Set daily budget + schedule", "Enable UTM tracking, launch, monitor first 48h daily"]},
    {"id": "sop-7", "title": "Google Ads Search Campaign Setup", "role": "mktg", "time": "3–4 hrs", "steps": ["Keyword research (Ahrefs + Google KP)", "Group keywords into ad groups (max 20 per group)", "Write 3 responsive search ads per ad group", "Set negative keyword list", "Add conversion tracking, launch, review week 1"]},
    {"id": "sop-8", "title": "Instagram Reel Production", "role": "designer", "time": "4 hrs", "steps": ["Storyboard 15–30s hook + payoff", "Shoot / source footage", "Edit in CapCut or Premiere", "Add captions + trending audio", "Export vertical 1080x1920, hand to Kavya for scheduling"]},
    {"id": "sop-9", "title": "Email Newsletter Send", "role": "mktg", "time": "1 hr", "steps": ["Build in email tool (Mailchimp/ConvertKit)", "Verify all merge tags with a test send to team", "Preview on desktop + mobile", "Schedule 10:30 IST Tue/Thu (best open rates)", "Post-send: log opens/CTR in Notion after 48h"]},
    {"id": "sop-10", "title": "New Client Onboarding", "role": "clientsvc", "time": "1 week", "steps": ["Send welcome email + kickoff form within 24h of signing", "Book kickoff call within 5 days", "Collect brand assets, tone-of-voice doc, competitor list", "Set up shared Drive folder + Slack channel", "Publish 30-60-90 day plan and share with client + team"]},
    {"id": "sop-11", "title": "Client Offboarding", "role": "clientsvc", "time": "2 hrs", "steps": ["Send goodbye email with final report + assets ZIP", "Transfer platform admin access (Meta, Google, WordPress)", "Archive Slack channel + Drive folder", "Final internal retro — what worked, what didn't", "Log lessons in the retros doc"]},
    {"id": "sop-12", "title": "Weekly Team Standup", "role": "manager", "time": "20 min", "steps": ["Each person: yesterday / today / blockers (2 min each)", "Yusuf reviews overdue jobs (data-testid on the board)", "Assign owner for every blocker", "Log outcomes in the standup doc", "End on time — no scope discussions here"]},
    {"id": "sop-13", "title": "Monthly Client Reporting Cadence", "role": "clientsvc", "time": "3 hrs", "steps": ["1st: pull all data + notes", "2nd: draft insights + next-month plan", "3rd: internal review with Yusuf", "4th: send to client + book 20-min review call", "5th: log client feedback + update next-month plan"]},
    {"id": "sop-14", "title": "Content Calendar Planning (Monthly)", "role": "mktg", "time": "2 hrs", "steps": ["Review last month's top-performing posts", "Align themes with client campaigns", "Draft 4-week grid per platform", "Get client approval by 25th of prior month", "Move to production once approved"]},
    {"id": "sop-15", "title": "Landing Page Build", "role": "webdev", "time": "6–10 hrs", "steps": ["Wireframe (Figma) with Priya", "Set up WordPress/Framer template", "Implement responsive design (mobile-first)", "Add form + analytics + heatmap script", "QA on mobile/desktop, launch, monitor conversions week 1"]},
    {"id": "sop-16", "title": "Case Study Production", "role": "writer", "time": "4 hrs", "steps": ["Interview client contact (30 min)", "Collect data + screenshots", "Write challenge / approach / results structure", "Design in template (with Priya)", "Publish on site + share as social series (with Kavya)"]},
    {"id": "sop-17", "title": "Press Release Writing", "role": "writer", "time": "2 hrs", "steps": ["Confirm angle + spokesperson quote", "Write in inverted-pyramid AP style", "Add boilerplate + contact info at bottom", "Get client sign-off", "Distribute via PR wire + direct email to relevant journalists"]},
    {"id": "sop-18", "title": "Analytics Setup for New Client", "role": "webdev", "time": "2 hrs", "steps": ["Install GA4 + GTM on the client site", "Configure conversion events (form / call / purchase)", "Set up Search Console + Bing Webmaster", "Grant Kavya read access", "Verify data flowing after 48h"]},
    {"id": "sop-19", "title": "Scope Creep Response", "role": "clientsvc", "time": "15 min", "steps": ["Log the addition in the Job (increment scopeAdded)", "Reply with a warm 'happy to help' + a scoping question", "Estimate hours needed and share with Yusuf before committing", "If accepted, update the job brief and set new deadline", "Track in monthly retro"]},
    {"id": "sop-20", "title": "Emergency Client Escalation", "role": "manager", "time": "immediate", "steps": ["Acknowledge within 30 min (Yusuf or Meera)", "Assemble owner + reviewer within 2 hrs", "Send holding email + realistic next-update time", "Fix the issue, then send a post-mortem email within 24h", "Log in escalations doc + share learnings in next standup"]},
]

CONTENT_POSTS = [
    {"id": "cp-1", "client": "galalite", "platform": "LinkedIn", "date": _days(2), "topic": "Cinema screen tech evolution — part 1", "status": "draft"},
    {"id": "cp-2", "client": "galalite", "platform": "Instagram", "date": _days(5), "topic": "Behind the scenes: premium projection", "status": "planned"},
    {"id": "cp-3", "client": "lumina", "platform": "Instagram", "date": _days(1), "topic": "LED wall launch carousel", "status": "review"},
    {"id": "cp-4", "client": "lumina", "platform": "Blog", "date": _days(8), "topic": "5 reasons schools are switching to LED", "status": "planned"},
    {"id": "cp-5", "client": "tkpl", "platform": "LinkedIn", "date": _days(-1), "topic": "New product line teaser", "status": "published"},
    {"id": "cp-6", "client": "intercont", "platform": "LinkedIn", "date": _days(0), "topic": "Cold chain gap: Tier 2 cities", "status": "approved"},
    {"id": "cp-7", "client": "intercont", "platform": "LinkedIn", "date": _days(7), "topic": "Personal note: 3 lessons from a delayed shipment", "status": "planned"},
    {"id": "cp-8", "client": "safewater", "platform": "Email", "date": _days(3), "topic": "Investor monthly", "status": "draft"},
    {"id": "cp-9", "client": "smartco", "platform": "LinkedIn", "date": _days(4), "topic": "Cargo logistics — case study drop", "status": "planned"},
    {"id": "cp-10", "client": "smartco", "platform": "WhatsApp", "date": _days(6), "topic": "Client broadcast — new route launched", "status": "planned"},
]

INBOX_EMAILS = [
    {"id": "e-1", "from": "gaurav@intercontplus.com", "senderName": "Gaurav Sethi", "clientId": "intercont", "subject": "Need a LinkedIn post for tomorrow", "preview": "Hey Yusuf, wanted a quick post on the cold chain gap I saw...", "body": "Hey Yusuf,\n\nWanted a quick post on the cold chain gap I saw during my Nashik trip last week. Should be a first-person reflection — 3 lessons, punchy, no fluff. Publish tomorrow if possible.\n\nAlso, can you make it about the mid-tier city gap specifically? Would love a strong hook.\n\nCheers,\nGaurav", "time": _days(0), "read": False, "jobCreated": False, "starred": False},
    {"id": "e-2", "from": "hello@galalite.com", "senderName": "Galalite Marketing", "clientId": "galalite", "subject": "New product launch — need collateral", "preview": "Hi team, we're launching the GX-Pro line next month...", "body": "Hi team,\n\nWe're launching the GX-Pro line next month. We'll need:\n- A landing page\n- 3 social posts\n- A 1-pager PDF for our sales team\n\nBudget is standard retainer. Timeline: 3 weeks from today.\n\nCan you scope this and confirm what fits?\n\nThanks,\nRahul (Galalite Marketing)", "time": _days(-1), "read": True, "jobCreated": True, "starred": True},
    {"id": "e-3", "from": "team@lumina.com", "senderName": "Lumina Team", "clientId": "lumina", "subject": "Feedback on the carousel", "preview": "Slide 2 needs a stronger CTA. Slide 4 looks great...", "body": "Hey,\n\nSlide 2 needs a stronger CTA. Slide 4 looks great — leave as is. Also, can we change the background of slide 5 to match our brand blue instead of the neutral?\n\nRest looks good. Ready to schedule once these are fixed.\n\n— Lumina Team", "time": _days(-1), "read": False, "jobCreated": False, "starred": False},
    {"id": "e-4", "from": "contact@tkpl.in", "senderName": "TKPL Sales", "clientId": "tkpl", "subject": "Something", "preview": "Can you help with a thing for the expo? We need it soon.", "body": "Hi,\n\nCan you help with a thing for the expo? We need it soon. Not sure exactly what yet — probably a booth backdrop and some standees. Let me know what you can do.\n\nThanks", "time": _days(-2), "read": False, "jobCreated": False, "starred": False},
    {"id": "e-5", "from": "ops@safewaterlines.com", "senderName": "Safewater Ops", "clientId": "safewater", "subject": "Investor deck — revise cover slide", "preview": "Please revise the cover slide of the investor deck...", "body": "Please revise the cover slide of the investor deck. The tagline needs updating to \"Charting India's next maritime decade\" and the hero image should be swapped for the one we sent via WhatsApp yesterday. Everything else stays as is.\n\nDue Friday.\n\n— Safewater Ops", "time": _days(-3), "read": True, "jobCreated": False, "starred": False},
]

APPROVALS = [
    {"id": "ap-1", "jobId": "OS-002", "client": "lumina", "title": "Instagram Carousel — LED Wall Launch", "status": "pending", "sent": _days(-1), "preview": "5-slide carousel with hook, product features, use cases, testimonial, and CTA.", "feedback": ""},
    {"id": "ap-2", "jobId": "OS-008", "client": "lumina", "title": "Lumina Website Speed Optimisation", "status": "rejected", "sent": _days(-2), "preview": "Core Web Vitals fixes, LCP dropped from 4.1s to 2.3s.", "feedback": "Great numbers but the homepage hero looks slightly delayed on mobile. Please investigate."},
    {"id": "ap-3", "jobId": "OS-006", "client": "smartco", "title": "SmartCo Monthly SEO Report", "status": "approved", "sent": _days(-5), "preview": "Full monthly SEO performance with 3 insights and 2 next-month actions.", "feedback": ""},
    {"id": "ap-4", "jobId": "OS-011", "client": "safewater", "title": "Safewater Monthly Newsletter", "status": "approved", "sent": _days(-3), "preview": "Investor-facing newsletter — formal tone, data-first.", "feedback": ""},
    {"id": "ap-5", "jobId": "OS-009", "client": "tkpl", "title": "TKPL Trade Show Booth Creatives", "status": "pending", "sent": _days(0), "preview": "Booth backdrop + 3 standees, aligned with new product line.", "feedback": ""},
]

TIMELOGS = [
    {"id": "tl-1", "jobId": "OS-001", "date": _days(-1), "hours": 3.5, "person": "u_arjun", "notes": "Draft of part 1 of blog series."},
    {"id": "tl-2", "jobId": "OS-003", "date": _days(-2), "hours": 4.0, "person": "u_rohan", "notes": "Set up staging + hero section."},
    {"id": "tl-3", "jobId": "OS-002", "date": _days(-1), "hours": 2.5, "person": "u_priya", "notes": "Slide 1-3 iteration."},
    {"id": "tl-4", "jobId": "OS-007", "date": _days(-1), "hours": 2.0, "person": "u_kavya", "notes": "Ad copy variants + audience refresh."},
    {"id": "tl-5", "jobId": "OS-004", "date": _days(0), "hours": 1.5, "person": "u_arjun", "notes": "Angle draft for Gaurav's LinkedIn post."},
    {"id": "tl-6", "jobId": "OS-009", "date": _days(-2), "hours": 3.0, "person": "u_priya", "notes": "Backdrop v1 + standee layout options."},
]

NOTIFICATIONS = [
    {"id": "n-1", "title": "TKPL Trade Show — overdue", "subtitle": "Job OS-009 crossed its due date 3 days ago", "time": _days(0), "type": "overdue", "read": False},
    {"id": "n-2", "title": "New email from Gaurav (Intercont+)", "subtitle": "LinkedIn post request for tomorrow", "time": _days(0), "type": "email", "read": False},
    {"id": "n-3", "title": "Lumina requested revision", "subtitle": "Website speed job — homepage hero delay", "time": _days(-1), "type": "revision", "read": False},
    {"id": "n-4", "title": "TKPL asked to expand product page", "subtitle": "OS-003 scope expanded — pricing tables and downloads", "time": _days(-2), "type": "revision", "read": True},
    {"id": "n-5", "title": "SmartCo approved SEO report", "subtitle": "Job OS-006 approved — ready to send", "time": _days(-3), "type": "approval", "read": True},
    {"id": "n-6", "title": "Priya hit a monthly KPI streak", "subtitle": "3 months above 9.0 — nice", "time": _days(-4), "type": "kpi", "read": True},
]


# Seed set of major Indian festivals + brand-marketing days for the next ~12 months.
# Dates are approximate and are meant to be edited from the UI (Manage important dates).
# type: festival | holiday | brand | other
FESTIVALS = [
    {"name": "Valentine's Day",         "date": "2026-02-14", "type": "brand",    "description": "Brand-love themes; couple stories."},
    {"name": "Maha Shivratri",          "date": "2026-02-26", "type": "festival", "description": "Devotional / cultural moment."},
    {"name": "Holi",                    "date": "2026-03-06", "type": "festival", "description": "Festival of colours — high engagement day."},
    {"name": "Women's Day",             "date": "2026-03-08", "type": "brand",    "description": "Women in leadership, client storytelling."},
    {"name": "Ram Navami",              "date": "2026-03-30", "type": "festival", "description": "Regional festival — check client sensitivities."},
    {"name": "Good Friday",             "date": "2026-04-03", "type": "holiday",  "description": "Reflective tone."},
    {"name": "Ambedkar Jayanti",        "date": "2026-04-14", "type": "holiday",  "description": "National holiday."},
    {"name": "Eid-ul-Fitr",             "date": "2026-04-21", "type": "festival", "description": "Ramadan ends — greetings, community."},
    {"name": "Labour Day",              "date": "2026-05-01", "type": "holiday",  "description": "Salute-the-workforce content."},
    {"name": "Mother's Day",            "date": "2026-05-10", "type": "brand",    "description": "Family / gratitude storytelling."},
    {"name": "Father's Day",            "date": "2026-06-21", "type": "brand",    "description": "Family / mentorship storytelling."},
    {"name": "Raksha Bandhan",          "date": "2026-08-09", "type": "festival", "description": "Sibling bond — big engagement day."},
    {"name": "Independence Day",        "date": "2026-08-15", "type": "holiday",  "description": "National pride content."},
    {"name": "Krishna Janmashtami",     "date": "2026-08-26", "type": "festival", "description": "Devotional / cultural moment."},
    {"name": "Cinema Day (India)",      "date": "2026-08-27", "type": "brand",    "description": "Big day for Galalite & Lumina Screens."},
    {"name": "Ganesh Chaturthi",        "date": "2026-09-14", "type": "festival", "description": "Huge Mumbai/Maharashtra moment."},
    {"name": "Navratri begins",         "date": "2026-09-21", "type": "festival", "description": "9 nights — daily content opportunity."},
    {"name": "Gandhi Jayanti",          "date": "2026-10-02", "type": "holiday",  "description": "National holiday."},
    {"name": "Dussehra",                "date": "2026-10-05", "type": "festival", "description": "Victory-of-good storytelling."},
    {"name": "Karva Chauth",            "date": "2026-10-20", "type": "festival", "description": "Family/couple storytelling."},
    {"name": "Diwali",                  "date": "2026-11-08", "type": "festival", "description": "Biggest festival — plan campaigns 3–4 weeks ahead."},
    {"name": "Guru Nanak Jayanti",      "date": "2026-11-24", "type": "festival", "description": "Sikh festival — devotional tone."},
    {"name": "Christmas",               "date": "2026-12-25", "type": "festival", "description": "Warm, festive brand tone."},
    {"name": "New Year's Eve",          "date": "2026-12-31", "type": "brand",    "description": "Year-end recap + resolution content."},
    {"name": "Makar Sankranti / Pongal","date": "2027-01-14", "type": "festival", "description": "Harvest festival."},
    {"name": "Republic Day",            "date": "2027-01-26", "type": "holiday",  "description": "National pride content."},
]

# Additional declared public holidays (used for leave PH balance)
PUBLIC_HOLIDAYS_EXTRA = [
    {"name": "Ambedkar Jayanti (declared)", "date": "2026-04-14", "type": "holiday", "description": "Declared public holiday"},
    {"name": "May Day (declared)",           "date": "2026-05-01", "type": "holiday", "description": "Declared public holiday"},
]

POLICIES = [
    {"id": "pol-leave", "section": "Leave", "title": "Leave Policy", "body": "**Entitlement (post 3-month probation, per calendar year):**\n- Privileged Leave (PL): 7 days\n- Casual Leave (CL): 7 days\n- Sick Leave (SL): 7 days\n- Public Holidays (PH): 12 days\n- Comp-Off (CO): Earned on approval when working weekends/holidays\n\n**Rules:**\n- No leaves during probation.\n- Sandwich rule applies: weekends between leaves count.\n- 3+ day leaves need 20+ days advance notice.\n- Lead-person must be named for all leaves.\n- Manager approval required.", "updated_at": _now_iso(), "updated_by": "u_yusuf"},
    {"id": "pol-wfh",   "section": "Work",  "title": "Work-From-Home Policy",   "body": "- Team is office-first (Mumbai HQ).\n- WFH allowed with 24-hour notice to Yusuf.\n- Client-facing team must be reachable on Slack/Phone during 10am–7pm IST.", "updated_at": _now_iso(), "updated_by": "u_yusuf"},
    {"id": "pol-code",  "section": "Culture","title": "Code of Conduct",        "body": "- Respect clients and colleagues at all times.\n- Zero tolerance for harassment.\n- Client information is confidential.\n- Report concerns directly to Yusuf.", "updated_at": _now_iso(), "updated_by": "u_yusuf"},
    {"id": "pol-hours", "section": "Work",  "title": "Working Hours",           "body": "- 10:00 AM – 7:00 PM, Mon–Fri.\n- 30-min break flexibility.\n- Overtime tracked via Comp-Off.", "updated_at": _now_iso(), "updated_by": "u_yusuf"},
]

ANNOUNCEMENTS = [
    {"id": f"ann-{uuid.uuid4().hex[:8]}", "title": "Welcome to the new HR module!", "body": "You can now apply for leaves, view your balances, and see who's out this week. Managers can also share announcements here.", "posted_at": _now_iso(), "posted_by": "u_yusuf", "expires_at": _days(30)},
]

TEAM_ACTIVITIES = [
    {"id": f"act-{uuid.uuid4().hex[:8]}", "title": "Content-writing masterclass (60 min)", "kind": "training",   "date": _days(3),  "description": "Group session — how to write hooks that stop the scroll", "attendees": ["u_arjun", "u_priya", "u_kavya", "u_rohan", "u_meera"]},
    {"id": f"act-{uuid.uuid4().hex[:8]}", "title": "Design critique jam (60 min)",         "kind": "activity",   "date": _days(10), "description": "Everyone shares one recent piece, group critique",           "attendees": ["u_arjun", "u_priya", "u_kavya", "u_rohan", "u_meera"]},
]

OUTINGS = [
    {"id": f"out-{uuid.uuid4().hex[:8]}", "title": "Monthly team dinner",     "kind": "monthly",   "date": _days(14), "venue": "TBD",             "budget": 8000,  "attendees": ["u_yusuf", "u_arjun", "u_priya", "u_kavya", "u_rohan", "u_meera"], "notes": "Pick a cuisine everyone likes", "checklist": [{"item": "Confirm date with team", "done": False}, {"item": "Book restaurant", "done": False}, {"item": "Send reminder", "done": False}]},
    {"id": f"out-{uuid.uuid4().hex[:8]}", "title": "Quarterly team outing",   "kind": "quarterly", "date": _days(45), "venue": "TBD",             "budget": 25000, "attendees": ["u_yusuf", "u_arjun", "u_priya", "u_kavya", "u_rohan", "u_meera"], "notes": "Off-site day", "checklist": [{"item": "Shortlist 3 venues", "done": False}, {"item": "Confirm attendance", "done": False}, {"item": "Book transport", "done": False}]},
]


async def seed_if_empty(db):
    """Seed all collections if they are empty."""
    if await db.users.count_documents({}) == 0:
        await db.users.insert_many([{**u} for u in USERS])
    if await db.clients.count_documents({}) == 0:
        await db.clients.insert_many([{**c} for c in CLIENTS])
    if await db.jobs.count_documents({}) == 0:
        docs = []
        for j in JOBS:
            d = {**j}
            d["createdAt"] = _now_iso()
            d["updatedAt"] = _now_iso()
            docs.append(d)
        await db.jobs.insert_many(docs)
    if await db.kpi.count_documents({}) == 0:
        await db.kpi.insert_many([{**k} for k in KPI])
    if await db.sops.count_documents({}) == 0:
        await db.sops.insert_many([{**s} for s in SOPS])
    if await db.content_posts.count_documents({}) == 0:
        await db.content_posts.insert_many([{**p} for p in CONTENT_POSTS])
    if await db.inbox.count_documents({}) == 0:
        await db.inbox.insert_many([{**e} for e in INBOX_EMAILS])
    if await db.approvals.count_documents({}) == 0:
        await db.approvals.insert_many([{**a} for a in APPROVALS])
    if await db.timelogs.count_documents({}) == 0:
        await db.timelogs.insert_many([{**t} for t in TIMELOGS])
    if await db.notifications.count_documents({}) == 0:
        await db.notifications.insert_many([{**n} for n in NOTIFICATIONS])
    if await db.festivals.count_documents({}) == 0:
        docs = []
        for f in FESTIVALS + PUBLIC_HOLIDAYS_EXTRA:
            docs.append({"id": f"fest-{uuid.uuid4().hex[:10]}", **f})
        await db.festivals.insert_many(docs)
    if await db.policies.count_documents({}) == 0:
        await db.policies.insert_many([{**p} for p in POLICIES])
    if await db.announcements.count_documents({}) == 0:
        await db.announcements.insert_many([{**a} for a in ANNOUNCEMENTS])
    if await db.team_activities.count_documents({}) == 0:
        await db.team_activities.insert_many([{**a} for a in TEAM_ACTIVITIES])
    if await db.outings.count_documents({}) == 0:
        await db.outings.insert_many([{**o} for o in OUTINGS])
