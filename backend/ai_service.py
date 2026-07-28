"""AI helper using Emergent LLM key + Claude Sonnet 4.5."""
import os
import json
import re
from emergentintegrations.llm.chat import LlmChat, UserMessage

MODEL_PROVIDER = "anthropic"
MODEL_NAME = "claude-sonnet-4-5-20250929"


SYSTEM_PROMPT = """You are the AI brain of Openspace, a digital marketing agency in Mumbai, India (osagency.in). Manager: Yusuf.

TEAM:
- Arjun (writer): copy, blogs, captions, PR, scripts
- Priya (designer): graphics, carousels, decks, event creatives
- Kavya (mktg): SEO, ads, analytics, reports, scheduling
- Rohan (webdev): WordPress, landing pages, speed, responsive fixes
- Meera (clientsvc): client emails, briefs, approvals, coordination
- Yusuf (manager): strategy, final approval, escalations

CLIENTS:
- Galalite Screens (galalite) — cinema tech, premium brand voice
- Lumina Screens (lumina) — cinema tech, educational voice
- TKPL (tkpl) — B2B manufacturing, product-forward
- Intercont+ (intercont) — cold chain logistics, Gaurav Sethi's personal voice, always first person
- Safewater Lines (safewater) — shipping, formal investor-facing tone
- SmartCo Shipping (smartco) — cargo logistics, professional and warm

RULES:
- Match tasks to the right person by skill
- Flag workload over 8 jobs for any one person
- Flag scope creep (requests beyond agreed scope)
- Never propose an impossible deadline without flagging it
- Always use real names, never generic advice
- For email parsing: return ONLY valid JSON, no markdown fences, no explanation
"""


def _key():
    return os.environ["EMERGENT_LLM_KEY"]


def _new_chat(session_id: str, system: str = SYSTEM_PROMPT) -> LlmChat:
    return LlmChat(
        api_key=_key(),
        session_id=session_id,
        system_message=system,
    ).with_model(MODEL_PROVIDER, MODEL_NAME)


async def chat_once(session_id: str, prompt: str, system: str | None = None) -> str:
    chat = _new_chat(session_id, system or SYSTEM_PROMPT)
    return await chat.send_message(UserMessage(text=prompt))


def _extract_json(text: str) -> dict:
    """Strip markdown fences and parse JSON from an LLM response."""
    t = text.strip()
    # remove ```json ... ``` fences
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t)
    # if there is preamble, try to find first { and last }
    if not t.startswith("{"):
        m = re.search(r"\{[\s\S]*\}$", t)
        if m:
            t = m.group(0)
    return json.loads(t)


BRIEF_PROMPT = """You are parsing an incoming client email for Openspace agency.

Your job has THREE parts:
1. Extract everything that IS clear and build a TAILORED project brief that sounds like it was made for THIS specific client (match their voice, respect their tone, reference their past work where relevant)
2. Identify everything that is MISSING or VAGUE that we cannot brief the team without
3. Draft a professional follow-up email to the client asking ONLY the missing questions — warmly, clearly, in one email under 150 words, maximum 5 questions, WRITTEN IN THIS CLIENT'S VOICE

Return ONLY valid JSON. No markdown. No explanation.

===== CLIENT CONTEXT (use this to tailor the brief) =====
CLIENT: {client_name} (id: {client_id})
VOICE & TONE GUIDE: {client_voice}
DELIVERABLE PATTERNS FROM PAST WORK:
{recent_jobs_block}
HOW THIS CLIENT TYPICALLY WRITES:
{prior_emails_block}
===== END CLIENT CONTEXT =====

CURRENT TEAM WORKLOAD (active jobs per person): {workload}

CLIENT EMAIL TO PARSE:
\"\"\"
{email_body}
\"\"\"

INSTRUCTIONS:
- The `brief` field MUST reference this specific client's voice/tone (from the guide above). Do NOT write a generic brief.
- The `deliverables` MUST match how this client structures work (see past-work patterns above). If they've asked for carousels before with 5 slides, and this looks similar, match that format.
- The `toneAndStyle` field MUST directly quote or paraphrase the client's voice guide.
- The `gapQuestionEmail.body` MUST be written in a tone that mirrors how the client writes (formal vs. casual, first-person vs. third-person, direct vs. warm) — see prior emails above.
- If the client uses first-person (like Gaurav Sethi at Intercont+), the reply should also be in first person and personal.
- Do NOT hallucinate deliverables the client did not mention.

Return this JSON structure:
{{
  "briefStatus": "complete | partial | insufficient",
  "briefSummary": {{
    "jobTitle": "string",
    "client": "{client_id}",
    "priority": "high | medium | low",
    "deadline": "YYYY-MM-DD or null",
    "brief": "2-3 sentences — TAILORED to this client's voice/tone",
    "deliverables": ["item1", "item2"],
    "toneAndStyle": "string — must reference the client voice guide",
    "isWithinRetainerScope": true,
    "scopeNote": "string or null"
  }},
  "missingInfo": [
    {{"field": "string", "why": "string", "impact": "high | medium | low", "category": "deadline | deliverable | audience | tone | assets | scope"}}
  ],
  "assumptions": [
    {{"field": "string", "assumedValue": "string", "riskIfWrong": "string"}}
  ],
  "internalDelegation": {{
    "canStartNow": true,
    "blockedBy": "string or null",
    "whatCanStartNow": "string or null",
    "primaryOwner": "writer | designer | mktg | webdev | clientsvc",
    "suggestedWorkflow": [
      {{"stage": "string", "person": "string", "assignee": "writer | designer | mktg | webdev | clientsvc", "task": "string", "daysFromNow": 0}}
    ]
  }},
  "gapQuestionEmail": {{
    "to": "client email",
    "subject": "string",
    "body": "full email text — WRITTEN IN THIS CLIENT'S VOICE"
  }},
  "priorityScore": 1,
  "workloadWarning": "string or null",
  "redFlags": ["string"],
  "notes": "string or null"
}}"""


