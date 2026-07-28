"""Openspace Agency OS — FastAPI backend."""
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

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
    docs = await db.approvals.find({}).sort("sent", -1).to_list(200)
    # Backfill public_token for legacy docs
    for d in docs:
        if not d.get("public_token"):
            token = uuid.uuid4().hex[:20]
            await db.approvals.update_one({"id": d["id"]}, {"$set": {"public_token": token}})
            d["public_token"] = token
    return _clean_list(docs)


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
    job = await db.jobs.find_one({"id": doc.get("jobId")}, {"_id": 0, "comments": 0, "assignees": 0, "aiWorkflow": 0}) or {}
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
    new_status = "approved" if body.action == "approve" else "rejected"
    author = (body.author or "Client").strip() or "Client"
    await db.approvals.update_one(
        {"public_token": token},
        {"$set": {"status": new_status, "feedback": body.feedback or "", "decided_by_client": author, "decided_at": _now_iso()}},
    )
    note = {"id": f"ac-{uuid.uuid4().hex[:10]}", "author": f"{author} (client)", "authorId": "public", "text": f"Client {'approved' if new_status=='approved' else 'requested revision'} via portal." + (f" Feedback: {body.feedback}" if body.feedback else ""), "at": _now_iso()}
    await db.approvals.update_one({"public_token": token}, {"$push": {"comments": note}})
    await db.notifications.insert_one({
        "id": f"n-{uuid.uuid4().hex[:8]}",
        "title": f"Client {new_status}: {doc.get('title','')}",
        "subtitle": f"{author} via client portal" + (f" · {body.feedback[:80]}" if body.feedback else ""),
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
    author = (body.author or "Client").strip() or "Client"
    comment = {"id": f"ac-{uuid.uuid4().hex[:10]}", "author": f"{author} (client)", "authorId": "public", "text": body.text, "at": _now_iso()}
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
    regex = {"$regex": q, "$options": "i"}
    job_q = {"$or": [{"title": regex}, {"id": regex}, {"desc": regex}]}
    if not user.get("is_admin"):
        job_q = {"$and": [job_q, {"assignees": user["id"]}]}
    jobs = await db.jobs.find(job_q, {"_id": 0, "id": 1, "title": 1, "client": 1, "status": 1}).limit(6).to_list(6)
    clients = await db.clients.find({"$or": [{"name": regex}, {"short": regex}]}, {"_id": 0, "id": 1, "name": 1, "color": 1}).limit(4).to_list(4)
    appr_q = {"$or": [{"title": regex}, {"preview": regex}]}
    approvals = await db.approvals.find(appr_q, {"_id": 0, "id": 1, "jobId": 1, "title": 1, "status": 1, "client": 1}).limit(4).to_list(4)
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


app.include_router(api)
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
    try:
        storage_service.init_storage()
    except Exception as e:
        logger.warning(f"Storage init deferred (will retry lazily): {e}")
    logger.info("Seed check complete.")


@app.on_event("shutdown")
async def shutdown():
    mongo_client.close()
