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
    {"id": "u_yusuf", "email": "yusuf@osagency.in", "name": "Yusuf", "role_key": "manager", "role_label": "Manager", "is_admin": True, "password_hash": _hash("manager123"), "created_at": _now_iso()},
    {"id": "u_arjun", "email": "arjun@osagency.in", "name": "Arjun", "role_key": "writer", "role_label": "Writer", "is_admin": False, "password_hash": _hash("team123"), "created_at": _now_iso()},
    {"id": "u_priya", "email": "priya@osagency.in", "name": "Priya", "role_key": "designer", "role_label": "Designer", "is_admin": False, "password_hash": _hash("team123"), "created_at": _now_iso()},
    {"id": "u_kavya", "email": "kavya@osagency.in", "name": "Kavya", "role_key": "mktg", "role_label": "Digital Marketing", "is_admin": False, "password_hash": _hash("team123"), "created_at": _now_iso()},
    {"id": "u_rohan", "email": "rohan@osagency.in", "name": "Rohan", "role_key": "webdev", "role_label": "Web Developer", "is_admin": False, "password_hash": _hash("team123"), "created_at": _now_iso()},
    {"id": "u_meera", "email": "meera@osagency.in", "name": "Meera", "role_key": "clientsvc", "role_label": "Client Servicing", "is_admin": False, "password_hash": _hash("team123"), "created_at": _now_iso()},
]

CLIENTS = [
    {"id": "galalite", "name": "Galalite Screens", "color": "#4361EE", "short": "GL", "email": "hello@galalite.com", "retainer": 85000, "voice": "cinema tech, premium brand voice"},
    {"id": "lumina", "name": "Lumina Screens", "color": "#10B981", "short": "LM", "email": "team@lumina.com", "retainer": 45000, "voice": "cinema tech, educational voice"},
    {"id": "tkpl", "name": "TKPL", "color": "#F59E0B", "short": "TK", "email": "contact@tkpl.in", "retainer": 55000, "voice": "B2B manufacturing, product-forward"},
    {"id": "intercont", "name": "Intercont+", "color": "#8B5CF6", "short": "IC", "email": "gaurav@intercontplus.com", "retainer": 60000, "voice": "cold chain logistics, Gaurav Sethi's personal voice, always first person"},
    {"id": "safewater", "name": "Safewater Lines", "color": "#06B6D4", "short": "SW", "email": "ops@safewaterlines.com", "retainer": 40000, "voice": "shipping, formal investor-facing tone"},
    {"id": "smartco", "name": "SmartCo Shipping", "color": "#EF4444", "short": "SC", "email": "hello@smartcoshipping.com", "retainer": 35000, "voice": "cargo logistics, professional and warm"},
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

INVOICES = []  # deprecated: invoice section removed from app

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
    if await db.invoices.count_documents({}) == 0:
        pass  # invoices section removed
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
