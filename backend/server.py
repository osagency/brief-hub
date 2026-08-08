"""Openspace Agency OS — FastAPI backend."""
import os
import re
import uuid
import logging
from datetime import datetime, timezone, timedelta, date
from pathlib import Path
from typing import Optional, List, Dict, Any

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File, Query
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

import seed_data
import ai_service
import storage_service
import hr_service
import leads_service


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


async def current_user(
    authorization: Optional[str] = Header(None),
    x_view_as: Optional[str] = Header(None),
) -> dict:
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
    # Impersonation — only admins may impersonate; result acts as the target user
    if x_view_as and user.get("is_admin") and x_view_as != user["id"]:
        target = await db.users.find_one({"id": x_view_as}, {"_id": 0, "password_hash": 0})
        if target:
            target["_impersonated_by"] = user["id"]
            return target
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
    title: str
    client: str
    priority: str = "medium"
    due: Optional[str] = None
    team: list[str] = []
    assignees: list[str] = []
    desc: str = ""
    recurring: str = "none"
    status: str = "todo"


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


class ClientIn(BaseModel):
    id: Optional[str] = None
    name: str
    color: str = "#4361EE"
    short: str
    email: EmailStr
    voice: str = ""


class ClientPatch(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    short: Optional[str] = None
    email: Optional[EmailStr] = None
    voice: Optional[str] = None


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    role_key: str  # writer | designer | mktg | webdev | clientsvc | manager
    role_label: str
    is_admin: bool = False


class UserPatch(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role_key: Optional[str] = None
    role_label: Optional[str] = None
    is_admin: Optional[bool] = None


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=6)


class PromptSettingsIn(BaseModel):
    global_prompt: Optional[str] = None
    ai_rules: Optional[list[str]] = None


class JobTemplateIn(BaseModel):
    name: str
    title_template: str = ""  # e.g. "Monthly SEO Report — {month}"
    client: Optional[str] = None
    priority: str = "medium"
    recurring: str = "none"
    team: list[str] = []
    assignees: list[str] = []
    desc: str = ""
    deliverables: list[str] = []
    default_days: int = 7


class UseTemplateIn(BaseModel):
    template_id: str
    title: Optional[str] = None
    client: Optional[str] = None
    due: Optional[str] = None

class ApprovalCommentIn(BaseModel):
    text: str


class MentionCommentIn(BaseModel):
    text: str
    mentions: list[str] = []  # list of user ids


class PublicApprovalDecision(BaseModel):
    action: str  # approve | revise
    feedback: Optional[str] = ""
    author: Optional[str] = None  # client-provided name


class PublicApprovalComment(BaseModel):
    text: str
    author: Optional[str] = None


class FestivalIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    date: str  # YYYY-MM-DD
    type: str = "festival"  # festival | holiday | brand | other
    description: str = ""


class FestivalPatch(BaseModel):
    name: Optional[str] = None
    date: Optional[str] = None
    type: Optional[str] = None
    description: Optional[str] = None


# ---------- HR models ----------

class UserHRPatch(BaseModel):
    birthday: Optional[str] = None
    joining_date: Optional[str] = None
    blood_group: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    in_notice_period: Optional[bool] = None
    notice_start: Optional[str] = None


class LeaveApplicationIn(BaseModel):
    type: str  # PL | CL | SL | CO
    from_date: str
    to_date: str
    reason: str = Field(min_length=1, max_length=500)
    lead_person_id: str
    handover_notes: str = Field(min_length=1, max_length=2000)


class LeaveDecision(BaseModel):
    decision: str  # approved | rejected
    note: str = ""


class CompOffGrant(BaseModel):
    user_id: str
    days: float
    reason: str = ""


class AnnouncementIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=4000)
    expires_at: Optional[str] = None


class PolicyIn(BaseModel):
    section: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=8000)


class PolicyPatch(BaseModel):
    section: Optional[str] = None
    title: Optional[str] = None
    body: Optional[str] = None