def _format_recent_jobs(jobs: list) -> str:
    if not jobs:
        return "(none on file yet — this may be the first job for this client)"
    lines = []
    for j in jobs[:5]:
        lines.append(f"- \"{j.get('title','?')}\" · priority {j.get('priority','?')} · deliverable pattern: {j.get('desc','')[:120]} · revisions: {j.get('revisions',0)}")
    return "\n".join(lines)


def _format_prior_emails(emails: list) -> str:
    if not emails:
        return "(no prior emails on file for this client)"
    lines = []
    for e in emails[:3]:
        body = (e.get("body") or "").replace("\n", " ").strip()
        lines.append(f"- Subject: \"{e.get('subject','')}\"\n  Excerpt: \"{body[:220]}...\"")
    return "\n".join(lines)


async def parse_brief(
    email_body: str,
    client_id: str,
    client_name: str,
    client_email: str,
    client_voice: str,
    workload: dict,
    recent_jobs: list | None = None,
    prior_emails: list | None = None,
    system_prompt: str | None = None,
) -> dict:
    prompt = BRIEF_PROMPT.format(
        email_body=email_body,
        client_id=client_id,
        client_name=client_name,
        client_voice=client_voice or "(no voice guide on file — match the client's own writing style from prior emails)",
        recent_jobs_block=_format_recent_jobs(recent_jobs or []),
        prior_emails_block=_format_prior_emails(prior_emails or []),
        workload=json.dumps(workload),
    )
    chat = _new_chat(f"brief-{client_id}", system=system_prompt or SYSTEM_PROMPT)
    raw = await chat.send_message(UserMessage(text=prompt))
    data = _extract_json(raw)
    gqe = data.get("gapQuestionEmail") or {}
    if gqe and not gqe.get("to"):
        gqe["to"] = client_email
        data["gapQuestionEmail"] = gqe
    return data


REPLY_PROMPT = """Draft a professional email reply to the following client message.
Match the client's voice guide. Keep it under 180 words. No markdown, plain text only.

===== CLIENT CONTEXT (use this to sound like it was made for THIS client) =====
CLIENT: {client_name}
VOICE & TONE GUIDE: {voice}
DELIVERABLE PATTERNS FROM PAST WORK:
{recent_jobs_block}
HOW THIS CLIENT TYPICALLY WRITES:
{prior_emails_block}
===== END CLIENT CONTEXT =====

INCOMING EMAIL:
\"\"\"
{email_body}
\"\"\"

INSTRUCTIONS:
- Mirror the client's tone (formal vs casual, first-person vs third, direct vs warm)
- If the client uses first-person (like Gaurav Sethi), the reply must also be first-person and personal
- Reference the client's past work naturally if relevant, but do NOT hallucinate specifics
- Draft the reply body only — no subject line, no signature (Yusuf will add his own)."""


