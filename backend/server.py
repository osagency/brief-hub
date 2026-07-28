"""Openspace Agency OS — FastAPI backend."""
import os
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

import seed_data
import ai_service


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("openspace")

mongo_url = os.environ["MONGO_URL"]
db_name = os.environ["DB_NAME"]
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[db_name]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGO = os.environ["JWT_ALGORITHM"]
JWT_HOURS = int(os.environ["JWT_EXPIRE_HOURS"])

app = FastAPI(title="Openspace Agency OS")
api = APIRouter(prefix="/api")


# ---------- helpers ----------

def _clean(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc = {k: v for k, v in doc.items() if k != "_id"}
    return doc


def _clean_list(docs: list) -> list:
    return [_clean(d) for d in docs]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sign(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=JWT_HOURS)
    return jwt.encode({"sub": user_id, "exp": exp}, JWT_SECRET, algorithm=JWT_ALGO)


async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing auth token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def manager_only(user: dict = Depends(current_user)) -> dict:
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Manager only")
    return user


# ---------- models ----------

class LoginIn(BaseModel):
    email: EmailStr
    password: str


class JobPatch(BaseModel):
    status: Optional[str] = None
    progress: Optional[int] = None
    priority: Optional[str] = None
    due: Optional[str] = None
    scopeAdded: Optional[int] = None


class CommentIn(BaseModel):
    text: str


class JobCreate(BaseModel):
    title: str
    client: str
    priority: str = "medium"
    due: Optional[str] = None
    team: list[str] = []
    assignees: list[str] = []
    desc: str = ""
    recurring: str = "none"
    status: str = "todo"


class InvoiceIn(BaseModel):
    client: str
    amount: int
    desc: str
    due: str


class KPIIn(BaseModel):
    memberId: str
    period: str
    periodLabel: str
    jobsDone: int
    onTime: int
    quality: float
    csat: float
    deadline: float
    comm: float
    initiative: float
    collab: float
    good: str = ""
    improve: str = ""
    actions: list[str] = []


class SOPIn(BaseModel):
    title: str
    role: str
    time: str
    steps: list[str]


class ContentPostIn(BaseModel):
    client: str
    platform: str
    date: str
    topic: str
    status: str = "planned"


class TimeLogIn(BaseModel):
    jobId: str
    date: str
    hours: float
    person: str
    notes: str = ""


class ApprovalDecision(BaseModel):
    action: str  # approve | revise | reopen
    feedback: Optional[str] = ""


class BriefParseIn(BaseModel):
    emailId: str


class ReplyDraftIn(BaseModel):
    emailId: str


class AssistantIn(BaseModel):
    prompt: str
    sessionId: Optional[str] = "assistant"


class JobHelpIn(BaseModel):
    jobId: str
    kind: str  # email | next | standup


class CreateJobFromBriefIn(BaseModel):
    emailId: str
    brief: dict  # briefSummary
    delegation: dict  # internalDelegation
    status: str = "todo"  # todo | onhold


class CoachingIn(BaseModel):
    kpiId: str


class ReportIn(BaseModel):
    period: str  # weekly | monthly | quarterly


class SOPGenIn(BaseModel):
    topic: str


# ---------- auth ----------

@api.post("/auth/login")
async def login(data: LoginIn):
    user = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if not user or not bcrypt.checkpw(data.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = _sign(user["id"])
    user.pop("password_hash", None)
    return {"token": token, "user": user}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return user


# ---------- lookups ----------

@api.get("/users")
async def list_users(_: dict = Depends(current_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return users


@api.get("/clients")
async def list_clients(_: dict = Depends(current_user)):
    return _clean_list(await db.clients.find({}).to_list(100))


# ---------- jobs ----------

def _apply_role_filter(query: dict, user: dict) -> dict:
    if user.get("is_admin"):
        return query
    query["assignees"] = user["id"]
    return query


@api.get("/jobs")
async def list_jobs(user: dict = Depends(current_user), assignee: Optional[str] = None):
    q: dict = {}
    q = _apply_role_filter(q, user)
    if assignee and user.get("is_admin"):
        if assignee == "yusuf":
            q["assignees"] = "u_yusuf"
        else:
            q["assignees"] = f"u_{assignee}"
    docs = await db.jobs.find(q).sort("createdAt", -1).to_list(500)
    return _clean_list(docs)


@api.get("/jobs/{job_id}")
async def get_job(job_id: str, user: dict = Depends(current_user)):
    q = _apply_role_filter({"id": job_id}, user)
    doc = await db.jobs.find_one(q)
    if not doc:
        raise HTTPException(status_code=404, detail="Job not found")
    return _clean(doc)


@api.patch("/jobs/{job_id}")
async def patch_job(job_id: str, patch: JobPatch, user: dict = Depends(current_user)):
    updates = {k: v for k, v in patch.model_dump().items() if v is not None}
    if not updates:
        return {"ok": True}
    updates["updatedAt"] = _now_iso()
    q = _apply_role_filter({"id": job_id}, user)
    result = await db.jobs.update_one(q, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    doc = await db.jobs.find_one({"id": job_id})
    return _clean(doc)


@api.post("/jobs")
async def create_job(data: JobCreate, _: dict = Depends(manager_only)):
    count = await db.jobs.count_documents({})
    new_id = f"OS-{count+1:03d}"
    doc = {
        "id": new_id,
        "title": data.title,
        "client": data.client,
        "priority": data.priority,
        "status": data.status,
        "due": data.due or (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat(),
        "progress": 0,
        "team": data.team,
        "assignees": data.assignees,
        "recurring": data.recurring,
        "desc": data.desc,
        "hours": 0,
        "revisions": 0,
        "scopeAdded": 0,
        "comments": [],
        "createdAt": _now_iso(),
        "updatedAt": _now_iso(),
    }
    await db.jobs.insert_one(doc)
    return _clean(doc)


@api.post("/jobs/{job_id}/comments")
async def add_comment(job_id: str, body: CommentIn, user: dict = Depends(current_user)):
    q = _apply_role_filter({"id": job_id}, user)
    comment = {"id": f"c-{int(datetime.now().timestamp()*1000)}", "author": user["name"], "authorId": user["id"], "text": body.text, "at": _now_iso()}
    result = await db.jobs.update_one(q, {"$push": {"comments": comment}, "$set": {"updatedAt": _now_iso()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    return comment


# ---------- invoices ----------

@api.get("/invoices")
async def list_invoices(_: dict = Depends(manager_only)):
    return _clean_list(await db.invoices.find({}).sort("issued", -1).to_list(200))


@api.post("/invoices")
async def create_invoice(data: InvoiceIn, _: dict = Depends(manager_only)):
    count = await db.invoices.count_documents({})
    year = datetime.now().year
    new_id = f"INV-{year}-{count+1:03d}"
    doc = {"id": new_id, **data.model_dump(), "issued": datetime.now(timezone.utc).date().isoformat(), "status": "unpaid"}
    await db.invoices.insert_one(doc)
    return _clean(doc)


@api.post("/invoices/{invoice_id}/paid")
async def mark_paid(invoice_id: str, _: dict = Depends(manager_only)):
    await db.invoices.update_one({"id": invoice_id}, {"$set": {"status": "paid"}})
    doc = await db.invoices.find_one({"id": invoice_id})
    return _clean(doc)


# ---------- kpi ----------

@api.get("/kpi")
async def list_kpi(period: Optional[str] = None, _: dict = Depends(current_user)):
    q = {"period": period} if period else {}
    docs = await db.kpi.find(q).to_list(500)
    return _clean_list(docs)


@api.post("/kpi")
async def create_kpi(data: KPIIn, _: dict = Depends(manager_only)):
    import uuid
    doc = {"id": str(uuid.uuid4()), **data.model_dump(), "trend": [data.quality]}
    # replace existing entry for same member+period
    await db.kpi.delete_many({"memberId": data.memberId, "period": data.period, "periodLabel": data.periodLabel})
    await db.kpi.insert_one(doc)
    return _clean(doc)


@api.post("/kpi/coaching")
async def kpi_coaching(body: CoachingIn, _: dict = Depends(manager_only)):
    entry = await db.kpi.find_one({"id": body.kpiId}, {"_id": 0})
    if not entry:
        raise HTTPException(status_code=404, detail="KPI entry not found")
    member = await db.users.find_one({"id": entry["memberId"]}, {"_id": 0})
    advice = await ai_service.coaching_advice(entry, member["name"], member["role_label"])
    return {"advice": advice}


@api.post("/kpi/team-review")
async def kpi_team_review(_: dict = Depends(manager_only)):
    entries = await db.kpi.find({"period": "monthly"}, {"_id": 0}).to_list(50)
    users = await db.users.find({}, {"_id": 0}).to_list(50)
    members = {u["id"]: u for u in users}
    review = await ai_service.team_review(entries, members)
    return {"review": review}


# ---------- sops ----------

@api.get("/sops")
async def list_sops(_: dict = Depends(current_user)):
    return _clean_list(await db.sops.find({}).to_list(200))


@api.post("/sops")
async def create_sop(data: SOPIn, _: dict = Depends(manager_only)):
    import uuid
    doc = {"id": f"sop-{str(uuid.uuid4())[:8]}", **data.model_dump()}
    await db.sops.insert_one(doc)
    return _clean(doc)


@api.post("/sops/generate")
async def generate_sop(body: SOPGenIn, _: dict = Depends(manager_only)):
    import uuid
    data = await ai_service.sop_generate(body.topic)
    doc = {"id": f"sop-{str(uuid.uuid4())[:8]}", "title": data.get("title", body.topic), "role": data.get("role", "manager"), "time": data.get("time", "1 hr"), "steps": data.get("steps", [])}
    await db.sops.insert_one(doc)
    return _clean(doc)


# ---------- content calendar ----------

@api.get("/content-posts")
async def list_posts(_: dict = Depends(current_user)):
    return _clean_list(await db.content_posts.find({}).to_list(500))


@api.post("/content-posts")
async def create_post(data: ContentPostIn, _: dict = Depends(current_user)):
    import uuid
    doc = {"id": f"cp-{str(uuid.uuid4())[:8]}", **data.model_dump()}
    await db.content_posts.insert_one(doc)
    return _clean(doc)


# ---------- time ----------

@api.get("/timelogs")
async def list_timelogs(_: dict = Depends(current_user)):
    return _clean_list(await db.timelogs.find({}).sort("date", -1).to_list(500))


@api.post("/timelogs")
async def create_timelog(data: TimeLogIn, user: dict = Depends(current_user)):
    import uuid
    doc = {"id": f"tl-{str(uuid.uuid4())[:8]}", **data.model_dump()}
    await db.timelogs.insert_one(doc)
    # increment job hours
    await db.jobs.update_one({"id": data.jobId}, {"$inc": {"hours": data.hours}})
    return _clean(doc)


# ---------- approvals ----------

@api.get("/approvals")
async def list_approvals(_: dict = Depends(current_user)):
    return _clean_list(await db.approvals.find({}).sort("sent", -1).to_list(200))


@api.post("/approvals/{approval_id}/decide")
async def decide_approval(approval_id: str, body: ApprovalDecision, _: dict = Depends(manager_only)):
    if body.action == "approve":
        new_status = "approved"
    elif body.action == "revise":
        new_status = "rejected"
    else:
        new_status = "pending"
    await db.approvals.update_one({"id": approval_id}, {"$set": {"status": new_status, "feedback": body.feedback or ""}})
    doc = await db.approvals.find_one({"id": approval_id})
    return _clean(doc)


# ---------- inbox ----------

@api.get("/inbox")
async def list_inbox(_: dict = Depends(manager_only)):
    return _clean_list(await db.inbox.find({}).sort("time", -1).to_list(200))


@api.post("/inbox/{email_id}/read")
async def mark_read(email_id: str, _: dict = Depends(manager_only)):
    await db.inbox.update_one({"id": email_id}, {"$set": {"read": True}})
    return {"ok": True}


@api.post("/inbox/parse-brief")
async def parse_brief(body: BriefParseIn, _: dict = Depends(manager_only)):
    email = await db.inbox.find_one({"id": body.emailId}, {"_id": 0})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    client = await db.clients.find_one({"id": email["clientId"]}, {"_id": 0})
    # workload
    users = await db.users.find({}, {"_id": 0}).to_list(50)
    workload = {}
    for u in users:
        active_count = await db.jobs.count_documents({"assignees": u["id"], "status": {"$in": ["active", "todo", "review", "overdue"]}})
        workload[u["role_key"]] = active_count
    result = await ai_service.parse_brief(email["body"], email["clientId"], client["name"], client["email"], workload)
    return result


@api.post("/inbox/draft-reply")
async def draft_reply_api(body: ReplyDraftIn, _: dict = Depends(manager_only)):
    email = await db.inbox.find_one({"id": body.emailId}, {"_id": 0})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    client = await db.clients.find_one({"id": email["clientId"]}, {"_id": 0})
    reply = await ai_service.draft_reply(email["body"], client["name"], client.get("voice", ""))
    return {"reply": reply}


@api.post("/inbox/create-job")
async def create_job_from_brief(body: CreateJobFromBriefIn, _: dict = Depends(manager_only)):
    brief = body.brief
    delegation = body.delegation
    count = await db.jobs.count_documents({})
    new_id = f"OS-{count+1:03d}"

    # map assignee roles → user ids
    role_to_uid = {
        "writer": "u_arjun", "designer": "u_priya", "mktg": "u_kavya",
        "webdev": "u_rohan", "clientsvc": "u_meera", "manager": "u_yusuf",
    }
    team_roles = list({s.get("assignee") for s in delegation.get("suggestedWorkflow", []) if s.get("assignee")})
    if not team_roles and delegation.get("primaryOwner"):
        team_roles = [delegation["primaryOwner"]]
    assignees = [role_to_uid.get(r) for r in team_roles if role_to_uid.get(r)]

    doc = {
        "id": new_id,
        "title": brief.get("jobTitle", "Untitled"),
        "client": brief.get("client"),
        "priority": brief.get("priority", "medium"),
        "status": body.status,
        "due": brief.get("deadline") or (datetime.now(timezone.utc) + timedelta(days=7)).date().isoformat(),
        "progress": 0,
        "team": team_roles,
        "assignees": assignees,
        "recurring": "none",
        "desc": brief.get("brief", ""),
        "hours": 0,
        "revisions": 0,
        "scopeAdded": 0,
        "comments": [],
        "createdAt": _now_iso(),
        "updatedAt": _now_iso(),
        "sourceEmailId": body.emailId,
        "aiWorkflow": delegation.get("suggestedWorkflow", []),
    }
    await db.jobs.insert_one(doc)
    await db.inbox.update_one({"id": body.emailId}, {"$set": {"jobCreated": True, "linkedJobId": new_id, "read": True}})
    return _clean(doc)


# ---------- notifications ----------

@api.get("/notifications")
async def list_notifications(_: dict = Depends(current_user)):
    return _clean_list(await db.notifications.find({}).sort("time", -1).to_list(200))


@api.post("/notifications/mark-all-read")
async def mark_all_notif_read(_: dict = Depends(current_user)):
    await db.notifications.update_many({}, {"$set": {"read": True}})
    return {"ok": True}


# ---------- reports ----------

@api.post("/reports/insights")
async def report_insights(body: ReportIn, _: dict = Depends(manager_only)):
    jobs = await db.jobs.find({}, {"_id": 0}).to_list(500)
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(500)
    stats = {
        "jobsDone": sum(1 for j in jobs if j["status"] == "done"),
        "overdue": sum(1 for j in jobs if j["status"] == "overdue"),
        "collected": sum(i["amount"] for i in invoices if i["status"] == "paid"),
        "pending": sum(i["amount"] for i in invoices if i["status"] != "paid"),
        "topClient": max((i["client"] for i in invoices), default="—"),
        "utilisation": f"{sum(j['hours'] for j in jobs)} hrs logged",
    }
    insights = await ai_service.report_insights(body.period, stats)
    return {"insights": insights, "stats": stats}


# ---------- ai assistant ----------

@api.post("/ai/assistant")
async def ai_assistant(body: AssistantIn, _: dict = Depends(current_user)):
    reply = await ai_service.assistant(body.prompt, body.sessionId or "assistant")
    return {"reply": reply}


@api.post("/ai/job-help")
async def ai_job_help(body: JobHelpIn, user: dict = Depends(current_user)):
    q = _apply_role_filter({"id": body.jobId}, user)
    job = await db.jobs.find_one(q, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    reply = await ai_service.job_help(body.kind, job)
    return {"reply": reply}


# ---------- health ----------

@api.get("/")
async def root():
    return {"service": "openspace-agency-os", "status": "ok"}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await seed_data.seed_if_empty(db)
    logger.info("Seed check complete.")


@app.on_event("shutdown")
async def shutdown():
    mongo_client.close()