class TeamActivityIn(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    kind: str = "activity"  # training | activity
    date: str
    description: str = ""
    attendees: List[str] = []


class OutingIn(BaseModel):
    title: str = Field(min_length=1, max_length=140)
    kind: str = "monthly"  # monthly | quarterly
    date: str
    venue: str = ""
    budget: float = 0
    attendees: List[str] = []
    notes: str = ""
    checklist: List[Dict[str, Any]] = []


class OneOnOneIn(BaseModel):
    member_id: str
    date: str
    agenda: str = ""
    notes: str = ""
    action_items: List[Dict[str, Any]] = []


class ReimbursementIn(BaseModel):
    amount: float
    category: str = "other"
    date: str
    description: str = Field(min_length=1, max_length=500)
    attachment_url: Optional[str] = None


class WellnessPulseIn(BaseModel):
    energy_score: int = Field(ge=1, le=5)
    note: str = ""


class VaultPinSet(BaseModel):
    new_pin: str = Field(min_length=4, max_length=20)
    current_pin: Optional[str] = None


class VaultUnlock(BaseModel):
    pin: str


class SalaryIn(BaseModel):
    user_id: str
    amount: float
    currency: str = "INR"
    effective_from: str
    note: str = ""
    pin: str  # required to write


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


@api.post("/users")
async def create_user(data: UserCreate, _: dict = Depends(manager_only)):
    email = data.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email already in use")
    doc = {
        "id": f"u_{uuid.uuid4().hex[:8]}",
        "email": email,
        "name": data.name,
        "role_key": data.role_key,
        "role_label": data.role_label,
        "is_admin": data.is_admin,
        "password_hash": bcrypt.hashpw(data.password.encode(), bcrypt.gensalt()).decode(),
        "created_at": _now_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return doc


@api.patch("/users/{user_id}")
async def patch_user(user_id: str, data: UserPatch, actor: dict = Depends(manager_only)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if "email" in updates:
        updates["email"] = updates["email"].lower()
        existing = await db.users.find_one({"email": updates["email"], "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=409, detail="Email already in use")
    if not updates:
        return {"ok": True}
    result = await db.users.update_one({"id": user_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return doc


@api.post("/users/{user_id}/reset-password")
async def reset_password(user_id: str, data: PasswordReset, _: dict = Depends(manager_only)):
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": bcrypt.hashpw(data.new_password.encode(), bcrypt.gensalt()).decode()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"ok": True}


@api.delete("/users/{user_id}")
async def delete_user(user_id: str, actor: dict = Depends(manager_only)):
    if user_id == actor["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    target = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("is_admin"):
        admin_count = await db.users.count_documents({"is_admin": True})
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot delete the last admin")
    active = await db.jobs.count_documents({"assignees": user_id, "status": {"$in": ["active", "todo", "review", "overdue"]}})
    if active > 0:
        raise HTTPException(status_code=400, detail=f"Reassign this person's {active} active job(s) first")
    await db.users.delete_one({"id": user_id})
    # cascade: pull from any remaining job assignees
    await db.jobs.update_many({}, {"$pull": {"assignees": user_id}})
    return {"ok": True}


@api.get("/clients")
async def list_clients(_: dict = Depends(current_user)):
    return _clean_list(await db.clients.find({}).to_list(100))


@api.post("/clients")
async def create_client(data: ClientIn, _: dict = Depends(manager_only)):
    cid = data.id or data.short.lower().replace(" ", "-") or f"c-{uuid.uuid4().hex[:8]}"
    if await db.clients.find_one({"id": cid}):
        raise HTTPException(status_code=409, detail="Client id already exists")
    doc = {"id": cid, "name": data.name, "color": data.color, "short": data.short.upper()[:3], "email": data.email.lower(), "voice": data.voice}
    await db.clients.insert_one(doc)
    return _clean(doc)


@api.patch("/clients/{client_id}")
async def patch_client(client_id: str, data: ClientPatch, _: dict = Depends(manager_only)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if "email" in updates:
        updates["email"] = updates["email"].lower()
    if "short" in updates:
        updates["short"] = updates["short"].upper()[:3]
    if not updates:
        return {"ok": True}
    result = await db.clients.update_one({"id": client_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    doc = await db.clients.find_one({"id": client_id})
    return _clean(doc)


@api.delete("/clients/{client_id}")
async def delete_client(client_id: str, _: dict = Depends(manager_only)):
    if not await db.clients.find_one({"id": client_id}):
        raise HTTPException(status_code=404, detail="Client not found")
    active = await db.jobs.count_documents({"client": client_id, "status": {"$in": ["active", "todo", "review", "overdue"]}})
    if active > 0:
        raise HTTPException(status_code=400, detail=f"{active} active job(s) still linked to this client. Archive or reassign them first.")
    # Historical (done) jobs stay in place but are marked with a deleted-client marker so they don't render broken names.
    await db.jobs.update_many({"client": client_id}, {"$set": {"clientArchived": True}})
    await db.clients.delete_one({"id": client_id})
    return {"ok": True}


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
async def add_comment(job_id: str, body: MentionCommentIn, user: dict = Depends(current_user)):
    q = _apply_role_filter({"id": job_id}, user)
    job = await db.jobs.find_one(q, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    comment = {
        "id": f"c-{int(datetime.now().timestamp()*1000)}",
        "author": user["name"],
        "authorId": user["id"],
        "text": body.text,
        "mentions": body.mentions or [],
        "at": _now_iso(),
    }
    await db.jobs.update_one({"id": job_id}, {"$push": {"comments": comment}, "$set": {"updatedAt": _now_iso()}})
    # Fan-out notifications for mentioned users
    for uid in (body.mentions or []):
        if uid == user["id"]:
            continue
        target = await db.users.find_one({"id": uid}, {"_id": 0})
        if not target:
            continue
        await db.notifications.insert_one({
            "id": f"n-{uuid.uuid4().hex[:8]}",
            "title": f"{user['name']} mentioned you in {job['id']}",
            "subtitle": (body.text[:100] + "…") if len(body.text) > 100 else body.text,
            "time": _now_iso(),
            "type": "mention",
            "read": False,
            "user_id": uid,
            "job_id": job_id,
        })
    return comment


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
    advice = await ai_service.coaching_advice(entry, member["name"], member["role_label"], system_prompt=await build_active_system_prompt())
    return {"advice": advice}


@api.post("/kpi/team-review")
async def kpi_team_review(_: dict = Depends(manager_only)):
    entries = await db.kpi.find({"period": "monthly"}, {"_id": 0}).to_list(50)
    users = await db.users.find({}, {"_id": 0}).to_list(50)
    members = {u["id"]: u for u in users}
    review = await ai_service.team_review(entries, members, system_prompt=await build_active_system_prompt())
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
    data = await ai_service.sop_generate(body.topic, system_prompt=await build_active_system_prompt())
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


# ---------- public client portal (no auth) ----------

public_api = APIRouter(prefix="/api/public")


async def _load_public_approval(token: str) -> dict:
    doc = await db.approvals.find_one({"public_token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Approval link is invalid or expired")
    # Enrich with client + a SAFE PROJECTION of the job (never leak internal comments / hours / assignees / desc)
    job = await db.jobs.find_one(
        {"id": doc.get("jobId")},
        {"_id": 0, "id": 1, "title": 1, "attachments": 1, "due": 1, "priority": 1},
    ) or {}
    client = await db.clients.find_one({"id": doc.get("client")}, {"_id": 0}) or {}
    return {**doc, "job": job, "clientData": {"name": client.get("name"), "color": client.get("color"), "short": client.get("short")}}


@public_api.get("/approvals/{token}")
async def public_get_approval(token: str):
    return await _load_public_approval(token)


@public_api.post("/approvals/{token}/decide")
async def public_decide_approval(token: str, body: PublicApprovalDecision):
    doc = await db.approvals.find_one({"public_token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Approval link is invalid")
    if body.action not in ("approve", "revise"):
        raise HTTPException(status_code=400, detail="Invalid action")
    # Block stale flips: if already decided, tell the caller instead of silently overwriting
    if doc.get("status") in ("approved", "rejected"):
        raise HTTPException(status_code=409, detail=f"This item was already {doc['status']}. Ask Openspace to reopen it if you need to change the decision.")
    new_status = "approved" if body.action == "approve" else "rejected"
    author = (body.author or "Client").strip()[:80] or "Client"
    feedback_clean = (body.feedback or "").strip()[:4000]
    await db.approvals.update_one(
        {"public_token": token},
        {"$set": {"status": new_status, "feedback": feedback_clean, "decided_by_client": author, "decided_at": _now_iso()}},
    )
    note = {"id": f"ac-{uuid.uuid4().hex[:10]}", "author": f"{author} (client)", "authorId": "public", "text": f"Client {'approved' if new_status=='approved' else 'requested revision'} via portal." + (f" Feedback: {feedback_clean}" if feedback_clean else ""), "at": _now_iso()}
    await db.approvals.update_one({"public_token": token}, {"$push": {"comments": note}})
    await db.notifications.insert_one({
        "id": f"n-{uuid.uuid4().hex[:8]}",
        "title": f"Client {new_status}: {doc.get('title','')}",
        "subtitle": f"{author} via client portal" + (f" · {feedback_clean[:80]}" if feedback_clean else ""),
        "time": _now_iso(),
        "type": "approval" if new_status == "approved" else "revision",
        "read": False,
    })
    return await _load_public_approval(token)


@public_api.post("/approvals/{token}/comments")
async def public_add_comment(token: str, body: PublicApprovalComment):
    doc = await db.approvals.find_one({"public_token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Approval link is invalid")
    author = (body.author or "Client").strip()[:80] or "Client"
    text = (body.text or "").strip()[:4000]
    if not text:
        raise HTTPException(status_code=400, detail="Comment cannot be empty")
    comment = {"id": f"ac-{uuid.uuid4().hex[:10]}", "author": f"{author} (client)", "authorId": "public", "text": text, "at": _now_iso()}
    await db.approvals.update_one({"public_token": token}, {"$push": {"comments": comment}})
    return comment


@public_api.get("/approvals/{token}/attachments/{attachment_id}")
async def public_download_attachment(token: str, attachment_id: str):
    doc = await db.approvals.find_one({"public_token": token}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Approval link is invalid")
    job = await db.jobs.find_one({"id": doc.get("jobId")}, {"_id": 0}) or {}
    att = next((a for a in job.get("attachments", []) if a.get("id") == attachment_id and not a.get("is_deleted")), None)
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")
    try:
        content, _ = storage_service.get_object(att["storage_path"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {e}")
    return Response(
        content=content,
        media_type=att.get("content_type", "application/octet-stream"),
        headers={"Content-Disposition": f'inline; filename="{att["filename"]}"'},
    )


# ---------- global search ----------

@api.get("/search")
async def global_search(q: str, user: dict = Depends(current_user)):
    q = (q or "").strip()
    if len(q) < 2:
        return {"jobs": [], "clients": [], "approvals": []}
    safe = re.escape(q)
    regex = {"$regex": safe, "$options": "i"}
    job_q = {"$or": [{"title": regex}, {"id": regex}, {"desc": regex}]}
    if not user.get("is_admin"):
        job_q = {"$and": [job_q, {"assignees": user["id"]}]}
    jobs = await db.jobs.find(job_q, {"_id": 0, "id": 1, "title": 1, "client": 1, "status": 1}).limit(6).to_list(6)
    clients = await db.clients.find({"$or": [{"name": regex}, {"short": regex}]}, {"_id": 0, "id": 1, "name": 1, "color": 1}).limit(4).to_list(4)
    # Also join approvals by matching client name (denormalised via post-filter for now)
    appr_q = {"$or": [{"title": regex}, {"preview": regex}]}
    approvals = await db.approvals.find(appr_q, {"_id": 0, "id": 1, "jobId": 1, "title": 1, "status": 1, "client": 1}).limit(4).to_list(4)
    if clients:
        client_ids = [c["id"] for c in clients]
        extras = await db.approvals.find({"client": {"$in": client_ids}, "id": {"$nin": [a["id"] for a in approvals]}}, {"_id": 0, "id": 1, "jobId": 1, "title": 1, "status": 1, "client": 1}).limit(4 - len(approvals)).to_list(4)
        approvals.extend(extras)
    return {"jobs": jobs, "clients": clients, "approvals": approvals}


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
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    # Team workload snapshot
    users = await db.users.find({}, {"_id": 0}).to_list(50)
    workload = {}
    for u in users:
        active_count = await db.jobs.count_documents({"assignees": u["id"], "status": {"$in": ["active", "todo", "review", "overdue"]}})
        workload[u["role_key"]] = active_count

    # Tailored context: recent jobs + prior emails from THIS client
    recent_jobs = await db.jobs.find(
        {"client": client["id"]}, {"_id": 0}
    ).sort("createdAt", -1).to_list(5)
    prior_emails = await db.inbox.find(
        {"clientId": client["id"], "id": {"$ne": body.emailId}}, {"_id": 0}
    ).sort("time", -1).to_list(3)

    result = await ai_service.parse_brief(
        email_body=email["body"],
        client_id=client["id"],
        client_name=client["name"],
        client_email=client["email"],
        client_voice=client.get("voice", ""),
        workload=workload,
        recent_jobs=recent_jobs,
        prior_emails=prior_emails,
        system_prompt=await build_active_system_prompt(),
    )
    return result


@api.post("/inbox/draft-reply")
async def draft_reply_api(body: ReplyDraftIn, _: dict = Depends(manager_only)):
    email = await db.inbox.find_one({"id": body.emailId}, {"_id": 0})
    if not email:
        raise HTTPException(status_code=404, detail="Email not found")
    client = await db.clients.find_one({"id": email["clientId"]}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    recent_jobs = await db.jobs.find({"client": client["id"]}, {"_id": 0}).sort("createdAt", -1).to_list(5)
    prior_emails = await db.inbox.find({"clientId": client["id"], "id": {"$ne": body.emailId}}, {"_id": 0}).sort("time", -1).to_list(3)
    reply = await ai_service.draft_reply(
        email_body=email["body"],
        client_name=client["name"],
        voice=client.get("voice", ""),
        recent_jobs=recent_jobs,
        prior_emails=prior_emails,
        system_prompt=await build_active_system_prompt(),
    )
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
    clients = await db.clients.find({}, {"_id": 0}).to_list(50)
    active_by_client = {c["id"]: 0 for c in clients}
    for j in jobs:
        if j["status"] in ("active", "todo", "review", "overdue"):
            active_by_client[j.get("client")] = active_by_client.get(j.get("client"), 0) + 1
    top_client = max(active_by_client.items(), key=lambda kv: kv[1], default=("—", 0))[0]
    stats = {
        "jobsDone": sum(1 for j in jobs if j["status"] == "done"),
        "overdue": sum(1 for j in jobs if j["status"] == "overdue"),
        "topClient": top_client,
        "utilisation": f"{sum(j['hours'] for j in jobs)} hrs logged",
    }
    insights = await ai_service.report_insights(body.period, stats, system_prompt=await build_active_system_prompt())
    return {"insights": insights, "stats": stats}


# ---------- ai assistant ----------

@api.post("/ai/assistant")
async def ai_assistant(body: AssistantIn, _: dict = Depends(current_user)):
    system = await build_active_system_prompt()
    reply = await ai_service.assistant(body.prompt, body.sessionId or "assistant", system_prompt=system)
    return {"reply": reply}


@api.post("/ai/job-help")
async def ai_job_help(body: JobHelpIn, user: dict = Depends(current_user)):
    q = _apply_role_filter({"id": body.jobId}, user)
    job = await db.jobs.find_one(q, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    system = await build_active_system_prompt()
    reply = await ai_service.job_help(body.kind, job, system_prompt=system)
    return {"reply": reply}


@api.post("/ai/celebrate")
async def ai_celebrate(body: JobHelpIn, user: dict = Depends(current_user)):
    q = _apply_role_filter({"id": body.jobId}, user)
    job = await db.jobs.find_one(q, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    client = await db.clients.find_one({"id": job.get("client")}, {"_id": 0}) or {}
    system = await build_active_system_prompt()
    try:
        line = await ai_service.job_celebrate(
            person=user["name"],
            role=user.get("role_label", "team"),
            client=client.get("name", job.get("client", "the client")),
            title=job.get("title", ""),
            system_prompt=system,
        )
    except Exception as e:
        line = f"{user['name'].split()[0]} shipped {job.get('title','the job')} — certified beast mode 👑"
    return {"line": line}


@api.get("/kpi/streak")
async def kpi_streak(user: dict = Depends(current_user)):
    """Return the current user's completion streak (consecutive days with >=1 job done)
    and how many jobs they've completed today. Team-member view — respects role filter."""
    q = _apply_role_filter({"status": "done"}, user)
    docs = await db.jobs.find(q, {"_id": 0, "updatedAt": 1, "id": 1}).to_list(1000)
    # Bucket completed jobs by day (from updatedAt)
    from collections import defaultdict
    by_day: dict[str, int] = defaultdict(int)
    for d in docs:
        u = d.get("updatedAt") or ""
        day = u[:10] if u else ""
        if day:
            by_day[day] += 1
    today = datetime.now(timezone.utc).date().isoformat()
    jobs_today = by_day.get(today, 0)
    # Streak: walk backwards from today
    streak = 0
    cur = datetime.now(timezone.utc).date()
    while by_day.get(cur.isoformat(), 0) > 0:
        streak += 1
        cur = cur - timedelta(days=1)
    total_done = sum(by_day.values())
    return {"streak": streak, "jobs_today": jobs_today, "total_done": total_done}


def _iso_week_key() -> str:
    now = datetime.now(timezone.utc)
    y, w, _ = now.isocalendar()
    return f"{y}-W{w:02d}"


async def _build_digest_stats() -> dict:
    """Aggregate the last-7-day agency stats used by both the AI digest and the UI header."""
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    week_ago_iso = week_ago.isoformat()

    jobs = _clean_list(await db.jobs.find({}).to_list(1000))
    users = _clean_list(await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(200))
    clients = _clean_list(await db.clients.find({}).to_list(100))
    approvals = _clean_list(await db.approvals.find({}).to_list(500))
    notifs = await db.notifications.count_documents({
        "user_id": "u_yusuf",
        "type": "mention",
        "time": {"$gte": week_ago_iso},
    })

    # Bucket
    open_statuses = {"active", "todo", "review", "overdue"}
    active_total = sum(1 for j in jobs if j["status"] in open_statuses)
    overdue = sum(1 for j in jobs if j["status"] == "overdue")
    done_week = sum(1 for j in jobs if j["status"] == "done" and (j.get("updatedAt") or "") >= week_ago_iso)
    pending_approvals = sum(1 for a in approvals if a.get("status") == "pending")
    scope_flags = sum(1 for j in jobs if (j.get("scopeAdded") or 0) > 0 and j["status"] in open_statuses)

    # Workload by member
    user_by_id = {u["id"]: u for u in users}
    workload = []
    for u in users:
        c = sum(1 for j in jobs if u["id"] in (j.get("assignees") or []) and j["status"] in open_statuses)
        workload.append((u, c))
    workload.sort(key=lambda x: x[1], reverse=True)
    non_admin_workload = [w for w in workload if not w[0].get("is_admin")]
    top_loaded = f"{non_admin_workload[0][0]['name']} ({non_admin_workload[0][1]} open)" if non_admin_workload else "—"
    least_loaded_pool = [w for w in non_admin_workload if w[1] < (non_admin_workload[0][1] if non_admin_workload else 0)]
    least_loaded = f"{least_loaded_pool[-1][0]['name']} ({least_loaded_pool[-1][1]} open)" if least_loaded_pool else "—"

    # Top client by open workload + silent clients
    client_open: dict[str, int] = {}
    client_last_touch: dict[str, str] = {}
    for j in jobs:
        cid = j.get("client")
        if not cid:
            continue
        if j["status"] in open_statuses:
            client_open[cid] = client_open.get(cid, 0) + 1
        touch = j.get("updatedAt") or j.get("createdAt") or ""
        if touch and touch > client_last_touch.get(cid, ""):
            client_last_touch[cid] = touch
    cname = {c["id"]: c["name"] for c in clients}
    if client_open:
        top_cid = max(client_open, key=client_open.get)
        top_client = f"{cname.get(top_cid, top_cid)} ({client_open[top_cid]} open)"
    else:
        top_client = "—"
    silent = [cname[cid] for cid in cname if client_last_touch.get(cid, "") < week_ago_iso]

    workload_block = "\n".join(f"- {u['name']} ({u.get('role_label','?')}): {c} open" for (u, c) in non_admin_workload)
    clients_block = "\n".join(
        f"- {cname[c['id']]}: {client_open.get(c['id'],0)} open, last activity {(client_last_touch.get(c['id']) or 'never')[:10]}"
        for c in clients
    )

    return {
        "done_week": done_week,
        "active_total": active_total,
        "overdue": overdue,
        "pending_approvals": pending_approvals,
        "top_client": top_client,
        "top_loaded": top_loaded,
        "least_loaded": least_loaded,
        "scope_flags": scope_flags,
        "silent_clients": ", ".join(silent) if silent else "none",
        "mentions_yusuf": notifs,
        "workload_block": workload_block or "- (no team data)",
        "clients_block": clients_block or "- (no clients)",
    }


@api.get("/ai/manager-digest")
async def ai_manager_digest(refresh: bool = False, _: dict = Depends(manager_only)):
    """Yusuf's Monday morning 'State of the Agency' digest. Cached per ISO week; ?refresh=true regenerates."""
    week_key = _iso_week_key()
    if not refresh:
        cached = await db.manager_digests.find_one({"week": week_key}, {"_id": 0})
        if cached:
            return cached
    stats = await _build_digest_stats()
    system = await build_active_system_prompt()
    try:
        digest = await ai_service.manager_digest(stats, system_prompt=system)
    except Exception as e:
        digest = (
            f"🔥 {stats['done_week']} jobs shipped this week — solid pace.\n"
            f"⚠️ Watch {stats['top_loaded']} — heaviest workload right now.\n"
            f"🚨 Client at risk: {stats['top_client']} needs your attention.\n"
            f"✨ Free capacity on {stats['least_loaded']} — reroute one job.\n"
            f"🎯 Clear the {stats['pending_approvals']} pending approvals first thing today."
        )
    doc = {
        "week": week_key,
        "digest": digest.strip(),
        "stats": stats,
        "generated_at": _now_iso(),
    }
    await db.manager_digests.replace_one({"week": week_key}, doc, upsert=True)
    doc.pop("_id", None)
    return doc


# ---------- festivals & important dates ----------

_ROLE_SKILLS = {
    "writer": "long-form copy, blogs, captions, PR, LinkedIn posts, whitepapers, scripts",
    "designer": "graphics, carousels, decks, event creatives, festival visuals, story frames",
    "mktg": "SEO, ads, analytics, campaign scheduling, keyword research, funnel work",
    "webdev": "WordPress, landing pages, speed optimisation, responsive fixes, quick microsites",
    "clientsvc": "client emails, briefs, approvals, coordination, outreach, meeting prep",
    "manager": "strategy, review, direction",
}


def _valid_date(s: str) -> bool:
    try:
        datetime.strptime(s, "%Y-%m-%d")
        return True
    except Exception:
        return False


@api.get("/festivals")
async def list_festivals(_: dict = Depends(current_user)):
    docs = await db.festivals.find({}).sort("date", 1).to_list(500)
    return _clean_list(docs)


@api.post("/festivals")
async def create_festival(data: FestivalIn, _: dict = Depends(manager_only)):
    if not _valid_date(data.date):
        raise HTTPException(status_code=400, detail="Invalid date, expected YYYY-MM-DD")
    if data.type not in ("festival", "holiday", "brand", "other"):
        raise HTTPException(status_code=400, detail="Invalid type")
    doc = {"id": f"fest-{uuid.uuid4().hex[:10]}", **data.model_dump()}
    await db.festivals.insert_one(doc)
    return _clean(doc)


@api.patch("/festivals/{fest_id}")
async def patch_festival(fest_id: str, data: FestivalPatch, _: dict = Depends(manager_only)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if "date" in updates and not _valid_date(updates["date"]):
        raise HTTPException(status_code=400, detail="Invalid date, expected YYYY-MM-DD")
    if "type" in updates and updates["type"] not in ("festival", "holiday", "brand", "other"):
        raise HTTPException(status_code=400, detail="Invalid type")
    if not updates:
        return {"ok": True}
    r = await db.festivals.update_one({"id": fest_id}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Festival not found")
    doc = await db.festivals.find_one({"id": fest_id})
    return _clean(doc)


@api.delete("/festivals/{fest_id}")
async def delete_festival(fest_id: str, _: dict = Depends(manager_only)):
    r = await db.festivals.delete_one({"id": fest_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Festival not found")
    return {"ok": True}


@api.post("/ai/idle-suggestions")
async def ai_idle_suggestions(user: dict = Depends(current_user)):
    """Proactive brand-work ideas when a team member has no open jobs. Uses upcoming
    festivals (next 60 days), the team member's role, and Openspace's client roster."""
    today = datetime.now(timezone.utc).date()
    horizon = (today + timedelta(days=60)).isoformat()
    today_iso = today.isoformat()
    fests = await db.festivals.find(
        {"date": {"$gte": today_iso, "$lte": horizon}},
        {"_id": 0},
    ).sort("date", 1).to_list(50)
    clients = await db.clients.find({}, {"_id": 0}).to_list(50)
    role_skills = _ROLE_SKILLS.get(user.get("role_key", "writer"), "brand work")
    system = await build_active_system_prompt()
    try:
        data = await ai_service.idle_suggestions(
            name=user["name"],
            role_label=user.get("role_label", "team"),
            role_skills=role_skills,
            festivals=fests,
            clients=clients,
            system_prompt=system,
        )
        ideas = data.get("ideas", []) if isinstance(data, dict) else []
    except Exception:
        ideas = []
    if not ideas:
        # deterministic fallback so the UI always has something useful
        fallback_client = clients[0] if clients else {"id": "", "name": "your top client"}
        upcoming = fests[0] if fests else None
        ideas = [{
            "title": f"Draft a {upcoming['name']} post for {fallback_client['name']}" if upcoming else f"Refresh {fallback_client['name']}'s brand voice guide",
            "brand": fallback_client.get("id", ""),
            "brand_name": fallback_client.get("name", ""),
            "tied_to": upcoming["name"] if upcoming else "evergreen",
            "why": "AI is warming up — here's a safe starter idea. Refresh to get fresh AI-generated suggestions.",
        }]
    return {"ideas": ideas, "upcoming_festivals": fests[:8]}


# ---------- clients workload (for job creation UX) ----------

@api.get("/clients/{client_id}/workload")
async def client_workload(client_id: str, user: dict = Depends(current_user)):
    """Snapshot of a client's active work — used in the job creation form so the
    team can set realistic deadlines/priority given current load."""
    if not await db.clients.find_one({"id": client_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Client not found")
    open_statuses = ["active", "todo", "review", "overdue"]
    jobs = _clean_list(await db.jobs.find({"client": client_id, "status": {"$in": open_statuses}}, {"_id": 0}).sort("due", 1).to_list(50))
    by_status = {s: 0 for s in open_statuses}
    by_assignee: dict[str, int] = {}
    total_hours = 0.0
    for j in jobs:
        by_status[j["status"]] = by_status.get(j["status"], 0) + 1
        total_hours += float(j.get("hours") or 0)
        for a in (j.get("assignees") or []):
            by_assignee[a] = by_assignee.get(a, 0) + 1
    # Recent 5 upcoming due dates
    upcoming = [{"id": j["id"], "title": j["title"], "due": j.get("due"), "status": j["status"], "priority": j.get("priority"), "assignees": j.get("assignees", [])} for j in jobs[:5]]
    return {
        "client_id": client_id,
        "total_open": len(jobs),
        "by_status": by_status,
        "by_assignee": by_assignee,
        "total_open_hours": total_hours,
        "upcoming": upcoming,
    }


# ---------- HR: profile ----------

@api.patch("/hr/profile/{user_id}")
async def hr_patch_profile(user_id: str, data: UserHRPatch, user: dict = Depends(current_user)):
    """Users edit their own profile fields; managers can edit anyone. Notice-period
    toggle is manager-only."""
    is_self = user["id"] == user_id
    if not is_self and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Managers only")
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if "in_notice_period" in updates and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Only manager can toggle notice period")
    if "in_notice_period" in updates and updates["in_notice_period"] and "notice_start" not in updates:
        updates["notice_start"] = _now_iso()
    if not updates:
        return {"ok": True}
    r = await db.users.update_one({"id": user_id}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    return _clean(doc)


@api.get("/hr/dashboard")
async def hr_dashboard(_: dict = Depends(manager_only)):
    """Compact dashboard for Yusuf: upcoming birthdays, anniversaries, notice-period folks."""
    users = _clean_list(await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(50))
    today = date.today()
    horizon = today + timedelta(days=30)

    def upcoming_annual(iso_date: str | None):
        if not iso_date:
            return None
        try:
            d = datetime.strptime(iso_date, "%Y-%m-%d").date()
            this_year = d.replace(year=today.year)
            if this_year < today:
                this_year = d.replace(year=today.year + 1)
            days_away = (this_year - today).days
            return {"date": this_year.isoformat(), "days_away": days_away, "original": iso_date}
        except Exception:
            return None

    birthdays, anniversaries, on_notice = [], [], []
    for u in users:
        b = upcoming_annual(u.get("birthday"))
        if b and b["days_away"] <= 30:
            birthdays.append({"user": {"id": u["id"], "name": u["name"], "role_label": u.get("role_label")}, **b})
        a = upcoming_annual(u.get("joining_date"))
        if a and a["days_away"] <= 30:
            j = datetime.strptime(u["joining_date"], "%Y-%m-%d").date()
            years = today.year - j.year + (0 if a["days_away"] > 0 else 0)
            anniversaries.append({"user": {"id": u["id"], "name": u["name"], "role_label": u.get("role_label")}, **a, "years": max(1, years)})
        if u.get("in_notice_period"):
            on_notice.append({"id": u["id"], "name": u["name"], "role_label": u.get("role_label"), "notice_start": u.get("notice_start")})
    birthdays.sort(key=lambda x: x["days_away"])
    anniversaries.sort(key=lambda x: x["days_away"])
    return {"upcoming_birthdays": birthdays, "upcoming_anniversaries": anniversaries, "on_notice": on_notice}


# ---------- HR: leaves ----------

def _year_holidays_iso(festivals: list, year: int) -> list[str]:
    out = []
    for f in festivals:
        if f.get("type") in ("holiday",) and f.get("date", "").startswith(str(year)):
            out.append(f["date"])
    return out


async def _get_or_init_balance(user_id: str, year: int) -> dict:
    doc = await db.leave_balances.find_one({"user_id": user_id, "year": year}, {"_id": 0})
    if doc:
        return doc
    # Compute defaults; only past-probation users start with entitlement
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    eligible = hr_service.is_past_probation(user.get("joining_date", ""))
    balances = hr_service.default_balances() if eligible else {"PL": 0.0, "CL": 0.0, "SL": 0.0, "PH": 0.0, "CO": 0.0}
    doc = {
        "user_id": user_id,
        "year": year,
        "balances": balances,
        "used": {"PL": 0.0, "CL": 0.0, "SL": 0.0, "PH": 0.0, "CO": 0.0},
        "eligible": eligible,
    }
    await db.leave_balances.insert_one({**doc})
    return doc


@api.get("/hr/leaves/balance")
async def leaves_balance(user_id: Optional[str] = None, user: dict = Depends(current_user)):
    """Own balance by default; manager can query any user."""
    target = user_id or user["id"]
    if target != user["id"] and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Managers only")
    doc = await _get_or_init_balance(target, hr_service.year_key())
    return doc


@api.post("/hr/leaves")
async def leaves_apply(body: LeaveApplicationIn, user: dict = Depends(current_user)):
    """Apply for a leave. Enforces probation, balance, 20-day-advance-notice, sandwich rule."""
    if body.type not in ("PL", "CL", "SL", "CO"):
        raise HTTPException(status_code=400, detail="Invalid leave type")
    if not hr_service.is_past_probation(user.get("joining_date", "")):
        raise HTTPException(status_code=403, detail="You are still on probation (3 months). Leaves are not available yet.")
    if not body.lead_person_id or body.lead_person_id == user["id"]:
        raise HTTPException(status_code=400, detail="Lead person must be a different team member")

    year = hr_service.year_key(body.from_date)
    bal = await _get_or_init_balance(user["id"], year)
    festivals = await db.festivals.find({}, {"_id": 0}).to_list(200)
    holiday_iso = [f["date"] for f in festivals if f.get("type") == "holiday" and f.get("date", "").startswith(str(year))]
    days = hr_service.count_leave_days(body.from_date, body.to_date, holiday_iso, sandwich=True)
    if days <= 0:
        raise HTTPException(status_code=400, detail="Invalid date range")

    # 20-day advance notice for 3+ day leaves
    today_iso = date.today().isoformat()
    gap = hr_service.working_days_gap(today_iso, body.from_date)
    if days >= 3 and gap < 20:
        raise HTTPException(status_code=400, detail=f"Leaves of 3+ days need 20 days advance notice — you're applying with only {gap} day(s) notice.")

    available = float(bal["balances"].get(body.type, 0)) - float(bal["used"].get(body.type, 0))
    if days > available:
        raise HTTPException(status_code=400, detail=f"Insufficient {body.type} balance — need {days} days, have {available}")

    # Ensure lead person exists
    if not await db.users.find_one({"id": body.lead_person_id}, {"_id": 1}):
        raise HTTPException(status_code=400, detail="Lead person not found")

    doc = {
        "id": f"leave-{uuid.uuid4().hex[:10]}",
        "user_id": user["id"],
        "type": body.type,
        "from_date": body.from_date,
        "to_date": body.to_date,
        "days": days,
        "reason": body.reason,
        "lead_person_id": body.lead_person_id,
        "handover_notes": body.handover_notes,
        "status": "pending",
        "applied_at": _now_iso(),
        "decided_at": None,
        "decided_by": None,
        "decision_note": "",
    }
    await db.leave_applications.insert_one({**doc})
    # Notify manager
    admins = await db.users.find({"is_admin": True}, {"_id": 0}).to_list(10)
    for a in admins:
        await db.notifications.insert_one({
            "id": f"n-{uuid.uuid4().hex[:8]}",
            "title": f"Leave request from {user['name']}",
            "subtitle": f"{body.type} · {days} day(s) · {body.from_date} → {body.to_date}",
            "time": _now_iso(), "type": "leave", "read": False, "user_id": a["id"],
        })
    return doc


@api.get("/hr/leaves")
async def leaves_list(user_id: Optional[str] = None, status_: Optional[str] = None, user: dict = Depends(current_user)):
    """Own applications by default; managers see all when no filter."""
    q: dict = {}
    if user.get("is_admin"):
        if user_id:
            q["user_id"] = user_id
    else:
        q["user_id"] = user["id"]
    if status_:
        q["status"] = status_
    docs = _clean_list(await db.leave_applications.find(q, {"_id": 0}).sort("applied_at", -1).to_list(500))
    return docs


@api.get("/hr/leaves/team-calendar")
async def leaves_team_calendar(user: dict = Depends(current_user)):
    """Approved leaves visible to whole team — used for 'who's out' overlays."""
    docs = _clean_list(await db.leave_applications.find({"status": "approved"}, {"_id": 0, "handover_notes": 0}).to_list(1000))
    return docs


@api.post("/hr/leaves/{leave_id}/decide")
async def leaves_decide(leave_id: str, body: LeaveDecision, _: dict = Depends(manager_only)):
    if body.decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid decision")
    doc = await db.leave_applications.find_one({"id": leave_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    if doc["status"] != "pending":
        raise HTTPException(status_code=409, detail="Already decided")
    await db.leave_applications.update_one({"id": leave_id}, {"$set": {
        "status": body.decision, "decision_note": body.note, "decided_at": _now_iso(), "decided_by": _["id"],
    }})
    if body.decision == "approved":
        # Deduct balance
        year = hr_service.year_key(doc["from_date"])
        await db.leave_balances.update_one(
            {"user_id": doc["user_id"], "year": year},
            {"$inc": {f"used.{doc['type']}": doc["days"]}},
        )
    await db.notifications.insert_one({
        "id": f"n-{uuid.uuid4().hex[:8]}",
        "title": f"Leave {body.decision}",
        "subtitle": f"{doc['type']} · {doc['from_date']} → {doc['to_date']}" + (f" · {body.note}" if body.note else ""),
        "time": _now_iso(), "type": "leave", "read": False, "user_id": doc["user_id"],
    })
    updated = await db.leave_applications.find_one({"id": leave_id}, {"_id": 0})
    return _clean(updated)


@api.post("/hr/leaves/compoff/grant")
async def compoff_grant(body: CompOffGrant, _: dict = Depends(manager_only)):
    year = hr_service.year_key()
    await _get_or_init_balance(body.user_id, year)
    await db.leave_balances.update_one(
        {"user_id": body.user_id, "year": year},
        {"$inc": {"balances.CO": float(body.days)}},
    )
    await db.notifications.insert_one({
        "id": f"n-{uuid.uuid4().hex[:8]}",
        "title": f"Comp-off granted: +{body.days} day(s)",
        "subtitle": body.reason or "For weekend/holiday work",
        "time": _now_iso(), "type": "leave", "read": False, "user_id": body.user_id,
    })
    return await _get_or_init_balance(body.user_id, year)


# ---------- HR: handover doc ----------

@api.post("/hr/handover/{user_id}/generate")
async def handover_generate(user_id: str, _: dict = Depends(manager_only)):
    """Generate a handover snapshot for a team member (typically on notice-period toggle)."""
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    jobs = _clean_list(await db.jobs.find({"assignees": user_id, "status": {"$in": ["active", "todo", "review", "overdue"]}}).to_list(200))
    clients_seen = list({j["client"] for j in jobs if j.get("client")})
    clients = _clean_list(await db.clients.find({"id": {"$in": clients_seen}}, {"_id": 0}).to_list(50))

    active_jobs = [{
        "job_id": j["id"], "title": j["title"], "client": j.get("client"),
        "current_status": j["status"], "priority": j.get("priority"),
        "hours_spent": j.get("hours", 0), "next_steps": "", "reassign_to": "",
    } for j in jobs]

    doc = {
        "id": f"handover-{uuid.uuid4().hex[:10]}",
        "user_id": user_id,
        "user_name": u["name"],
        "role_label": u.get("role_label"),
        "generated_at": _now_iso(),
        "status": "draft",
        "active_jobs": active_jobs,
        "client_contacts": [{"id": c["id"], "name": c["name"], "email": c.get("email"), "notes": ""} for c in clients],
        "credentials_location": "",
        "brand_assets_location": "",
        "key_relationships": "",
        "additional_notes": "",
    }
    await db.handovers.replace_one({"user_id": user_id, "status": "draft"}, doc, upsert=True)
    doc.pop("_id", None)
    return doc


@api.get("/hr/handover/{user_id}")
async def handover_get(user_id: str, user: dict = Depends(current_user)):
    if user["id"] != user_id and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
    doc = await db.handovers.find_one({"user_id": user_id}, {"_id": 0}, sort=[("generated_at", -1)])
    if not doc:
        return None
    return _clean(doc)


@api.patch("/hr/handover/{handover_id}")
async def handover_patch(handover_id: str, body: Dict[str, Any], user: dict = Depends(current_user)):
    doc = await db.handovers.find_one({"id": handover_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    if user["id"] != doc["user_id"] and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Forbidden")
    allowed = {"active_jobs", "client_contacts", "credentials_location", "brand_assets_location", "key_relationships", "additional_notes", "status"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if updates:
        await db.handovers.update_one({"id": handover_id}, {"$set": updates})
    updated = await db.handovers.find_one({"id": handover_id}, {"_id": 0})
    return _clean(updated)


# ---------- HR: announcements, policies, activities, outings, 1:1s, wellness, reimbursements ----------

@api.get("/hr/announcements")
async def ann_list(_: dict = Depends(current_user)):
    docs = _clean_list(await db.announcements.find({}, {"_id": 0}).sort("posted_at", -1).to_list(50))
    return docs


@api.post("/hr/announcements")
async def ann_create(body: AnnouncementIn, user: dict = Depends(manager_only)):
    doc = {"id": f"ann-{uuid.uuid4().hex[:8]}", **body.model_dump(), "posted_at": _now_iso(), "posted_by": user["id"]}
    await db.announcements.insert_one({**doc})
    return doc


@api.delete("/hr/announcements/{ann_id}")
async def ann_delete(ann_id: str, _: dict = Depends(manager_only)):
    await db.announcements.delete_one({"id": ann_id})
    return {"ok": True}


@api.get("/hr/policies")
async def pol_list(_: dict = Depends(current_user)):
    return _clean_list(await db.policies.find({}, {"_id": 0}).to_list(100))


@api.post("/hr/policies")
async def pol_create(body: PolicyIn, user: dict = Depends(manager_only)):
    doc = {"id": f"pol-{uuid.uuid4().hex[:8]}", **body.model_dump(), "updated_at": _now_iso(), "updated_by": user["id"]}
    await db.policies.insert_one({**doc})
    return doc


@api.patch("/hr/policies/{pid}")
async def pol_patch(pid: str, body: PolicyPatch, user: dict = Depends(manager_only)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    updates["updated_at"] = _now_iso()
    updates["updated_by"] = user["id"]
    r = await db.policies.update_one({"id": pid}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return _clean(await db.policies.find_one({"id": pid}, {"_id": 0}))


@api.delete("/hr/policies/{pid}")
async def pol_delete(pid: str, _: dict = Depends(manager_only)):
    await db.policies.delete_one({"id": pid})
    return {"ok": True}


@api.get("/hr/activities")
async def act_list(_: dict = Depends(current_user)):
    return _clean_list(await db.team_activities.find({}, {"_id": 0}).sort("date", 1).to_list(100))


@api.post("/hr/activities")
async def act_create(body: TeamActivityIn, _: dict = Depends(manager_only)):
    doc = {"id": f"act-{uuid.uuid4().hex[:8]}", **body.model_dump()}
    await db.team_activities.insert_one({**doc})
    return doc


@api.delete("/hr/activities/{aid}")
async def act_delete(aid: str, _: dict = Depends(manager_only)):
    await db.team_activities.delete_one({"id": aid})
    return {"ok": True}


@api.post("/hr/activities/ai-suggest")
async def act_ai_suggest(_: dict = Depends(manager_only)):
    """Suggest a fresh 1-hour team activity or training idea, tailored to the current team."""
    users = _clean_list(await db.users.find({"is_admin": False}, {"_id": 0, "password_hash": 0}).to_list(20))
    roles = ", ".join({u.get("role_label", "") for u in users if u.get("role_label")})
    prompt = f"""Suggest ONE 1-hour team activity idea for an Openspace Agency (5-person Mumbai marketing agency).
Roles on the team: {roles}. Not necessary to have training every week — sometimes bonding/fun beats a class.

Return ONLY JSON:
{{"title": "...", "kind": "training|activity", "description": "2-3 sentences on what to do and why"}}"""
    try:
        system = await build_active_system_prompt()
        data = await ai_service.chat_json("act-suggest", prompt, system=system)
    except Exception:
        data = {"title": "Design critique jam", "kind": "activity", "description": "Everyone shares one recent piece, group critique for 5 min each, wrap with one takeaway."}
    return data


@api.get("/hr/outings")
async def out_list(_: dict = Depends(current_user)):
    return _clean_list(await db.outings.find({}, {"_id": 0}).sort("date", 1).to_list(100))


@api.post("/hr/outings")
async def out_create(body: OutingIn, _: dict = Depends(manager_only)):
    doc = {"id": f"out-{uuid.uuid4().hex[:8]}", **body.model_dump()}
    await db.outings.insert_one({**doc})
    return doc


@api.patch("/hr/outings/{oid}")
async def out_patch(oid: str, body: Dict[str, Any], _: dict = Depends(manager_only)):
    allowed = {"title", "kind", "date", "venue", "budget", "attendees", "notes", "checklist"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        return {"ok": True}
    r = await db.outings.update_one({"id": oid}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return _clean(await db.outings.find_one({"id": oid}, {"_id": 0}))


@api.delete("/hr/outings/{oid}")
async def out_delete(oid: str, _: dict = Depends(manager_only)):
    await db.outings.delete_one({"id": oid})
    return {"ok": True}


@api.get("/hr/one-on-ones/{member_id}")
async def oto_list(member_id: str, _: dict = Depends(manager_only)):
    return _clean_list(await db.one_on_ones.find({"member_id": member_id}, {"_id": 0}).sort("date", -1).to_list(100))


@api.post("/hr/one-on-ones")
async def oto_create(body: OneOnOneIn, user: dict = Depends(manager_only)):
    doc = {"id": f"oto-{uuid.uuid4().hex[:8]}", "manager_id": user["id"], **body.model_dump()}
    await db.one_on_ones.insert_one({**doc})
    return doc


@api.delete("/hr/one-on-ones/{oid}")
async def oto_delete(oid: str, _: dict = Depends(manager_only)):
    await db.one_on_ones.delete_one({"id": oid})
    return {"ok": True}


@api.post("/hr/wellness")
async def wellness_submit(body: WellnessPulseIn, user: dict = Depends(current_user)):
    from datetime import date as _date
    iso_year, iso_week, _ = _date.today().isocalendar()
    week_key = f"{iso_year}-W{iso_week:02d}"
    doc = {"id": f"wp-{uuid.uuid4().hex[:8]}", "user_id": user["id"], "week": week_key, "energy_score": body.energy_score, "note": body.note, "submitted_at": _now_iso()}
    # One pulse per user per week — replace if exists
    await db.wellness_pulses.replace_one({"user_id": user["id"], "week": week_key}, doc, upsert=True)
    doc.pop("_id", None)
    return doc


@api.get("/hr/wellness/mine")
async def wellness_mine(user: dict = Depends(current_user)):
    return _clean_list(await db.wellness_pulses.find({"user_id": user["id"]}, {"_id": 0}).sort("week", -1).to_list(52))


@api.get("/hr/wellness/team")
async def wellness_team(_: dict = Depends(manager_only)):
    docs = _clean_list(await db.wellness_pulses.find({}, {"_id": 0}).to_list(200))
    # Aggregate: weekly avg
    by_week: dict[str, list[float]] = {}
    for d in docs:
        by_week.setdefault(d["week"], []).append(float(d.get("energy_score") or 0))
    trend = [{"week": w, "avg": round(sum(s) / len(s), 2), "n": len(s)} for w, s in sorted(by_week.items())]
    return {"trend": trend}


@api.post("/hr/reimbursements")
async def reimb_create(body: ReimbursementIn, user: dict = Depends(current_user)):
    doc = {"id": f"reim-{uuid.uuid4().hex[:8]}", "user_id": user["id"], **body.model_dump(), "status": "pending", "submitted_at": _now_iso(), "decided_at": None, "decided_by": None, "decision_note": ""}
    await db.reimbursements.insert_one({**doc})
    return doc


@api.get("/hr/reimbursements")
async def reimb_list(user: dict = Depends(current_user)):
    q: dict = {} if user.get("is_admin") else {"user_id": user["id"]}
    return _clean_list(await db.reimbursements.find(q, {"_id": 0}).sort("submitted_at", -1).to_list(200))


@api.post("/hr/reimbursements/{rid}/decide")
async def reimb_decide(rid: str, body: LeaveDecision, user: dict = Depends(manager_only)):
    if body.decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Invalid decision")
    r = await db.reimbursements.update_one({"id": rid, "status": "pending"}, {"$set": {"status": body.decision, "decided_at": _now_iso(), "decided_by": user["id"], "decision_note": body.note}})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found or already decided")
    return _clean(await db.reimbursements.find_one({"id": rid}, {"_id": 0}))


# ---------- HR: salary vault (Yusuf-only, PIN-protected) ----------

def _vault_hash(pin: str) -> str:
    import bcrypt
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()


def _vault_verify(pin: str, hashed: str) -> bool:
    import bcrypt
    try:
        return bcrypt.checkpw(pin.encode(), hashed.encode())
    except Exception:
        return False


@api.get("/hr/vault/status")
async def vault_status(user: dict = Depends(manager_only)):
    doc = await db.vault_settings.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"is_set": bool(doc and doc.get("pin_hash"))}


@api.post("/hr/vault/set-pin")
async def vault_set_pin(body: VaultPinSet, user: dict = Depends(manager_only)):
    doc = await db.vault_settings.find_one({"user_id": user["id"]})
    if doc and doc.get("pin_hash"):
        if not body.current_pin or not _vault_verify(body.current_pin, doc["pin_hash"]):
            raise HTTPException(status_code=403, detail="Current PIN incorrect")
    await db.vault_settings.replace_one(
        {"user_id": user["id"]},
        {"user_id": user["id"], "pin_hash": _vault_hash(body.new_pin), "updated_at": _now_iso()},
        upsert=True,
    )
    return {"ok": True}


async def _vault_check(user: dict, pin: str) -> None:
    doc = await db.vault_settings.find_one({"user_id": user["id"]})
    if not doc or not _vault_verify(pin, doc.get("pin_hash", "")):
        raise HTTPException(status_code=403, detail="Vault PIN incorrect")


@api.post("/hr/vault/list")
async def vault_list(body: VaultUnlock, user: dict = Depends(manager_only)):
    await _vault_check(user, body.pin)
    docs = _clean_list(await db.salaries.find({}, {"_id": 0}).sort("effective_from", -1).to_list(500))
    # Latest per user
    latest: dict[str, dict] = {}
    for d in docs:
        if d["user_id"] not in latest:
            latest[d["user_id"]] = d
    users = _clean_list(await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(50))
    for u in users:
        u["_latest_salary"] = latest.get(u["id"])
    return {"users": users, "history": docs}


@api.post("/hr/vault/salary")
async def vault_salary_set(body: SalaryIn, user: dict = Depends(manager_only)):
    await _vault_check(user, body.pin)
    doc = {
        "id": f"sal-{uuid.uuid4().hex[:8]}",
        "user_id": body.user_id,
        "amount": body.amount,
        "currency": body.currency,
        "effective_from": body.effective_from,
        "note": body.note,
        "updated_at": _now_iso(),
        "updated_by": user["id"],
    }
    await db.salaries.insert_one({**doc})
    return doc


# ---------- prompt studio + templates ----------

DEFAULT_PROMPT_SETTINGS = {
    "id": "global",
    "global_prompt": ai_service.SYSTEM_PROMPT,
    "ai_rules": [
        "Match tasks to the right person by skill",
        "Flag workload over 8 jobs for any one person",
        "Flag scope creep (requests beyond agreed scope)",
        "Never propose an impossible deadline without flagging it",
        "Always use real names, never generic advice",
    ],
}


async def get_prompt_settings() -> dict:
    doc = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not doc:
        await db.settings.insert_one({**DEFAULT_PROMPT_SETTINGS})
        return DEFAULT_PROMPT_SETTINGS
    return doc


async def build_active_system_prompt() -> str:
    settings = await get_prompt_settings()
    base = settings.get("global_prompt") or ai_service.SYSTEM_PROMPT
    rules = settings.get("ai_rules") or []
    if not rules:
        return base
    rules_block = "\n".join(f"- {r}" for r in rules)
    return f"{base}\n\nADDITIONAL RULES (from Prompt Studio):\n{rules_block}"


@api.get("/settings/prompts")
async def read_prompt_settings(_: dict = Depends(manager_only)):
    return await get_prompt_settings()


@api.patch("/settings/prompts")
async def update_prompt_settings(data: PromptSettingsIn, _: dict = Depends(manager_only)):
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    if not updates:
        return await get_prompt_settings()
    await db.settings.update_one({"id": "global"}, {"$set": updates}, upsert=True)
    return await get_prompt_settings()


@api.get("/templates")
async def list_templates(_: dict = Depends(current_user)):
    return _clean_list(await db.templates.find({}).sort("name", 1).to_list(200))


@api.post("/templates")
async def create_template(data: JobTemplateIn, _: dict = Depends(manager_only)):
    doc = {"id": f"tpl-{uuid.uuid4().hex[:8]}", **data.model_dump(), "created_at": _now_iso()}
    await db.templates.insert_one(doc)
    return _clean(doc)


@api.patch("/templates/{template_id}")
async def patch_template(template_id: str, data: JobTemplateIn, _: dict = Depends(manager_only)):
    updates = data.model_dump()
    result = await db.templates.update_one({"id": template_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return _clean(await db.templates.find_one({"id": template_id}))


@api.delete("/templates/{template_id}")
async def delete_template(template_id: str, _: dict = Depends(manager_only)):
    result = await db.templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"ok": True}


@api.post("/jobs/from-template")
async def create_job_from_template(body: UseTemplateIn, _: dict = Depends(manager_only)):
    tpl = await db.templates.find_one({"id": body.template_id}, {"_id": 0})
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    count = await db.jobs.count_documents({})
    new_id = f"OS-{count+1:03d}"
    due = body.due or (datetime.now(timezone.utc) + timedelta(days=tpl.get("default_days", 7))).date().isoformat()
    title = body.title or tpl["title_template"] or tpl["name"]
    doc = {
        "id": new_id,
        "title": title,
        "client": body.client or tpl.get("client"),
        "priority": tpl.get("priority", "medium"),
        "status": "todo",
        "due": due,
        "progress": 0,
        "team": tpl.get("team", []),
        "assignees": tpl.get("assignees", []),
        "recurring": tpl.get("recurring", "none"),
        "desc": tpl.get("desc", ""),
        "hours": 0,
        "revisions": 0,
        "scopeAdded": 0,
        "comments": [],
        "createdAt": _now_iso(),
        "updatedAt": _now_iso(),
        "fromTemplate": tpl["id"],
        "deliverables": tpl.get("deliverables", []),
    }
    await db.jobs.insert_one(doc)
    return _clean(doc)


# ---------- approvals enhancements ----------

@api.post("/approvals/{approval_id}/comments")
async def add_approval_comment(approval_id: str, body: ApprovalCommentIn, user: dict = Depends(current_user)):
    approval = await db.approvals.find_one({"id": approval_id}, {"_id": 0})
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    # Non-manager can only comment on approvals for jobs they are assigned to
    if not user.get("is_admin"):
        job = await db.jobs.find_one({"id": approval.get("jobId"), "assignees": user["id"]}, {"_id": 0})
        if not job:
            raise HTTPException(status_code=403, detail="You can only comment on approvals for jobs you're assigned to")
    comment = {"id": f"ac-{uuid.uuid4().hex[:10]}", "author": user["name"], "authorId": user["id"], "text": body.text, "at": _now_iso()}
    await db.approvals.update_one({"id": approval_id}, {"$push": {"comments": comment}})
    return comment


@api.post("/approvals/{approval_id}/reminder")
async def send_approval_reminder(approval_id: str, _: dict = Depends(manager_only)):
    result = await db.approvals.update_one(
        {"id": approval_id},
        {"$set": {"last_reminder_at": _now_iso()}, "$inc": {"reminder_count": 1}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Approval not found")
    return _clean(await db.approvals.find_one({"id": approval_id}))


# ---------- attachments ----------

@api.post("/jobs/{job_id}/attachments")
async def upload_attachment(job_id: str, file: UploadFile = File(...), user: dict = Depends(current_user)):
    q = _apply_role_filter({"id": job_id}, user)
    job = await db.jobs.find_one(q, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    data = await file.read()
    if len(data) > storage_service.MAX_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 25 MB limit")

    content_type = file.content_type or storage_service.guess_mime(file.filename or "file")
    if not storage_service.is_allowed_mime(content_type):
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {content_type}")

    storage_path = storage_service.build_path(user["id"], file.filename or "file")
    try:
        result = storage_service.put_object(storage_path, data, content_type)
    except Exception as e:
        logger.exception("Storage upload failed")
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")

    attachment = {
        "id": f"att-{uuid.uuid4().hex[:12]}",
        "storage_path": result["path"],
        "filename": file.filename or "file",
        "content_type": content_type,
        "size": len(data),
        "uploaded_by": user["id"],
        "uploaded_by_name": user["name"],
        "uploaded_at": _now_iso(),
        "is_deleted": False,
    }
    await db.jobs.update_one({"id": job_id}, {"$push": {"attachments": attachment}, "$set": {"updatedAt": _now_iso()}})
    return attachment


@api.get("/jobs/{job_id}/attachments/{attachment_id}")
async def download_attachment(job_id: str, attachment_id: str, authorization: Optional[str] = Header(None), auth: Optional[str] = Query(None)):
    # Support ?auth=<token> so <a href> and <img src> work without headers
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(status_code=401, detail="Missing auth token")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    q = _apply_role_filter({"id": job_id}, user)
    job = await db.jobs.find_one(q, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    att = next((a for a in job.get("attachments", []) if a.get("id") == attachment_id and not a.get("is_deleted")), None)
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    try:
        content, _ = storage_service.get_object(att["storage_path"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {e}")

    return Response(
        content=content,
        media_type=att.get("content_type", "application/octet-stream"),
        headers={"Content-Disposition": f'inline; filename="{att["filename"]}"'},
    )


@api.delete("/jobs/{job_id}/attachments/{attachment_id}")
async def delete_attachment(job_id: str, attachment_id: str, user: dict = Depends(current_user)):
    q = _apply_role_filter({"id": job_id}, user)
    job = await db.jobs.find_one(q, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    result = await db.jobs.update_one(
        {"id": job_id, "attachments.id": attachment_id},
        {"$set": {"attachments.$.is_deleted": True, "updatedAt": _now_iso()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Attachment not found")
    return {"ok": True}


# ---------- health ----------

@api.get("/")
async def root():
    return {"service": "openspace-agency-os", "status": "ok"}


app.include_router(public_api)

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
    # One-time migration: ensure every approval has a public_token
    async for doc in db.approvals.find({"public_token": {"$exists": False}}, {"id": 1}):
        await db.approvals.update_one({"id": doc["id"]}, {"$set": {"public_token": uuid.uuid4().hex[:20]}})
    try:
        storage_service.init_storage()
    except Exception as e:
        logger.warning(f"Storage init deferred (will retry lazily): {e}")
    logger.info("Seed check complete.")


@app.on_event("shutdown")
async def shutdown():
    mongo_client.close()


# ============================================================================
# LEADS MODULE
# ============================================================================

class LeadIn(BaseModel):
    company: str = Field(min_length=1, max_length=200)
    contact_name: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    source: str = "manual"  # outbound | inbound | manual
    channel: str = "Other"
    icp_flags: Dict[str, bool] = {}
    status: Optional[str] = None
    owner_id: Optional[str] = None
    notes: str = ""
    expected_deal_size: float = 0
    allow_duplicate: bool = False  # bypass dedup after confirmation


class LeadPatch(BaseModel):
    company: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    channel: Optional[str] = None
    icp_flags: Optional[Dict[str, bool]] = None
    owner_id: Optional[str] = None
    notes: Optional[str] = None
    expected_deal_size: Optional[float] = None
    recycle_date: Optional[str] = None


class LeadStatusChange(BaseModel):
    status: str
    lost_reason: Optional[str] = None
    lost_reason_note: Optional[str] = None
    recycle_date: Optional[str] = None
    proposal_link: Optional[str] = None


class LeadTouchIn(BaseModel):
    kind: str  # call | email | linkedin | note | meeting
    text: str = Field(min_length=1, max_length=4000)


class LeadMergeIn(BaseModel):
    keep_id: str
    remove_id: str


class LeadSettingsPatch(BaseModel):
    proposal_cap_monthly: Optional[int] = None
    won_cap_monthly: Optional[int] = None


class LeadOnboardingPatch(BaseModel):
    contract_sent: Optional[bool] = None
    contract_signed: Optional[bool] = None
    payment_confirmed: Optional[bool] = None
    first_brief_scheduled: Optional[bool] = None
    complete: Optional[bool] = None


async def _emit_lead_webhook(event: str, lead: dict) -> None:
    """Outbound webhook — fires to WEBHOOK_URL (Make.com etc.) on lifecycle events.
    Silent no-op if env is not configured."""
    url = os.environ.get("LEADS_OUTBOUND_WEBHOOK")
    if not url:
        return
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(url, json={"event": event, "lead": lead, "timestamp": _now_iso()})
    except Exception as e:
        logger.warning(f"outbound webhook failed: {e}")


async def _find_duplicates(company: str, email: str, exclude_id: str | None = None) -> list[dict]:
    norm = leads_service.normalize_company(company)
    dom = leads_service.email_domain(email)
    q: dict = {"$or": []}
    if norm:
        q["$or"].append({"dedup_company": norm})
    if email:
        q["$or"].append({"contact_email": email.lower().strip()})
    if dom and dom not in ("gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "protonmail.com", "icloud.com"):
        q["$or"].append({"email_domain": dom})
    if not q["$or"]:
        return []
    if exclude_id:
        q["id"] = {"$ne": exclude_id}
    return _clean_list(await db.leads.find(q, {"_id": 0}).to_list(10))


async def _month_status_count(status: str, month: str | None = None) -> int:
    mk = month or leads_service.month_key()
    return await db.leads.count_documents({"status": status, "status_month": mk})


async def _get_lead_settings() -> dict:
    doc = await db.lead_settings.find_one({"id": "singleton"}, {"_id": 0})
    if doc:
        return doc
    doc = {"id": "singleton", "proposal_cap_monthly": 8, "won_cap_monthly": 5}
    await db.lead_settings.insert_one({**doc})
    return doc


async def _log_touch(lead_id: str, kind: str, text: str, author_id: str = "system", meta: dict | None = None) -> None:
    await db.lead_touches.insert_one({
        "id": f"touch-{uuid.uuid4().hex[:10]}",
        "lead_id": lead_id, "kind": kind, "text": text,
        "author_id": author_id, "timestamp": _now_iso(),
        "meta": meta or {},
    })
    await db.leads.update_one({"id": lead_id}, {"$set": {"last_activity_at": _now_iso()}})


async def _schedule_nurture(lead: dict) -> None:
    """Enqueue nurture sequence steps in the queue collection.
    Actual sending is handled by Make.com via the outbound webhook."""
    seq = leads_service.outbound_sequence_offsets() if lead["source"] == "outbound" else leads_service.inbound_sequence_offsets()
    if lead["source"] == "manual":
        return
    now = datetime.now(timezone.utc)
    for step in seq:
        scheduled = now + timedelta(days=step["day_offset"])
        await db.lead_nurture_queue.insert_one({
            "id": f"nq-{uuid.uuid4().hex[:10]}",
            "lead_id": lead["id"], "step": step["step"], "purpose": step["purpose"],
            "scheduled_at": scheduled.isoformat(),
            "status": "queued", "sent_at": None,
            "draft_subject": None, "draft_body": None,
        })


async def _default_owner_id() -> str:
    """BD by default — Kritika. Falls back to first admin if not seeded."""
    u = await db.users.find_one({"role_key": "clientsvc"}, {"_id": 0, "id": 1})
    if u:
        return u["id"]
    u = await db.users.find_one({"is_admin": True}, {"_id": 0, "id": 1})
    return u["id"] if u else "u_yusuf"


@api.get("/leads")
async def leads_list(
    status_: Optional[str] = None,
    source: Optional[str] = None,
    channel: Optional[str] = None,
    owner_id: Optional[str] = None,
    _: dict = Depends(current_user),
):
    q: dict = {}
    if status_: q["status"] = status_
    if source: q["source"] = source
    if channel: q["channel"] = channel
    if owner_id: q["owner_id"] = owner_id
    docs = _clean_list(await db.leads.find(q, {"_id": 0}).sort("last_activity_at", -1).to_list(2000))
    return docs


@api.get("/leads/settings")
async def leads_settings_get(_: dict = Depends(manager_only)):
    return await _get_lead_settings()


@api.patch("/leads/settings")
async def leads_settings_patch(body: LeadSettingsPatch, _: dict = Depends(manager_only)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return await _get_lead_settings()
    await db.lead_settings.update_one({"id": "singleton"}, {"$set": updates}, upsert=True)
    return await _get_lead_settings()


@api.get("/leads/dedup")
async def leads_dedup(company: str = "", email: str = "", _: dict = Depends(current_user)):
    return {"matches": await _find_duplicates(company, email)}


@api.get("/leads/funnel")
async def leads_funnel(source: Optional[str] = None, from_date: Optional[str] = None, to_date: Optional[str] = None, _: dict = Depends(current_user)):
    q: dict = {}
    if source: q["source"] = source
    if from_date or to_date:
        q["created_at"] = {}
        if from_date: q["created_at"]["$gte"] = from_date
        if to_date: q["created_at"]["$lte"] = to_date + "T23:59:59"
    docs = _clean_list(await db.leads.find(q, {"_id": 0, "id": 1, "status": 1, "expected_deal_size": 1}).to_list(5000))
    stages = ["new", "contacted", "qualified", "call_scheduled", "proposal_sent", "won"]
    counts = {s: 0 for s in stages}
    value = {s: 0.0 for s in stages}
    counts["nurturing"] = 0
    counts["lost"] = 0
    counts["onboarding"] = 0
    for d in docs:
        s = d.get("status", "new")
        counts[s] = counts.get(s, 0) + 1
        if s in value:
            value[s] += float(d.get("expected_deal_size") or 0)
    # Conversion rates (drop-off)
    conv = {}
    prev = counts.get("contacted", 0)
    for s in stages[2:]:  # qualified onward
        conv[s] = round(100 * counts.get(s, 0) / prev, 1) if prev else 0
        prev = counts.get(s, 0) if s != "call_scheduled" else prev
    return {"total": len(docs), "counts": counts, "value": value, "conversion": conv}


@api.post("/leads")
async def leads_create(body: LeadIn, user: dict = Depends(current_user)):
    # Dedup first
    dupes = await _find_duplicates(body.company, body.contact_email)
    if dupes and not body.allow_duplicate:
        raise HTTPException(status_code=409, detail={"code": "duplicate", "matches": dupes})

    # Merge with defaults
    icp = leads_service.default_lead_flags()
    icp.update(body.icp_flags or {})

    # AI classify for outbound/inbound (skip manual — manual usually knows their own ICP)
    if body.source in ("outbound", "inbound"):
        try:
            system = await build_active_system_prompt()
            ai_flags = await ai_service.lead_icp_classify(body.company, body.notes, body.channel, system_prompt=system)
            for k in ("family_run", "startup", "other_b2b", "gap_or_funding"):
                if k in (ai_flags or {}):
                    icp[k] = bool(ai_flags[k])
        except Exception as e:
            logger.warning(f"ICP classify failed: {e}")

    icp_score, icp_tier = leads_service.compute_icp_score(icp)
    owner_id = body.owner_id or await _default_owner_id()
    status = body.status or "new"

    lead = {
        "id": f"lead-{uuid.uuid4().hex[:10]}",
        "company": body.company.strip(),
        "dedup_company": leads_service.normalize_company(body.company),
        "contact_name": body.contact_name.strip(),
        "contact_email": (body.contact_email or "").lower().strip(),
        "email_domain": leads_service.email_domain(body.contact_email),
        "contact_phone": body.contact_phone.strip(),
        "source": body.source if body.source in leads_service.SOURCES else "manual",
        "channel": body.channel,
        "icp_flags": icp,
        "icp_score": icp_score,
        "icp_tier": icp_tier,
        "status": status,
        "status_month": leads_service.month_key(),
        "owner_id": owner_id,
        "first_touch_at": _now_iso(),
        "last_activity_at": _now_iso(),
        "recycle_date": None,
        "notes": body.notes or "",
        "expected_deal_size": float(body.expected_deal_size or 0),
        "lost_reason": None,
        "lost_reason_note": "",
        "onboarding": {"contract_sent": False, "contract_signed": False, "payment_confirmed": False, "first_brief_scheduled": False, "complete": False},
        "proposal_link": None,
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }
    await db.leads.insert_one({**lead})
    await _log_touch(lead["id"], "note", f"Lead created via {body.source} ({body.channel})", author_id=user["id"])
    await _schedule_nurture(lead)
    await _emit_lead_webhook("lead.created", lead)
    lead.pop("_id", None)
    return lead


@api.get("/leads/{lead_id}")
async def leads_get(lead_id: str, _: dict = Depends(current_user)):
    doc = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Lead not found")
    return _clean(doc)


@api.patch("/leads/{lead_id}")
async def leads_patch(lead_id: str, body: LeadPatch, user: dict = Depends(current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "icp_flags" in updates:
        merged = leads_service.default_lead_flags()
        existing = (await db.leads.find_one({"id": lead_id}, {"_id": 0, "icp_flags": 1})) or {}
        merged.update(existing.get("icp_flags") or {})
        merged.update(updates["icp_flags"])
        updates["icp_flags"] = merged
        score, tier = leads_service.compute_icp_score(merged)
        updates["icp_score"] = score
        updates["icp_tier"] = tier
    if "company" in updates:
        updates["dedup_company"] = leads_service.normalize_company(updates["company"])
    if "contact_email" in updates:
        updates["contact_email"] = (updates["contact_email"] or "").lower().strip()
        updates["email_domain"] = leads_service.email_domain(updates["contact_email"])
    updates["updated_at"] = _now_iso()
    updates["last_activity_at"] = _now_iso()
    r = await db.leads.update_one({"id": lead_id}, {"$set": updates})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    doc = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    await _log_touch(lead_id, "note", f"Updated by {user['name']}", author_id=user["id"])
    return _clean(doc)


@api.delete("/leads/{lead_id}")
async def leads_delete(lead_id: str, _: dict = Depends(manager_only)):
    r = await db.leads.delete_one({"id": lead_id})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await db.lead_touches.delete_many({"lead_id": lead_id})
    await db.lead_nurture_queue.delete_many({"lead_id": lead_id})
    return {"ok": True}


@api.post("/leads/{lead_id}/status")
async def leads_status(lead_id: str, body: LeadStatusChange, user: dict = Depends(current_user)):
    if body.status not in leads_service.LEAD_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Not found")

    settings_ = await _get_lead_settings()
    updates: dict = {"status": body.status, "status_month": leads_service.month_key(), "updated_at": _now_iso(), "last_activity_at": _now_iso()}

    # Rule: Lost requires reason
    if body.status == "lost":
        if not body.lost_reason or body.lost_reason not in leads_service.LOST_REASONS:
            raise HTTPException(status_code=400, detail="Lost requires a valid reason")
        if not body.recycle_date:
            raise HTTPException(status_code=400, detail="Lost requires a recycle date")
        updates.update({"lost_reason": body.lost_reason, "lost_reason_note": body.lost_reason_note or "", "recycle_date": body.recycle_date})

    # Capacity cap — warn, don't block
    warning = None
    if body.status == "proposal_sent":
        cnt = await _month_status_count("proposal_sent")
        if cnt >= settings_["proposal_cap_monthly"]:
            warning = f"Monthly Proposal cap reached ({cnt}/{settings_['proposal_cap_monthly']}) — capacity might be strained."
        if body.proposal_link:
            updates["proposal_link"] = body.proposal_link
    if body.status == "won":
        cnt = await _month_status_count("won")
        if cnt >= settings_["won_cap_monthly"]:
            warning = f"Monthly Won cap reached ({cnt}/{settings_['won_cap_monthly']}) — team may be at capacity."
        # Won → onboarding starts
        updates["status"] = "onboarding"

    await db.leads.update_one({"id": lead_id}, {"$set": updates})
    doc = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    await _log_touch(lead_id, "note", f"Status → {updates['status']}" + (f" (reason: {body.lost_reason})" if body.status == "lost" else ""), author_id=user["id"])
    await _emit_lead_webhook(f"lead.status.{updates['status']}", doc)
    return {"lead": _clean(doc), "warning": warning}


@api.post("/leads/{lead_id}/touches")
async def leads_touch_add(lead_id: str, body: LeadTouchIn, user: dict = Depends(current_user)):
    if body.kind not in ("call", "email", "linkedin", "note", "meeting"):
        raise HTTPException(status_code=400, detail="Invalid touch kind")
    if not await db.leads.find_one({"id": lead_id}, {"_id": 1}):
        raise HTTPException(status_code=404, detail="Not found")
    await _log_touch(lead_id, body.kind, body.text, author_id=user["id"])
    # Any contact touch → mark responsive within 48h if within 2 days of first_touch
    if body.kind in ("call", "email", "linkedin", "meeting"):
        lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
        if lead:
            try:
                first = datetime.fromisoformat(lead["first_touch_at"].replace("Z", "+00:00"))
                if (datetime.now(timezone.utc) - first).total_seconds() <= 48 * 3600:
                    flags = dict(lead.get("icp_flags") or {})
                    flags["responsive_48h"] = True
                    score, tier = leads_service.compute_icp_score(flags)
                    await db.leads.update_one({"id": lead_id}, {"$set": {"icp_flags": flags, "icp_score": score, "icp_tier": tier}})
            except Exception:
                pass
            # If new → contacted
            if lead.get("status") == "new":
                await db.leads.update_one({"id": lead_id}, {"$set": {"status": "contacted", "status_month": leads_service.month_key()}})
    return {"ok": True}


@api.get("/leads/{lead_id}/touches")
async def leads_touch_list(lead_id: str, _: dict = Depends(current_user)):
    docs = _clean_list(await db.lead_touches.find({"lead_id": lead_id}, {"_id": 0}).sort("timestamp", -1).to_list(500))
    return docs


@api.post("/leads/merge")
async def leads_merge(body: LeadMergeIn, user: dict = Depends(current_user)):
    keep = await db.leads.find_one({"id": body.keep_id}, {"_id": 0})
    remove = await db.leads.find_one({"id": body.remove_id}, {"_id": 0})
    if not keep or not remove:
        raise HTTPException(status_code=404, detail="Lead(s) not found")
    # Merge non-empty fields from remove into keep (only if keep's field is empty)
    updates: dict = {}
    for k in ("contact_name", "contact_email", "contact_phone", "notes"):
        if not keep.get(k) and remove.get(k):
            updates[k] = remove[k]
    if remove.get("notes") and keep.get("notes") and remove["notes"] not in keep["notes"]:
        updates["notes"] = f"{keep['notes']}\n\n--- merged from {remove['id']} ---\n{remove['notes']}"
    # Move touches to keep
    await db.lead_touches.update_many({"lead_id": body.remove_id}, {"$set": {"lead_id": body.keep_id}})
    if updates:
        updates["updated_at"] = _now_iso()
        await db.leads.update_one({"id": body.keep_id}, {"$set": updates})
    await db.leads.delete_one({"id": body.remove_id})
    await _log_touch(body.keep_id, "note", f"Merged from {body.remove_id} by {user['name']}", author_id=user["id"])
    return {"ok": True, "kept": body.keep_id}


@api.post("/leads/{lead_id}/ai-draft")
async def leads_ai_draft(lead_id: str, _: dict = Depends(current_user)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        system = await build_active_system_prompt()
        draft = await ai_service.lead_intro_draft(
            company=lead["company"], contact_name=lead.get("contact_name") or "",
            channel=lead.get("channel", "Other"), icp=lead.get("icp_flags") or {},
            notes=lead.get("notes") or "", system_prompt=system,
        )
    except Exception as e:
        draft = {
            "subject": f"Quick thought on {lead['company']}",
            "body": f"Hi {lead.get('contact_name') or 'there'},\n\nI came across {lead['company']} recently — we work with a handful of Mumbai-based brands (Galalite, Intercont+) and think there's a specific angle we could explore for you.\n\nWorth a 20-min chat next week?\n\n— Kritika, Openspace"
        }
    return draft


@api.post("/leads/{lead_id}/onboarding")
async def leads_onboarding(lead_id: str, body: LeadOnboardingPatch, user: dict = Depends(manager_only)):
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Not found")
    onboarding = dict(lead.get("onboarding") or {})
    for k, v in body.model_dump().items():
        if v is not None:
            onboarding[k] = v
    # Complete flag can also be auto-derived
    fully = all(onboarding.get(k) for k in ("contract_sent", "contract_signed", "payment_confirmed", "first_brief_scheduled"))
    if fully:
        onboarding["complete"] = True
    updates = {"onboarding": onboarding, "updated_at": _now_iso(), "last_activity_at": _now_iso()}
    if onboarding.get("complete"):
        # Handoff: auto-create client + notify Yusuf + Kritika + webhook
        cli_id = leads_service.normalize_company(lead["company"])[:20] or f"c{uuid.uuid4().hex[:6]}"
        existing = await db.clients.find_one({"id": cli_id}, {"_id": 1})
        if not existing:
            await db.clients.insert_one({
                "id": cli_id, "name": lead["company"],
                "color": "#4361EE", "short": lead["company"][:3].upper(),
                "email": lead.get("contact_email") or "",
                "voice": f"New client — onboarded from lead {lead_id}. Update voice guide once brief kickoff is done.",
            })
        # Notify Yusuf + BD
        for u in await db.users.find({"$or": [{"is_admin": True}, {"role_key": "clientsvc"}]}, {"_id": 0, "id": 1}).to_list(20):
            await db.notifications.insert_one({
                "id": f"n-{uuid.uuid4().hex[:8]}",
                "title": f"🎉 New client onboarded: {lead['company']}",
                "subtitle": f"Handoff from lead {lead_id} → client {cli_id}",
                "time": _now_iso(), "type": "lead", "read": False, "user_id": u["id"],
            })
        await _emit_lead_webhook("lead.onboarded", {**lead, "client_id": cli_id})
    await db.leads.update_one({"id": lead_id}, {"$set": updates})
    return _clean(await db.leads.find_one({"id": lead_id}, {"_id": 0}))


@api.post("/leads/{lead_id}/booking")
async def leads_booking(lead_id: str, body: Dict[str, Any] = None, user: dict = Depends(current_user)):
    body = body or {}
    lead = await db.leads.find_one({"id": lead_id}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Not found")
    when = body.get("scheduled_at") or _now_iso()
    await db.leads.update_one({"id": lead_id}, {"$set": {"status": "call_scheduled", "status_month": leads_service.month_key(), "call_scheduled_at": when, "last_activity_at": _now_iso()}})
    await _log_touch(lead_id, "meeting", f"Call scheduled for {when}", author_id=user["id"], meta={"scheduled_at": when})
    await db.notifications.insert_one({
        "id": f"n-{uuid.uuid4().hex[:8]}",
        "title": f"📞 Call scheduled: {lead['company']}",
        "subtitle": f"{when} · owner {lead.get('owner_id')}",
        "time": _now_iso(), "type": "lead", "read": False, "user_id": lead.get("owner_id") or "u_yusuf",
    })
    await _emit_lead_webhook("lead.booking", {**lead, "scheduled_at": when})
    return _clean(await db.leads.find_one({"id": lead_id}, {"_id": 0}))


# ---------- inbound webhook (Make.com / website form / scraper) ----------

@api.post("/webhooks/leads/inbound")
async def leads_inbound_webhook(body: LeadIn, x_webhook_secret: Optional[str] = Header(None)):
    """Receive new leads from Make.com or a website form. Requires shared secret."""
    expected = os.environ.get("LEADS_INBOUND_SECRET", "")
    if expected and x_webhook_secret != expected:
        raise HTTPException(status_code=401, detail="Bad webhook secret")
    body.source = body.source if body.source in leads_service.SOURCES else "inbound"
    body.allow_duplicate = False  # dedup surfaces on the wire
    dupes = await _find_duplicates(body.company, body.contact_email)
    if dupes:
        # Log the duplicate rather than reject — flags for review
        return {"status": "duplicate_flagged", "matches": [{"id": d["id"], "company": d["company"]} for d in dupes]}
    # Reuse the create logic — cheat by constructing a system user
    system_user = {"id": "system", "name": "webhook", "is_admin": True}
    # inline creation
    icp = leads_service.default_lead_flags()
    icp.update(body.icp_flags or {})
    try:
        system = await build_active_system_prompt()
        ai_flags = await ai_service.lead_icp_classify(body.company, body.notes, body.channel, system_prompt=system)
        for k in ("family_run", "startup", "other_b2b", "gap_or_funding"):
            if k in (ai_flags or {}):
                icp[k] = bool(ai_flags[k])
    except Exception:
        pass
    score, tier = leads_service.compute_icp_score(icp)
    owner_id = body.owner_id or await _default_owner_id()
    lead = {
        "id": f"lead-{uuid.uuid4().hex[:10]}",
        "company": body.company.strip(),
        "dedup_company": leads_service.normalize_company(body.company),
        "contact_name": body.contact_name or "",
        "contact_email": (body.contact_email or "").lower().strip(),
        "email_domain": leads_service.email_domain(body.contact_email),
        "contact_phone": body.contact_phone or "",
        "source": body.source,
        "channel": body.channel,
        "icp_flags": icp, "icp_score": score, "icp_tier": tier,
        "status": "new", "status_month": leads_service.month_key(),
        "owner_id": owner_id,
        "first_touch_at": _now_iso(), "last_activity_at": _now_iso(),
        "recycle_date": None,
        "notes": body.notes or "",
        "expected_deal_size": float(body.expected_deal_size or 0),
        "lost_reason": None, "lost_reason_note": "",
        "onboarding": {"contract_sent": False, "contract_signed": False, "payment_confirmed": False, "first_brief_scheduled": False, "complete": False},
        "proposal_link": None, "created_at": _now_iso(), "updated_at": _now_iso(),
    }
    await db.leads.insert_one({**lead})
    await _log_touch(lead["id"], "note", f"Lead received via webhook ({body.source} / {body.channel})", author_id="system")
    await _schedule_nurture(lead)
    await _emit_lead_webhook("lead.created", lead)
    return {"status": "created", "id": lead["id"]}


# ---------- maintenance: recycle lost, alert stale ----------

@api.post("/leads/maintenance/run")
async def leads_maintenance(_: dict = Depends(manager_only)):
    """Idempotent housekeeping — resurface lost leads whose recycle_date has arrived,
    and post stale-lead alerts for the owner. Safe to call daily via a cron."""
    today = date.today().isoformat()
    resurfaced = []
    async for lead in db.leads.find({"status": "lost", "recycle_date": {"$lte": today}}, {"_id": 0}):
        await db.leads.update_one({"id": lead["id"]}, {"$set": {"status": "contacted", "status_month": leads_service.month_key(), "recycle_date": None, "last_activity_at": _now_iso()}})
        await _log_touch(lead["id"], "note", f"Auto-resurfaced from lost — recycle date reached ({today})", author_id="system")
        await db.notifications.insert_one({
            "id": f"n-{uuid.uuid4().hex[:8]}", "title": f"🔁 Lead resurfaced: {lead['company']}",
            "subtitle": "Recycle date reached — worth another shot", "time": _now_iso(),
            "type": "lead", "read": False, "user_id": lead.get("owner_id") or "u_yusuf",
        })
        resurfaced.append(lead["id"])
    stale = []
    async for lead in db.leads.find({"status": {"$in": ["contacted", "qualified", "nurturing"]}}, {"_id": 0}):
        if leads_service.is_stale(lead.get("last_activity_at", ""), lead.get("status", "")):
            already = await db.notifications.find_one({"type": "lead_stale", "meta.lead_id": lead["id"]})
            if not already:
                await db.notifications.insert_one({
                    "id": f"n-{uuid.uuid4().hex[:8]}", "title": f"⏰ Stale lead: {lead['company']}",
                    "subtitle": f"No activity for 14+ days — status {lead['status']}",
                    "time": _now_iso(), "type": "lead_stale", "read": False,
                    "user_id": lead.get("owner_id") or "u_yusuf",
                    "meta": {"lead_id": lead["id"]},
                })
                stale.append(lead["id"])
    return {"resurfaced": resurfaced, "stale_alerts": stale}



# Register the api router LAST so all endpoints defined above are included
app.include_router(api)