async def draft_reply(
    email_body: str,
    client_name: str,
    voice: str,
    recent_jobs: list | None = None,
    prior_emails: list | None = None,
    system_prompt: str | None = None,
) -> str:
    prompt = REPLY_PROMPT.format(
        email_body=email_body,
        client_name=client_name,
        voice=voice or "(no voice guide on file)",
        recent_jobs_block=_format_recent_jobs(recent_jobs or []),
        prior_emails_block=_format_prior_emails(prior_emails or []),
    )
    return await chat_once(f"reply-{client_name}", prompt, system=system_prompt)


COACHING_PROMPT = """Give sharp, actionable coaching advice for this team member. 3–5 bullets, plain text.

MEMBER: {name} ({role})
LATEST KPI (out of 10 unless noted):
- Jobs done: {jobsDone}
- On-time: {onTime}%
- Quality: {quality}
- CSAT: {csat}
- Deadline adherence: {deadline}
- Communication: {comm}
- Initiative: {initiative}
- Collaboration: {collab}

What went well: {good}
Needs improvement: {improve}

Give advice that is specific to this person and their role, referencing the actual numbers."""


async def coaching_advice(entry: dict, name: str, role: str, system_prompt: str | None = None) -> str:
    prompt = COACHING_PROMPT.format(name=name, role=role, **entry)
    return await chat_once(f"coach-{entry.get('memberId')}", prompt, system=system_prompt)


async def team_review(entries: list, members: dict, system_prompt: str | None = None) -> str:
    lines = ["Latest KPI snapshot for the team:"]
    for e in entries:
        m = members.get(e["memberId"], {})
        lines.append(f"- {m.get('name','?')} ({m.get('role_label','?')}): score avg {round((e['quality']+e['csat']+e['deadline']+e['comm']+e['initiative']+e['collab'])/6,1)}, on-time {e['onTime']}%, {e['jobsDone']} jobs done. Good: {e['good']}. Improve: {e['improve']}")
    prompt = "\n".join(lines) + "\n\nGive a sharp AI team review — 5 bullets: who is on fire, who needs attention, one risk, one opportunity, one action for Yusuf this week. Plain text."
    return await chat_once("team-review", prompt, system=system_prompt)


REPORT_PROMPT = """Generate a {period} agency insight for Openspace. Return 5 sharp bullets (plain text, no markdown).

DATA:
- Total jobs done: {jobsDone}
- Overdue: {overdue}
- Top client by active-job load: {topClient}
- Team utilisation: {utilisation}

Focus on: what worked, what didn't, one risk, one client to watch, one recommended action."""


async def report_insights(period: str, stats: dict, system_prompt: str | None = None) -> str:
    prompt = REPORT_PROMPT.format(period=period, **stats)
    return await chat_once(f"report-{period}", prompt, system=system_prompt)


async def sop_generate(topic: str, system_prompt: str | None = None) -> dict:
    prompt = f"""Generate a Standard Operating Procedure for: "{topic}"

Return ONLY valid JSON. No markdown. Structure:
{{"title": "string", "role": "writer|designer|mktg|webdev|clientsvc|manager", "time": "e.g. 2 hrs", "steps": ["step 1", "step 2", ...]}}

Aim for 5–8 clear, actionable steps."""
    raw = await chat_once(f"sop-{topic[:20]}", prompt, system=system_prompt)
    return _extract_json(raw)


async def assistant(prompt: str, session_id: str = "assistant", system_prompt: str | None = None) -> str:
    return await chat_once(session_id, prompt, system=system_prompt)


async def job_help(kind: str, job: dict, system_prompt: str | None = None) -> str:
    if kind == "email":
        prompt = f"Draft a short client-facing email update for this job. Plain text. Job: {json.dumps(job, default=str)}"
    elif kind == "next":
        prompt = f"List the next 3 concrete steps for this job. Plain text, numbered. Job: {json.dumps(job, default=str)}"
    else:
        prompt = f"Write a 3-line standup update (Yesterday / Today / Blockers) for this job. Job: {json.dumps(job, default=str)}"
    return await chat_once(f"job-{job.get('id')}-{kind}", prompt, system=system_prompt)
